#![no_std]
#![allow(static_mut_refs)]

use gstd::prog::ProgramGenerator;
use sails_rs::{collections::HashMap, gstd::msg, prelude::*};
pub const ONE_VARA: u128 = 1_000_000_000_000;

struct FactoryService(());

#[derive(Debug, Default)]
struct State {
    pair_id: CodeId,
    pairs: HashMap<(ActorId, ActorId), ActorId>,
    fee_to: ActorId,
    admin: ActorId,
    config: Config,
}

/// Config that will be used to send messages to the other programs or create programs.
#[derive(Default, Debug, Decode, Encode, TypeInfo, Clone)]
pub struct Config {
    /// Gas limit for token operations. Token operations include:
    /// - Mint
    /// - Burn
    /// - TransferFrom
    gas_for_token_ops: u64,
    /// Gas to reserve for reply processing.
    gas_for_reply_deposit: u64,
    /// Timeout in blocks that current program will wait for reply from
    /// the other programs such as VFT
    reply_timeout: u32,
    gas_for_pair_creation: u64,
}
static mut STATE: Option<State> = None;

#[derive(Debug, Decode, Encode, TypeInfo)]
pub enum FactoryEvent {
    PairCreated {
        token0: ActorId,
        token1: ActorId,
        pair_address: ActorId,
    },
}

impl FactoryService {
    pub fn init(pair_id: CodeId, admin: ActorId, fee_to: ActorId, config: Config) -> Self {
        unsafe {
            STATE = Some(State {
                pair_id,
                admin,
                fee_to,
                config,
                ..Default::default()
            })
        }
        Self(())
    }
    fn get_mut(&mut self) -> &'static mut State {
        unsafe { STATE.as_mut().expect("State is not initialized") }
    }
    fn get(&self) -> &'static State {
        unsafe { STATE.as_ref().expect("State is not initialized") }
    }
}

#[sails_rs::service(events = FactoryEvent)]
impl FactoryService {
    pub fn new() -> Self {
        Self(())
    }

    pub async fn create_pair(&mut self, token0: ActorId, token1: ActorId) {
        let state = self.get_mut();
        let (token0, token1) = sort_tokens(token0, token1);

        if state.pairs.contains_key(&(token0, token1)) {
            panic!("Pair exists")
        }
        if msg::value() != ONE_VARA {
            panic!("Must attach 1 Vara to create pair contract");
        }
        let pair_config = pair_client::Config {
            gas_for_token_ops: state.config.gas_for_token_ops,
            gas_for_reply_deposit: state.config.gas_for_reply_deposit,
            reply_timeout: state.config.reply_timeout,
        };

        let payload = pair_client::pair_factory::io::New::encode_call(
            pair_config,
            token0,
            token1,
            state.fee_to,
        );

        let create_program_future = ProgramGenerator::create_program_bytes_with_gas_for_reply(
            state.pair_id,
            payload,
            state.config.gas_for_pair_creation,
            ONE_VARA,
            0,
        )
        .unwrap_or_else(|e| panic!("{:?}", e));

        let (pair_address, _) = create_program_future
            .await
            .unwrap_or_else(|e| panic!("{:?}", e));

        state.pairs.insert((token0, token1), pair_address);

        self.emit_event(FactoryEvent::PairCreated {
            token0,
            token1,
            pair_address,
        })
        .expect("Error during event emission");
    }

    pub fn change_fee_to(&mut self, fee_to: ActorId) {
        if msg::source() != self.get().admin {
            panic!("Not admin")
        }

        self.get_mut().fee_to = fee_to;
    }

    pub fn fee_to(&self) -> ActorId {
        self.get().fee_to
    }

    pub fn pairs(&self) -> Vec<((ActorId, ActorId), ActorId)> {
        self.get().pairs.iter().map(|(k, v)| (*k, *v)).collect()
    }

    pub fn get_pair(&self, token0: ActorId, token1: ActorId) -> ActorId {
        let (token0, token1) = sort_tokens(token0, token1);
        *(self
            .get()
            .pairs
            .get(&(token0, token1))
            .unwrap_or(&ActorId::zero()))
    }
}

fn sort_tokens(token_a: ActorId, token_b: ActorId) -> (ActorId, ActorId) {
    if token_a == token_b {
        panic!("Identical addresses")
    }

    let (token0, token1) = if token_a < token_b {
        (token_a, token_b)
    } else {
        (token_b, token_a)
    };

    (token0, token1)
}
pub struct FactoryProgram(());

#[sails_rs::program]
impl FactoryProgram {
    // Program's constructor
    pub fn new(pair_id: CodeId, admin: ActorId, fee_to: ActorId, config: Config) -> Self {
        FactoryService::init(pair_id, admin, fee_to, config);
        Self(())
    }

    // Exposed service
    pub fn factory(&self) -> FactoryService {
        FactoryService::new()
    }
}
