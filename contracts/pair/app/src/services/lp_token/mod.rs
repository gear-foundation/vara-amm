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

#[event]
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
            vft: <VftService>::init(name, symbol, decimals),
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
        services::utils::panicking(|| {
            funcs::mint(Storage::balances(), Storage::total_supply(), to, value)
        })
    }

    pub fn burn(&mut self, from: ActorId, value: U256) -> bool {      
        services::utils::panicking(|| {
            funcs::burn(Storage::balances(), Storage::total_supply(), from, value)
        })
    }

    pub fn total_supply() -> U256 {
        *Storage::total_supply()
    }

    pub fn balance_of(account: ActorId) -> U256 {
        *Storage::balances().get(&account).unwrap_or(&U256::zero())
    }
}

impl ExtendedService {
    pub fn new() -> Self {
        Self {
            vft: VftService::new(),
        }
    }
}
#[service(extends = VftService, events = Event)]
impl ExtendedService {
    #[export]
    pub fn grant_admin_role(&mut self, to: ActorId) {
        self.ensure_is_admin();
        self.get_mut().admins.insert(to);
    }

    #[export]
    pub fn grant_minter_role(&mut self, to: ActorId) {
        self.ensure_is_admin();
        self.get_mut().minters.insert(to);
    }

    #[export]
    pub fn grant_burner_role(&mut self, to: ActorId) {
        self.ensure_is_admin();
        self.get_mut().burners.insert(to);
    }

    #[export]
    pub fn revoke_admin_role(&mut self, from: ActorId) {
        self.ensure_is_admin();
        self.get_mut().admins.remove(&from);
    }

    #[export]
    pub fn revoke_minter_role(&mut self, from: ActorId) {
        self.ensure_is_admin();
        self.get_mut().minters.remove(&from);
    }

    #[export]
    pub fn revoke_burner_role(&mut self, from: ActorId) {
        self.ensure_is_admin();
        self.get_mut().burners.remove(&from);
    }

    #[export]
    pub fn minters(&self) -> Vec<ActorId> {
        self.get().minters.clone().into_iter().collect()
    }

    #[export]
    pub fn burners(&self) -> Vec<ActorId> {
        self.get().burners.clone().into_iter().collect()
    }
    #[export]
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

impl From<ExtendedService> for VftService {
    fn from(value: ExtendedService) -> Self {
        value.vft
    }
}