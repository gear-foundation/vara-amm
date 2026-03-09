use awesome_sails_storage::StorageRefCell;
use awesome_sails_storage::{Storage, StorageMut};
use awesome_sails_utils::{
    error::{EmitError, Error},
    math::{Max, NonZero, Zero},
    ok_if,
    pause::{Pausable, PausableRef, Pause},
};
use awesome_sails_vft_metadata::{Metadata, VftMetadata, VftMetadataExposure};
use gstd::msg;
use sails_rs::{cell::RefCell, gstd::services::Service, prelude::*};

use crate::services::lp_token::state::{LpAllowances, LpBalance, LpBalances};

pub mod state;

pub struct LpService<'a> {
    pause: &'a Pause,
    allowances: &'a RefCell<LpAllowances>,
    balances: &'a RefCell<LpBalances>,
    metadata: &'a RefCell<Metadata>,
    admins: &'a RefCell<Vec<ActorId>>,
}

impl<'a> LpService<'a> {
    pub fn new(
        pause: &'a Pause,
        allowances: &'a RefCell<LpAllowances>,
        balances: &'a RefCell<LpBalances>,
        metadata: &'a RefCell<Metadata>,
        admins: &'a RefCell<Vec<ActorId>>,
    ) -> Self {
        Self {
            pause,
            allowances,
            balances,
            metadata,
            admins,
        }
    }

    fn allowances_ref(&self) -> PausableRef<'_, LpAllowances> {
        Pausable::new(self.pause, StorageRefCell::new(self.allowances))
    }

    fn balances_ref(&self) -> PausableRef<'_, LpBalances> {
        Pausable::new(self.pause, StorageRefCell::new(self.balances))
    }

    pub fn is_admin(&self, account: &ActorId) -> bool {
        let admins = self.admins.borrow();
        admins.contains(account)
    }

    fn ensure_admin(&self) {
        let caller = msg::source();
        if !self.is_admin(&caller) {
            panic!("Not admin")
        }
    }
}

#[event]
#[derive(Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub enum Event {
    Approval {
        owner: ActorId,
        spender: ActorId,
        value: U256,
    },
    Transfer {
        from: ActorId,
        to: ActorId,
        value: U256,
    },

    // LP-specific events
    Minted {
        to: ActorId,
        value: U256,
    },
    Burned {
        from: ActorId,
        value: U256,
    },
    Paused,
    Resumed,
}

#[service(events = Event)]
impl LpService<'_> {
    fn metadata_svc(&self) -> VftMetadataExposure<VftMetadata<StorageRefCell<'_, Metadata>>> {
        VftMetadata::new(StorageRefCell::new(self.metadata)).expose(self.route())
    }
    pub fn mint_internal(&mut self, to: ActorId, value: U256) -> Result<(), Error> {
        ok_if!(value.is_zero());

        self.balances_ref()
            .get_mut()?
            .mint(to.try_into()?, LpBalance::try_from(value)?.try_into()?)?;

        self.emit_event(Event::Minted { to, value })
            .map_err(|_| EmitError)?;
        Ok(())
    }

    pub fn burn_internal(&mut self, from: ActorId, value: U256) -> Result<(), Error> {
        self.balances_ref()
            .get_mut()?
            .burn(from.try_into()?, LpBalance::try_from(value)?.try_into()?)?;

        self.emit_event(Event::Burned { from, value })
            .map_err(|_| EmitError)?;
        Ok(())
    }

    #[export]
    pub fn name(&self) -> String {
        self.metadata_svc().name()
    }

    #[export]
    pub fn symbol(&self) -> String {
        self.metadata_svc().symbol()
    }

    #[export]
    pub fn decimals(&self) -> u8 {
        self.metadata_svc().decimals()
    }

    #[export(unwrap_result)]
    pub fn approve(&mut self, spender: ActorId, value: U256) -> Result<bool, Error> {
        let owner = Syscall::message_source();
        ok_if!(owner == spender, false);

        let mut a = self.allowances_ref();

        let approval = LpBalance::try_from(value).unwrap_or(LpBalance::MAX);
        let value = if approval.is_max() { U256::MAX } else { value };

        let previous = a.get_mut()?.set(
            owner.try_into()?,
            spender.try_into()?,
            approval,
            Syscall::block_height(),
        )?;

        let changed = previous.map(NonZero::cast).unwrap_or(U256::ZERO) != value;

        if changed {
            self.emit_event(Event::Approval {
                owner,
                spender,
                value,
            })
            .map_err(|_| EmitError)?;
        }

        Ok(changed)
    }

    #[export(unwrap_result)]
    pub fn transfer(&mut self, to: ActorId, value: U256) -> Result<bool, Error> {
        let from = Syscall::message_source();
        ok_if!(from == to || value.is_zero(), false);

        let mut b = self.balances_ref();

        b.get_mut()?.transfer(
            from.try_into()?,
            to,
            LpBalance::try_from(value)?.try_into()?,
        )?;

        self.emit_event(Event::Transfer { from, to, value })
            .map_err(|_| EmitError)?;

        Ok(true)
    }

    #[export(unwrap_result)]
    pub fn transfer_from(
        &mut self,
        from: ActorId,
        to: ActorId,
        value: U256,
    ) -> Result<bool, Error> {
        let spender = Syscall::message_source();

        if spender == from {
            return self.transfer(to, value);
        }

        ok_if!(from == to || value.is_zero(), false);

        let mut a = self.allowances_ref();
        let mut b = self.balances_ref();

        let _from = from.try_into()?;
        let _spender = spender.try_into()?;
        let _value: NonZero<_> = LpBalance::try_from(value)?.try_into()?;

        // allowance-type == LpBalance, so this cast is consistent
        a.get_mut()?.decrease(
            _from,
            _spender,
            _value.non_zero_cast(),
            Syscall::block_height(),
        )?;

        b.get_mut()?.transfer(_from, to, _value)?;

        self.emit_event(Event::Transfer { from, to, value })
            .map_err(|_| EmitError)?;

        Ok(true)
    }

    #[export(unwrap_result)]
    pub fn allowance(&self, owner: ActorId, spender: ActorId) -> Result<U256, Error> {
        let a = self.allowances_ref();
        let allowance = a.get()?.get(owner.try_into()?, spender.try_into()?);

        Ok(if allowance.is_max() {
            U256::MAX
        } else {
            allowance.into()
        })
    }

    #[export(unwrap_result)]
    pub fn balance_of(&self, account: ActorId) -> Result<U256, Error> {
        let b = self.balances_ref();
        Ok(b.get()?.get(account.try_into()?).into())
    }

    #[export(unwrap_result)]
    pub fn total_supply(&self) -> Result<U256, Error> {
        let b = self.balances_ref();
        Ok(b.get()?.total_supply())
    }

    #[export]
    pub fn pause(&mut self) {
        self.ensure_admin();

        if self.pause.pause() {
            self.emit_event(Event::Paused)
                .expect("Error during event emission")
        }
    }

    #[export]
    pub fn resume(&mut self) {
        self.ensure_admin();

        if self.pause.resume() {
            self.emit_event(Event::Resumed)
                .expect("Error during event emission")
        }
    }

    #[export]
    pub fn is_paused(&self) -> bool {
        self.pause.is_paused()
    }

    #[export(unwrap_result)]
    pub fn append_balances_shard(&mut self, capacity: u32) -> Result<(), Error> {
        self.ensure_admin();
        self.balances
            .borrow_mut()
            .try_append_shard(capacity as usize)?;
        Ok(())
    }

    #[export(unwrap_result)]
    pub fn append_allowances_shard(&mut self, capacity: u32) -> Result<(), Error> {
        self.ensure_admin();
        self.allowances
            .borrow_mut()
            .try_append_shard(capacity as usize)?;

        Ok(())
    }

    #[export]
    pub fn alloc_next_balances_shard(&mut self) -> bool {
        self.ensure_admin();
        self.balances.borrow_mut().allocate_next_shard()
    }

    #[export]
    pub fn alloc_next_allowances_shard(&mut self) -> bool {
        self.ensure_admin();
        self.allowances.borrow_mut().allocate_next_shard()
    }
}
