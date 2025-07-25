#![allow(static_mut_refs)]
use sails_rs::{collections::HashSet, gstd::msg, prelude::*};
mod funcs;
use crate::services;
use vft_service::{Service as VftService, Storage};

#[derive(Default)]
pub struct ExtendedStorage {
    minters: HashSet<ActorId>,
    burners: HashSet<ActorId>,
    admins: HashSet<ActorId>,
}

static mut EXTENDED_STORAGE: Option<ExtendedStorage> = None;

#[derive(Encode, Decode, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub enum Event {
    Minted { to: ActorId, value: U256 },
    Burned { from: ActorId, value: U256 },
}
#[derive(Clone)]
pub struct ExtendedService {
    vft: VftService,
}

impl ExtendedService {
    pub fn seed(name: String, symbol: String, decimals: u8) -> Self {
        let admin = msg::source();
        unsafe {
            EXTENDED_STORAGE = Some(ExtendedStorage {
                admins: [admin].into(),
                minters: [admin].into(),
                burners: [admin].into(),
            });
        };
        ExtendedService {
            vft: <VftService>::seed(name, symbol, decimals),
        }
    }

    pub fn get_mut(&mut self) -> &'static mut ExtendedStorage {
        unsafe {
            EXTENDED_STORAGE
                .as_mut()
                .expect("Extended vft is not initialized")
        }
    }
    pub fn get(&self) -> &'static ExtendedStorage {
        unsafe {
            EXTENDED_STORAGE
                .as_ref()
                .expect("Extended vft is not initialized")
        }
    }
}

impl ExtendedService {
    pub fn mint(&mut self, to: ActorId, value: U256) -> bool {
        let mutated = services::utils::panicking(|| {
            funcs::mint(Storage::balances(), Storage::total_supply(), to, value)
        });
        if mutated {
            self.emit_event(Event::Minted { to, value })
                .expect("Notification Error");
        }
        mutated
    }

    pub fn burn(&mut self, from: ActorId, value: U256) -> bool {
        let mutated = services::utils::panicking(|| {
            funcs::burn(Storage::balances(), Storage::total_supply(), from, value)
        });
        if mutated {
            self.emit_event(Event::Burned { from, value })
                .expect("Notification Error");
        }
        mutated
    }

    pub fn total_supply() -> U256 {
        *Storage::total_supply()
    }

    pub fn balance_of(account: ActorId) -> U256 {
        *Storage::balances().get(&account).unwrap_or(&U256::zero())
    }
}
#[service(extends = VftService, events = Event)]
impl ExtendedService {
    pub fn new() -> Self {
        Self {
            vft: VftService::new(),
        }
    }

    pub fn grant_admin_role(&mut self, to: ActorId) {
        self.ensure_is_admin();
        self.get_mut().admins.insert(to);
    }
    pub fn grant_minter_role(&mut self, to: ActorId) {
        self.ensure_is_admin();
        self.get_mut().minters.insert(to);
    }
    pub fn grant_burner_role(&mut self, to: ActorId) {
        self.ensure_is_admin();
        self.get_mut().burners.insert(to);
    }

    pub fn revoke_admin_role(&mut self, from: ActorId) {
        self.ensure_is_admin();
        self.get_mut().admins.remove(&from);
    }
    pub fn revoke_minter_role(&mut self, from: ActorId) {
        self.ensure_is_admin();
        self.get_mut().minters.remove(&from);
    }
    pub fn revoke_burner_role(&mut self, from: ActorId) {
        self.ensure_is_admin();
        self.get_mut().burners.remove(&from);
    }
    pub fn minters(&self) -> Vec<ActorId> {
        self.get().minters.clone().into_iter().collect()
    }

    pub fn burners(&self) -> Vec<ActorId> {
        self.get().burners.clone().into_iter().collect()
    }

    pub fn admins(&self) -> Vec<ActorId> {
        self.get().admins.clone().into_iter().collect()
    }
}

impl ExtendedService {
    fn ensure_is_admin(&self) {
        if !self.get().admins.contains(&msg::source()) {
            panic!("Not admin")
        };
    }
}
impl AsRef<VftService> for ExtendedService {
    fn as_ref(&self) -> &VftService {
        &self.vft
    }
}
