#![no_std]

pub mod services;
use sails_rs::{cell::RefCell, prelude::*};
use services::lp_token::{LpService, state::LpTokenState};
use services::pair::{self, Config, PairService, msg_tracker::MessageTracker};

pub struct PairProgram {
    pair_state: RefCell<pair::State>,
    tracker: RefCell<MessageTracker>,
    lp: LpTokenState,
}

#[sails_rs::program]
impl PairProgram {
    // Program's constructor
    pub fn new(
        config: Config,
        token0: ActorId,
        token1: ActorId,
        fee_to: ActorId,
        treasury_id: ActorId,
        admin_id: ActorId,
    ) -> Self {
        let lp = LpTokenState::new("LP".into(), "LP".into(), 18);
        let factory_id = sails_rs::gstd::msg::source();

        let pair_state = pair::State {
            token0,
            token1,
            fee_to,
            factory_id,
            treasury_id,
            admin_id,
            config,
            ..Default::default()
        };
        sails_rs::gstd::msg::reply_bytes(b"", 0).expect("Error during msg reply");
        Self {
            pair_state: RefCell::new(pair_state),
            tracker: RefCell::new(MessageTracker::default()),
            lp,
        }
    }

    pub fn pair(&self) -> PairService<'_> {
        PairService::new(&self.pair_state, &self.tracker, &self.lp)
    }

    pub fn vft(&self) -> LpService<'_> {
        LpService::new(
            &self.lp.pause,
            &self.lp.allowances,
            &self.lp.balances,
            &self.lp.metadata,
        )
    }

    #[allow(dead_code)]
    #[handle_reply]
    fn handle_reply(&self) {
        self.pair().on_reply();
    }
}
