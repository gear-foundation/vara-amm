#![no_std]

pub mod services;
use sails_rs::prelude::*;
use services::lp_token::ExtendedService;
use services::pair::{Config, PairService};

pub struct PairProgram(());

#[sails_rs::program]
impl PairProgram {
    // Program's constructor
    pub fn new(config: Config, token0: ActorId, token1: ActorId, fee_to: ActorId) -> Self {
        ExtendedService::seed("LP".to_string(), "LP".to_string(), 18);
        PairService::init(config, token0, token1, fee_to, self.pair());
        Self(())
    }

    pub fn pair(&self) -> PairService {
        PairService::new(self.vft())
    }

    pub fn vft(&self) -> ExtendedService {
        ExtendedService::new()
    }
}
