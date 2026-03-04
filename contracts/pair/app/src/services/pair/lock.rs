use crate::*;
#[derive(Debug, Default, Clone, Encode, Decode, TypeInfo, PartialEq, Eq)]
pub enum LockState {
    #[default]
    Free,
    /// Normal in-flight operation: no pause, but we have full context.
    Busy(LockCtx),
    /// Contract is paused; keep the same context for recovery.
    Paused(LockCtx),
}

impl LockState {
    pub fn is_free(&self) -> bool {
        matches!(self, LockState::Free)
    }
    pub fn set_free(&mut self) {
        *self = LockState::Free;
    }

    pub fn pause_keep_ctx(&mut self) {
        *self = match core::mem::replace(self, LockState::Free) {
            LockState::Busy(ctx) => LockState::Paused(ctx),
            other => other,
        };
    }

    pub fn advance_after_token0_ok(&mut self) {
        match self {
            LockState::Busy(LockCtx::RemLiq { stage, .. })
            | LockState::Busy(LockCtx::MigrateAllLiquidity { stage, .. })
            | LockState::Busy(LockCtx::TreasuryPayout { stage, .. }) => {
                *stage = SendTokenStage::SendToken1;
            }
            _ => {}
        }
    }
}

#[derive(Debug, Clone, Encode, Decode, TypeInfo, PartialEq, Eq)]
pub enum LockCtx {
    /// remove_liquidity: we are doing sequential payouts. Stage tells where we are.
    RemLiq {
        user: ActorId,
        liquidity: U256,
        amount_a: U256,
        amount_b: U256,
        stage: SendTokenStage,
    },
    /// swap: refund needs to be retried
    SwapRefund {
        user: ActorId,
        token: ActorId,
        amount: U256,
    },
    /// add_liquidity: refund needs to be retried
    AddLiqRefund {
        user: ActorId,
        token: ActorId,
        amount: U256,
    },
    MigrateAllLiquidity {
        target: ActorId,
        amount0: U256,
        amount1: U256,
        stage: SendTokenStage,
    },
    TreasuryPayout {
        treasury: ActorId,
        amount0: U256,
        amount1: U256,
        stage: SendTokenStage,
    },
    AdminPause,
}

#[derive(Debug, Clone, Encode, Decode, TypeInfo, PartialEq, Eq)]
pub enum SendTokenStage {
    SendToken0, // about to send token0
    SendToken1, // token0 already done, about to send token1 (critical if fails)
}
