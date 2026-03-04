use awesome_sails_utils::impl_math_wrapper;
use awesome_sails_utils::math::LeBytes;
use awesome_sails_utils::pause::Pause;
use awesome_sails_vft_metadata::Metadata;
use awesome_sails_vft_utils::{Allowances, Balances};
use sails_rs::{cell::RefCell, prelude::*};

pub const SHARD_SMALL: usize = 7 << 14; // 114_688
pub const SHARD_MED: usize = 7 << 15; // 229_376
pub const SHARD_LARGE: usize = 7 << 16; // 458_752

const BALANCES_CAPS: &[usize] = &[SHARD_SMALL, SHARD_MED, SHARD_MED, SHARD_LARGE];
const ALLOWANCES_CAPS: &[usize] = &[SHARD_SMALL, SHARD_SMALL, SHARD_MED, SHARD_MED];

#[derive(Clone, Copy, Debug, Default, Decode, Encode, PartialEq, Eq, PartialOrd, Ord, TypeInfo)]
#[codec(crate = sails_rs::scale_codec)]
#[scale_info(crate = sails_rs::scale_info)]
pub struct LpBalance(LeBytes<15>);

pub type LpBalances = Balances<LpBalance>;
pub type LpAllowances = Allowances<LpBalance>;

impl_math_wrapper!(LpBalance, LeBytes<15>);

pub struct LpTokenState {
    pub pause: Pause,
    pub allowances: RefCell<LpAllowances>,
    pub balances: RefCell<LpBalances>,
    pub metadata: RefCell<Metadata>,
}

impl LpTokenState {
    pub fn new(name: String, symbol: String, decimals: u8) -> Self {
        let pause = Pause::default();

        let mut allowances = LpAllowances::try_new(ALLOWANCES_CAPS.to_vec(), 24 * 60 * 60 / 3)
            .expect("invalid allowances capacities");
        allowances.set_expiry_period(24 * 60 * 60 / 3);

        allowances.allocate_next_shard();

        let mut balances =
            LpBalances::try_new(BALANCES_CAPS.to_vec()).expect("invalid balances capacities");
        balances.allocate_next_shard();

        let allowances: RefCell<LpAllowances> = RefCell::new(allowances);
        let balances: RefCell<LpBalances> = RefCell::new(balances);

        let metadata: RefCell<Metadata> = RefCell::new(Metadata::new(name, symbol, decimals));

        Self {
            pause,
            allowances,
            balances,
            metadata,
        }
    }

    pub fn set_paused(&self, paused: bool) {
        if paused {
            self.pause.pause();
        } else {
            self.pause.resume();
        }
    }

    pub fn is_paused(&self) -> bool {
        self.pause.is_paused()
    }
}
