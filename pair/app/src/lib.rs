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
        PairService::init(config, token0, token1, fee_to);
        ExtendedService::seed("LP".to_string(), "LP".to_string(), 18);
        Self(())
    }

    // Exposed service
    pub fn pair(&self) -> PairService {
        PairService::new()
    }

    pub fn vft(&self) -> ExtendedService {
        ExtendedService::new()
    }
}
