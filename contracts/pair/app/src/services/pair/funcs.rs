use crate::services::pair::{Config, LpExposure};
use crate::services::pair::{
    LockState, PairService,
    lock::{LockCtx, SendTokenStage},
};
use crate::services::pair::{
    PairError, PairEvent, State, amm_math, amm_math::TREASURY_FEE_BPS, msg_tracker::MessageStatus,
    token_operations,
};

const FEE_BPS: u64 = 3; // 0.3% fee (3/1000)
pub const LP_DEAD: [u8; 32] = [1u8; 32];
use sails_rs::{
    gstd::{exec, msg},
    prelude::*,
};

struct SwapDirection {
    token_in: ActorId,
    token_out: ActorId,
    reserve_in: U256,
    reserve_out: U256,
}

// Enum to define the type of swap operation
#[derive(Debug, Clone, Copy)]
pub enum SwapType {
    ExactInput {
        amount_in: U256,
        amount_out_min: U256,
    },
    ExactOutput {
        amount_out: U256,
        amount_in_max: U256,
    },
}

struct SwapFinalize {
    new_reserve0: U256,
    new_reserve1: U256,
    new_fee0: U256,
    new_fee1: U256,
}

impl<'a> PairService<'a> {
    pub async fn add_liquidity_core(
        &self,
        amount_a_desired: U256,
        amount_b_desired: U256,
        amount_a_min: U256,
        amount_b_min: U256,
        deadline: u64,
    ) -> Result<PairEvent, PairError> {
        let (token0, token1, reserve0, reserve1, config) = self.with_state_mut(|st| {
            if st.migrated {
                return Err(PairError::PoolMigrated);
            }
            if exec::gas_available() < st.config.gas_for_full_tx {
                return Err(PairError::NotEnoghAttachedGas);
            }
            if amount_a_desired.is_zero() || amount_b_desired.is_zero() {
                return Err(PairError::ZeroLiquidity);
            }
            if !st.lock.is_free() {
                return Err(PairError::AnotherTxInProgress);
            }
            if exec::block_timestamp() > deadline {
                return Err(PairError::DeadlineExpired);
            }

            Ok((
                st.token0,
                st.token1,
                st.reserve0,
                st.reserve1,
                st.config.clone(),
            ))
        })?;

        let sender = msg::source();
        let (amount_a, amount_b) = amm_math::calculate_optimal_amounts(
            reserve0,
            reserve1,
            amount_a_desired,
            amount_b_desired,
            amount_a_min,
            amount_b_min,
        )?;
        self.with_state_mut(|st| {
            st.lock = LockState::Busy(LockCtx::AddLiqRefund {
                user: sender,
                token: token0,
                amount: amount_a,
            });
        });
        let _ = self.lp.pause.pause();
        self.transfer_tokens_to_pool(sender, token0, token1, amount_a, amount_b, &config)
            .await?;
        let _ = self.lp.pause.resume();
        // mint protocol fee (if fee_on)
        {
            let mut lp = self.lp_service();
            self.with_state_mut(|st| mint_fee_lp(st, &mut lp))
                .map_err(|_| PairError::Overflow)?;
        }
        // compute liquidity with total_supply AFTER protocol fee mint
        let mut lp = self.lp_service();
        let total_supply = lp.total_supply().unwrap_or(U256::zero());
        let (reserve0_now, reserve1_now) = self.with_state(|st| (st.reserve0, st.reserve1));
        let liquidity = amm_math::calculate_liquidity(
            reserve0_now,
            reserve1_now,
            amount_a,
            amount_b,
            total_supply,
        )?;
        // mint MINIMUM_LIQUIDITY once (to dead address), then mint user liquidity
        {
            if total_supply.is_zero() {
                mint_liquidity(
                    &mut lp,
                    LP_DEAD.into(),
                    U256::from(amm_math::MINIMUM_LIQUIDITY),
                )?
            }
            mint_liquidity(&mut lp, sender, liquidity)?;
        }

        // update reserves + k_last + unlock
        self.with_state_mut(|st| {
            st.reserve0 = st
                .reserve0
                .checked_add(amount_a)
                .ok_or(PairError::Overflow)?;
            st.reserve1 = st
                .reserve1
                .checked_add(amount_b)
                .ok_or(PairError::Overflow)?;

            // fee_on is "fee_to != 0" as in Uniswap V2
            if !st.fee_to.is_zero() {
                st.k_last = st
                    .reserve0
                    .checked_mul(st.reserve1)
                    .ok_or(PairError::Overflow)?;
            }

            st.lock.set_free();
            Ok::<_, PairError>(())
        })?;

        // resume LP user ops when Free
        let _ = self.lp.pause.resume();

        Ok(PairEvent::LiquidityAdded {
            user_id: sender,
            amount_a,
            amount_b,
            liquidity,
        })
    }

    pub async fn remove_liquidity_core(
        &self,
        liquidity: U256,
        amount_a_min: U256,
        amount_b_min: U256,
        deadline: u64,
    ) -> Result<PairEvent, PairError> {
        self.with_state(|st| {
            if exec::gas_available() < st.config.gas_for_full_tx {
                return Err(PairError::NotEnoghAttachedGas);
            }

            if st.migrated {
                return Err(PairError::PoolMigrated);
            }

            if liquidity.is_zero() {
                return Err(PairError::ZeroLiquidity);
            }
            // Check if transaction deadline has passed
            if exec::block_timestamp() > deadline {
                return Err(PairError::DeadlineExpired);
            }

            if !st.lock.is_free() {
                return Err(PairError::AnotherTxInProgress);
            }
            Ok::<_, PairError>(())
        })?;

        let sender = msg::source();
        // Verify user has sufficient LP tokens
        let user_balance = self.lp_service().balance_of(sender).unwrap_or(U256::zero());
        if user_balance < liquidity {
            return Err(PairError::InsufficientLiquidity);
        }

        let total_supply = self.lp_service().total_supply().unwrap_or(U256::zero());
        if total_supply.is_zero() {
            return Err(PairError::InsufficientLiquidity);
        }

        let (token0, token1, config, amount_a, amount_b) = self.with_state_mut(
            |st| -> Result<(ActorId, ActorId, Config, U256, U256), PairError> {
                // protocol fee (view) — не меняем state
                let lp_protocol_fee = calculate_protocol_fee(st, total_supply)?;

                // Calculate proportional amounts of underlying tokens to return
                // Formula: user_amount = (liquidity_to_burn * reserve) / total_supply
                let amount_a = liquidity
                    .checked_mul(st.reserve0)
                    .and_then(|result| result.checked_div(total_supply + lp_protocol_fee))
                    .ok_or(PairError::Overflow)?;

                let amount_b = liquidity
                    .checked_mul(st.reserve1)
                    .and_then(|result| result.checked_div(total_supply + lp_protocol_fee))
                    .ok_or(PairError::Overflow)?;

                // Slippage protection: ensure user receives at least minimum amounts
                if amount_a < amount_a_min {
                    return Err(PairError::InsufficientAmountA);
                }
                if amount_b < amount_b_min {
                    return Err(PairError::InsufficientAmountB);
                }

                if amount_a.is_zero() || amount_b.is_zero() {
                    return Err(PairError::InsufficientLiquidityBurned);
                }
                // Sanity check: ensure pool has sufficient reserves
                if amount_a > st.reserve0 || amount_b > st.reserve1 {
                    return Err(PairError::InsufficientLiquidity);
                }
                st.lock = LockState::Busy(LockCtx::RemLiq {
                    user: sender,
                    liquidity,
                    amount_a,
                    amount_b,
                    stage: SendTokenStage::SendToken0,
                });
                Ok((st.token0, st.token1, st.config.clone(), amount_a, amount_b))
            },
        )?;

        // Transfer underlying tokens back to user
        self.return_tokens_from_pool(token0, token1, sender, amount_a, amount_b, &config)
            .await?;

        self.with_state_mut(|st| -> Result<(), PairError> {
            let mut lp = self.lp_service();

            mint_fee_lp(st, &mut lp)?;

            burn_liquidity(&mut lp, sender, liquidity)?;
            st.reserve0 = st
                .reserve0
                .checked_sub(amount_a)
                .ok_or(PairError::Overflow)?;
            st.reserve1 = st
                .reserve1
                .checked_sub(amount_b)
                .ok_or(PairError::Overflow)?;

            if !st.fee_to.is_zero() {
                st.k_last = st
                    .reserve0
                    .checked_mul(st.reserve1)
                    .ok_or(PairError::Overflow)?;
            } else if !st.k_last.is_zero() {
                st.k_last = U256::zero();
            }
            // unlock + cleanup
            st.lock.set_free();
            Ok(())
        })?;

        Ok(PairEvent::LiquidityRemoved {
            user_id: sender,
            amount_a,
            amount_b,
            liquidity,
        })
    }

    pub async fn migrate_all_liquidity_core(
        &self,
        target: ActorId,
    ) -> Result<PairEvent, PairError> {
        let (token0, token1, config) = self.with_state(|st| {
            if st.migrated {
                return Err(PairError::PoolMigrated);
            }

            if !self.is_admin(&msg::source()) {
                return Err(PairError::Unauthorized);
            }

            if exec::gas_available() < st.config.gas_for_full_tx {
                return Err(PairError::NotEnoghAttachedGas);
            }

            if !st.lock.is_free() {
                return Err(PairError::AnotherTxInProgress);
            }
            Ok((st.token0, st.token1, st.config.clone()))
        })?;

        let program_id = exec::program_id();

        self.with_state_mut(|st| {
            st.lock = LockState::Busy(LockCtx::MigrateAllLiquidity {
                target,
                amount0: U256::zero(),
                amount1: U256::zero(),
                stage: SendTokenStage::SendToken0,
            });
        });

        let balance0 = token_operations::balance_of(token0, program_id, &config).await?;
        let balance1 = token_operations::balance_of(token1, program_id, &config).await?;

        if balance0.is_zero() && balance1.is_zero() {
            self.with_state_mut(|st| {
                st.lock.set_free();
            });
            return Ok(PairEvent::NoLiquidityToMigrate);
        }

        self.with_state_mut(|st| {
            st.lock = LockState::Busy(LockCtx::MigrateAllLiquidity {
                target,
                amount0: balance0,
                amount1: balance1,
                stage: SendTokenStage::SendToken0,
            });
        });
        self.return_tokens_from_pool(token0, token1, target, balance0, balance1, &config)
            .await?;

        self.with_state_mut(|st| {
            st.reserve0 = U256::zero();
            st.reserve1 = U256::zero();
            st.k_last = U256::zero();
            st.accrued_treasury_fee0 = U256::zero();
            st.accrued_treasury_fee1 = U256::zero();
            st.migrated = true;
        });

        Ok(PairEvent::LiquidityMigrated {
            to: target,
            amount0: balance0,
            amount1: balance1,
        })
    }

    pub async fn swap_exact_tokens_for_tokens_core(
        &self,
        amount_in: U256,
        amount_out_min: U256,
        is_token0_to_token1: bool,
        deadline: u64,
    ) -> Result<PairEvent, PairError> {
        self.swap_tokens(
            SwapType::ExactInput {
                amount_in,
                amount_out_min,
            },
            is_token0_to_token1,
            deadline,
        )
        .await
    }

    pub async fn swap_tokens_for_exact_tokens_core(
        &self,
        amount_out: U256,
        amount_in_max: U256,
        is_token0_to_token1: bool,
        deadline: u64,
    ) -> Result<PairEvent, PairError> {
        self.swap_tokens(
            SwapType::ExactOutput {
                amount_out,
                amount_in_max,
            },
            is_token0_to_token1,
            deadline,
        )
        .await
    }

    pub async fn swap_tokens(
        &self,
        swap_type: SwapType,
        is_token0_to_token1: bool,
        deadline: u64,
    ) -> Result<PairEvent, PairError> {
        // ---------- PREPARE: читаем state копиями и валидируем ----------
        let (token_in, token_out, reserve_in, reserve_out, treasury_fee_bps) =
            self.with_state(|st| {
                if st.migrated {
                    return Err(PairError::PoolMigrated);
                }
                if exec::gas_available() < st.config.gas_for_full_tx {
                    return Err(PairError::NotEnoghAttachedGas);
                }
                if !st.lock.is_free() {
                    return Err(PairError::AnotherTxInProgress);
                }
                if exec::block_timestamp() > deadline {
                    return Err(PairError::DeadlineExpired);
                }

                let treasury_fee_bps = if st.treasury_id.is_zero() {
                    0
                } else {
                    TREASURY_FEE_BPS
                };

                let (token_in, token_out, reserve_in, reserve_out) = if is_token0_to_token1 {
                    (st.token0, st.token1, st.reserve0, st.reserve1)
                } else {
                    (st.token1, st.token0, st.reserve1, st.reserve0)
                };

                Ok((
                    token_in,
                    token_out,
                    reserve_in,
                    reserve_out,
                    treasury_fee_bps,
                ))
            })?;

        let swap_direction = SwapDirection {
            token_in,
            token_out,
            reserve_in,
            reserve_out,
        };

        let (amount_in_for_pool, amount_in_total, amount_out, treasury_fee) = match swap_type {
            SwapType::ExactInput {
                amount_in,
                amount_out_min,
            } => {
                let (in_for_pool, out, t_fee) = amm_math::get_amount_out_with_treasury(
                    amount_in,
                    reserve_in,
                    reserve_out,
                    treasury_fee_bps,
                )?;

                if out < amount_out_min {
                    return Err(PairError::InsufficientAmount);
                }

                (in_for_pool, amount_in, out, t_fee)
            }
            SwapType::ExactOutput {
                amount_out,
                amount_in_max,
            } => {
                let (in_for_pool, in_total, t_fee) = amm_math::get_amount_in_with_treasury(
                    amount_out,
                    swap_direction.reserve_in,
                    swap_direction.reserve_out,
                    treasury_fee_bps,
                )?;

                if in_total > amount_in_max {
                    return Err(PairError::ExcessiveInputAmount);
                }

                (in_for_pool, in_total, amount_out, t_fee)
            }
        };

        if amount_out > swap_direction.reserve_out {
            return Err(PairError::InsufficientLiquidity);
        }

        self.execute_swap(
            &swap_direction,
            amount_in_for_pool,
            amount_in_total,
            amount_out,
            treasury_fee,
            is_token0_to_token1,
        )
        .await
    }
    async fn execute_swap(
        &self,
        swap_direction: &SwapDirection,
        amount_in_for_pool: U256,
        amount_in_total: U256,
        amount_out: U256,
        treasury_fee: U256,
        is_token0_to_token1: bool,
    ) -> Result<PairEvent, PairError> {
        let sender = msg::source();

        // PREPARE
        // Calculate new reserves/fee, check invariant, set lock=Busy
        let (finalize, token_in, token_out, config) = self.with_state_mut(
            |st| -> Result<(SwapFinalize, ActorId, ActorId, Config), PairError> {
                // new reserves
                let (new_reserve0, new_reserve1) = if is_token0_to_token1 {
                    (
                        st.reserve0
                            .checked_add(amount_in_for_pool)
                            .ok_or(PairError::Overflow)?,
                        st.reserve1
                            .checked_sub(amount_out)
                            .ok_or(PairError::Overflow)?,
                    )
                } else {
                    (
                        st.reserve0
                            .checked_sub(amount_out)
                            .ok_or(PairError::Overflow)?,
                        st.reserve1
                            .checked_add(amount_in_for_pool)
                            .ok_or(PairError::Overflow)?,
                    )
                };

                // new treasury accumulators (apply only on success later)
                let mut new_fee0 = st.accrued_treasury_fee0;
                let mut new_fee1 = st.accrued_treasury_fee1;

                if !treasury_fee.is_zero() && !st.treasury_id.is_zero() {
                    if is_token0_to_token1 {
                        new_fee0 = new_fee0
                            .checked_add(treasury_fee)
                            .ok_or(PairError::Overflow)?;
                    } else {
                        new_fee1 = new_fee1
                            .checked_add(treasury_fee)
                            .ok_or(PairError::Overflow)?;
                    }
                }

                // invariant inputs
                let (amount0_in, amount1_in) = if is_token0_to_token1 {
                    (amount_in_for_pool, U256::zero())
                } else {
                    (U256::zero(), amount_in_for_pool)
                };

                verify_constant_product_invariant(
                    new_reserve0,
                    new_reserve1,
                    amount0_in,
                    amount1_in,
                    st.reserve0,
                    st.reserve1,
                )?;

                // lock context for refund path
                st.lock = LockState::Busy(LockCtx::SwapRefund {
                    user: sender,
                    token: swap_direction.token_in,
                    amount: amount_in_total,
                });

                let _ = self.lp.pause.pause();

                Ok((
                    SwapFinalize {
                        new_reserve0,
                        new_reserve1,
                        new_fee0,
                        new_fee1,
                    },
                    swap_direction.token_in,
                    swap_direction.token_out,
                    st.config.clone(),
                ))
            },
        )?;

        // ---------- IO (await) — без borrow state ----------
        self.execute_swap_transfers(
            sender,
            token_in,
            amount_in_total,
            token_out,
            amount_out,
            &config,
        )
        .await?;

        // ---------- FINALIZE (короткий borrow) ----------
        self.with_state_mut(|st| {
            st.reserve0 = finalize.new_reserve0;
            st.reserve1 = finalize.new_reserve1;
            st.accrued_treasury_fee0 = finalize.new_fee0;
            st.accrued_treasury_fee1 = finalize.new_fee1;

            st.lock.set_free();
        });

        let _ = self.lp.pause.resume();
        self.with_tracker_mut(|tr| tr.clear_all());

        Ok(PairEvent::Swap {
            user_id: sender,
            amount_in: amount_in_total,
            amount_out,
            is_token0_to_token1,
        })
    }

    pub async fn send_treasury_fees_from_pool(&self) -> Result<PairEvent, PairError> {
        let caller = msg::source();
        let msg_id = msg::id();

        let (token0, token1, treasury_id, amount_a, amount_b, config) = self.with_state_mut(
            |st| -> Result<(ActorId, ActorId, ActorId, U256, U256, Config), PairError> {
                if st.migrated {
                    return Err(PairError::PoolMigrated);
                }
                if caller != st.treasury_id {
                    return Err(PairError::NotTreasuryId);
                }
                if exec::gas_available() < st.config.gas_for_full_tx {
                    return Err(PairError::NotEnoghAttachedGas);
                }
                if !st.lock.is_free() {
                    return Err(PairError::AnotherTxInProgress);
                }

                let amount_a = st.accrued_treasury_fee0;
                let amount_b = st.accrued_treasury_fee1;

                if amount_a.is_zero() && amount_b.is_zero() {
                    return Err(PairError::NoTreasuryFees);
                }

                let treasury_id = st.treasury_id;

                st.lock = LockState::Busy(LockCtx::TreasuryPayout {
                    treasury: treasury_id,
                    amount0: amount_a,
                    amount1: amount_b,
                    stage: if amount_a.is_zero() {
                        SendTokenStage::SendToken1
                    } else {
                        SendTokenStage::SendToken0
                    },
                });

                let _ = self.lp.pause.pause();

                Ok((
                    st.token0,
                    st.token1,
                    treasury_id,
                    amount_a,
                    amount_b,
                    st.config.clone(),
                ))
            },
        )?;

        self.with_tracker_mut(|tr| {
            tr.insert_msg_status(msg_id, MessageStatus::SendingTreasuryTokenA);
        });

        if !amount_a.is_zero() {
            self.transfer(token0, treasury_id, amount_a, &config, msg_id)
                .await
                .map_err(|_| PairError::TokenTransferFailed)?;
        }

        self.with_tracker_mut(|tr| {
            tr.insert_msg_status(msg_id, MessageStatus::SendingTreasuryTokenB);
        });

        if !amount_b.is_zero() {
            self.transfer(token1, treasury_id, amount_b, &config, msg_id)
                .await
                .map_err(|_| PairError::TokenTransferFailed)?;
        }

        self.with_state_mut(|st| {
            st.accrued_treasury_fee0 = U256::zero();
            st.accrued_treasury_fee1 = U256::zero();
            st.lock.set_free();
        });

        let _ = self.lp.pause.resume();
        self.with_tracker_mut(|tr| tr.clear_all());

        Ok(PairEvent::TreasuryFeesCollected {
            treasury_id,
            amount_a,
            amount_b,
        })
    }

    pub async fn recover_paused_core(&self) -> Result<Option<PairEvent>, PairError> {
        let caller = msg::source();

        if !self.is_admin(&caller) {
            return Err(PairError::Unauthorized);
        }
        let (ctx, token1, config) = self.with_state(|st| {
            let ctx = match st.lock.clone() {
                LockState::Paused(ctx) => ctx,
                _ => return Err(PairError::NotPaused),
            };
            Ok((ctx, st.token1, st.config.clone()))
        })?;

        let clear_tracker = || {
            self.with_tracker_mut(|tr| tr.clear_all());
        };

        match ctx {
            // -------------------------
            // 1) Add liquidity refund retry
            // -------------------------
            LockCtx::AddLiqRefund {
                user,
                token,
                amount,
            } => {
                let msg_id = msg::id();
                self.with_tracker_mut(|tr| {
                    tr.insert_msg_status(msg_id, MessageStatus::SendingMessageToReturnTokensA);
                });

                self.transfer(token, user, amount, &config, msg_id).await?;

                self.with_state_mut(|st| {
                    st.lock.set_free();
                });
                let _ = self.lp.pause.resume();
                clear_tracker();
            }
            // -------------------------
            // 2) Swap refund retry
            // -------------------------
            LockCtx::SwapRefund {
                user,
                token,
                amount,
            } => {
                let msg_id = msg::id();
                self.with_tracker_mut(|tr| {
                    tr.insert_msg_status(msg_id, MessageStatus::SendingMessageToReturnTokenIn);
                });

                self.transfer(token, user, amount, &config, msg_id).await?;

                self.with_state_mut(|st| {
                    st.lock.set_free();
                });
                let _ = self.lp.pause.resume();
                clear_tracker();
            }
            // -------------------------
            // 3) Remove liquidity recovery (only SendToken1)
            // -------------------------
            LockCtx::RemLiq {
                user,
                liquidity,
                amount_a,
                amount_b,
                stage,
            } => {
                if stage != SendTokenStage::SendToken1 {
                    return Err(PairError::InvalidRecoveryState);
                }

                // finish missing payout (token1)
                let msg_id = msg::id();
                self.with_tracker_mut(|tr| {
                    tr.insert_msg_status(msg_id, MessageStatus::SendingMsgToUnlockTokenB);
                });

                self.transfer(token1, user, amount_b, &config, msg_id)
                    .await?;

                let _ = self.lp.pause.resume();
                // finalize exactly-once: mint_fee -> burn -> reserves -> k_last
                let event = self.with_state_mut(|st| -> Result<PairEvent, PairError> {
                    let mut lp = self.lp_service();
                    mint_fee_lp(st, &mut lp)?;
                    burn_liquidity(&mut lp, user, liquidity)?;

                    st.reserve0 = st
                        .reserve0
                        .checked_sub(amount_a)
                        .ok_or(PairError::Overflow)?;
                    st.reserve1 = st
                        .reserve1
                        .checked_sub(amount_b)
                        .ok_or(PairError::Overflow)?;

                    if !st.fee_to.is_zero() {
                        set_new_k_last(st)?;
                    }

                    st.lock.set_free();
                    Ok(PairEvent::LiquidityRemoved {
                        user_id: user,
                        amount_a,
                        amount_b,
                        liquidity,
                    })
                })?;
                clear_tracker();
                return Ok(Some(event));
            }
            // -------------------------
            // 4) Migrate liquidity recovery (only SendToken1)
            // -------------------------
            LockCtx::MigrateAllLiquidity {
                target,
                amount0,
                amount1,
                stage,
            } => {
                if stage != SendTokenStage::SendToken1 {
                    return Err(PairError::InvalidRecoveryState);
                }

                let msg_id = msg::id();
                self.with_tracker_mut(|tr| {
                    tr.insert_msg_status(msg_id, MessageStatus::SendingMsgToUnlockTokenB);
                });

                self.transfer(token1, target, amount1, &config, msg_id)
                    .await?;

                let event = self.with_state_mut(|st| -> Result<PairEvent, PairError> {
                    st.reserve0 = U256::zero();
                    st.reserve1 = U256::zero();
                    st.k_last = U256::zero();
                    st.accrued_treasury_fee0 = U256::zero();
                    st.accrued_treasury_fee1 = U256::zero();
                    st.migrated = true;
                    st.lock.set_free();

                    Ok(PairEvent::LiquidityMigrated {
                        to: target,
                        amount0,
                        amount1,
                    })
                })?;

                let _ = self.lp.pause.resume();
                clear_tracker();
                return Ok(Some(event));
            }
            // -------------------------
            // 5) Treasury payout recovery (only SendToken1)
            // -------------------------
            LockCtx::TreasuryPayout {
                treasury,
                amount0,
                amount1,
                stage,
            } => {
                if stage != SendTokenStage::SendToken1 {
                    return Err(PairError::InvalidRecoveryState);
                }

                let msg_id = msg::id();
                self.with_tracker_mut(|tr| {
                    tr.insert_msg_status(msg_id, MessageStatus::SendingTreasuryTokenB);
                });

                self.transfer(token1, treasury, amount1, &config, msg_id)
                    .await?;

                let event = self.with_state_mut(|st| -> Result<PairEvent, PairError> {
                    st.accrued_treasury_fee0 = U256::zero();
                    st.accrued_treasury_fee1 = U256::zero();
                    st.lock.set_free();

                    Ok(PairEvent::TreasuryFeesCollected {
                        treasury_id: treasury,
                        amount_a: amount0,
                        amount_b: amount1,
                    })
                })?;

                let _ = self.lp.pause.resume();
                clear_tracker();
                return Ok(Some(event));
            }
            // -------------------------
            // 6) Admin pause - just unlock
            // -------------------------
            LockCtx::AdminPause => {
                self.with_state_mut(|st| {
                    st.lock.set_free();
                });
                let _ = self.lp.pause.resume();
                clear_tracker();
            }
        }
        Ok(None)
    }
    async fn transfer_tokens_to_pool(
        &self,
        sender: ActorId,
        token0: ActorId,
        token1: ActorId,
        amount_a: U256,
        amount_b: U256,
        config: &Config,
    ) -> Result<(), PairError> {
        let program_id = exec::program_id();
        let msg_id = msg::id();

        self.with_tracker_mut(|tr| {
            tr.insert_msg_status(msg_id, MessageStatus::SendingMsgToLockTokenA);
        });

        self.transfer_from(token0, sender, program_id, amount_a, config, msg_id)
            .await?;

        self.with_tracker_mut(|tr| {
            tr.insert_msg_status(msg_id, MessageStatus::SendingMsgToLockTokenB);
        });

        let result = self
            .transfer_from(token1, sender, program_id, amount_b, config, msg_id)
            .await;

        if result.is_err() {
            self.with_tracker_mut(|tr| {
                tr.insert_msg_status(msg_id, MessageStatus::SendingMessageToReturnTokensA);
            });

            self.transfer(token0, sender, amount_a, config, msg_id)
                .await?;
            return Err(PairError::TokenTransferFailed);
        }
        self.with_tracker_mut(|tr| tr.clear_all());

        Ok(())
    }

    async fn return_tokens_from_pool(
        &self,
        token0: ActorId,
        token1: ActorId,
        sender: ActorId,
        amount_a: U256,
        amount_b: U256,
        config: &Config,
    ) -> Result<(), PairError> {
        let msg_id = msg::id();

        self.with_tracker_mut(|tr| {
            tr.insert_msg_status(msg_id, MessageStatus::SendingMsgToUnlockTokenA);
        });
        let _ = self.lp.pause.pause();

        self.transfer(token0, sender, amount_a, config, msg_id)
            .await?;

        self.with_tracker_mut(|tr| {
            tr.insert_msg_status(msg_id, MessageStatus::SendingMsgToUnlockTokenB);
        });

        self.transfer(token1, sender, amount_b, config, msg_id)
            .await?;

        let _ = self.lp.pause.resume();
        self.with_tracker_mut(|tr| tr.clear_all());
        Ok(())
    }

    async fn execute_swap_transfers(
        &self,
        sender: ActorId,
        token_in: ActorId,
        amount_in: U256,
        token_out: ActorId,
        amount_out: U256,
        config: &Config,
    ) -> Result<(), PairError> {
        let program_id = exec::program_id();
        let msg_id = msg::id();

        self.with_tracker_mut(|tr| {
            tr.insert_msg_status(msg_id, MessageStatus::SendingMsgToTransferTokenIn);
        });

        // Receive input tokens from user
        self.transfer_from(token_in, sender, program_id, amount_in, config, msg_id)
            .await?;

        self.with_tracker_mut(|tr| {
            tr.insert_msg_status(msg_id, MessageStatus::SendingMsgToTransferTokenOut);
        });
        // Send output tokens to user
        let result = self
            .transfer(token_out, sender, amount_out, config, msg_id)
            .await;

        // Very unlikely
        if result.is_err() {
            self.with_tracker_mut(|tr| {
                tr.insert_msg_status(msg_id, MessageStatus::SendingMessageToReturnTokenIn);
            });
            // transfer tokens back
            self.transfer(token_in, sender, amount_in, config, msg_id)
                .await?;
            return Err(PairError::TokenTransferFailed);
        }

        Ok(())
    }
}

/// Calculates and mints protocol fees for the liquidity pool, similar to Uniswap V2.
///
/// This function checks if protocol fees are enabled (via `fee_to` address) and calculates
/// the growth in pool reserves due to accumulated swap fees (0.3% per swap, with 1/6 or
/// 0.05% going to the protocol). If growth is detected, it mints new liquidity tokens (LP tokens)
/// to the `fee_to` address, proportional to the increase in the square root of the constant
/// product (`reserve0 * reserve1`). If protocol fees are disabled, it resets `k_last` to zero
/// to prevent future minting unless re-enabled.
///
/// Called internally before adding (`mint`) or removing (`burn`) liquidity to
/// ensure protocol fees from accumulated swaps are accounted for.
fn mint_fee_lp(state: &mut State, lp: &mut LpExposure<'_>) -> Result<(), PairError> {
    let fee_to = state.fee_to;
    let k_last = state.k_last;
    let fee_on = !fee_to.is_zero();

    if fee_on {
        if !k_last.is_zero() {
            let current_k = state
                .reserve0
                .checked_mul(state.reserve1)
                .ok_or(PairError::Overflow)?;

            let root_k = current_k.integer_sqrt();
            let root_k_last = k_last.integer_sqrt();

            if root_k > root_k_last {
                let root_k_diff = root_k - root_k_last;

                // total_supply from balances (bypass pause)
                let total_supply = lp.total_supply().unwrap_or(U256::zero());

                let numerator = total_supply
                    .checked_mul(root_k_diff)
                    .ok_or(PairError::Overflow)?;

                let root_k_times_5 = root_k
                    .checked_mul(U256::from(5))
                    .ok_or(PairError::Overflow)?;

                let denominator = root_k_times_5
                    .checked_add(root_k_last)
                    .ok_or(PairError::Overflow)?;

                let liquidity = numerator / denominator;

                if !liquidity.is_zero() {
                    mint_liquidity(lp, fee_to, liquidity)?;
                }
            }
        }
    } else if !k_last.is_zero() {
        state.k_last = U256::zero();
    }

    Ok(())
}

/// Verifies the constant product invariant (k) after a swap, accounting for a 0.3% fee.
/// Ensures that (balance0 * 1000 - amount0_in * 3) * (balance1 * 1000 - amount1_in * 3) >= reserve0 * reserve1 * 1000^2.
/// # Arguments
/// * `balance0` - New balance of token0 after swap
/// * `balance1` - New balance of token1 after swap
/// * `amount0_in` - Input amount of token0
/// * `amount1_in` - Input amount of token1
/// * `reserve0` - Reserve of token0 before swap
/// * `reserve1` - Reserve of token1 before swap
pub fn verify_constant_product_invariant(
    balance0: U256,
    balance1: U256,
    amount0_in: U256,
    amount1_in: U256,
    reserve0: U256,
    reserve1: U256,
) -> Result<(), PairError> {
    let thousand = U256::from(1000);
    let fee = U256::from(FEE_BPS);

    // Calculate adjusted balances: balance * 1000 - amount_in * 3
    let balance0_adjusted = balance0
        .checked_mul(thousand)
        .ok_or(PairError::Overflow)?
        .checked_sub(amount0_in.checked_mul(fee).ok_or(PairError::Overflow)?)
        .ok_or(PairError::Overflow)?;

    let balance1_adjusted = balance1
        .checked_mul(thousand)
        .ok_or(PairError::Overflow)?
        .checked_sub(amount1_in.checked_mul(fee).ok_or(PairError::Overflow)?)
        .ok_or(PairError::Overflow)?;

    // Calculate new constant product: balance0_adjusted * balance1_adjusted
    let k_new = balance0_adjusted
        .checked_mul(balance1_adjusted)
        .ok_or(PairError::Overflow)?;

    // Calculate old constant product: reserve0 * reserve1 * 1000*1000
    let k_old = reserve0
        .checked_mul(reserve1)
        .ok_or(PairError::Overflow)?
        .checked_mul(thousand * thousand)
        .ok_or(PairError::Overflow)?;

    // Verify invariant
    if k_new < k_old {
        return Err(PairError::InvariantViolation);
    }

    Ok(())
}

fn mint_liquidity(
    lp: &mut LpExposure<'_>,
    sender: ActorId,
    liquidity: U256,
) -> Result<(), PairError> {
    lp.mint_internal(sender, liquidity)
        .map_err(|_| PairError::Overflow)?;
    Ok(())
}

/// Burns LP tokens from user's balance
fn burn_liquidity(
    lp: &mut LpExposure<'_>,
    from: ActorId,
    liquidity: U256,
) -> Result<(), PairError> {
    lp.burn_internal(from, liquidity)
        .map_err(|_| PairError::Overflow)?;
    Ok(())
}

fn set_new_k_last(state: &mut State) -> Result<(), PairError> {
    state.k_last = state
        .reserve0
        .checked_mul(state.reserve1)
        .ok_or(PairError::Overflow)?;
    Ok(())
}

pub fn calculate_protocol_fee(state: &State, total_supply: U256) -> Result<U256, PairError> {
    let fee_to = state.fee_to;
    let fee_on = !fee_to.is_zero();
    let k_last = state.k_last;

    if !fee_on {
        return Ok(U256::zero());
    }

    if k_last.is_zero() {
        return Ok(U256::zero());
    }

    let current_k = state
        .reserve0
        .checked_mul(state.reserve1)
        .ok_or(PairError::Overflow)?;

    let root_k = current_k.integer_sqrt();
    let root_k_last = k_last.integer_sqrt();

    if root_k <= root_k_last {
        return Ok(U256::zero());
    }

    let root_k_diff = root_k - root_k_last;

    let numerator = total_supply
        .checked_mul(root_k_diff)
        .ok_or(PairError::Overflow)?;

    let root_k_times_5 = root_k
        .checked_mul(U256::from(5))
        .ok_or(PairError::Overflow)?;

    let denominator = root_k_times_5
        .checked_add(root_k_last)
        .ok_or(PairError::Overflow)?;

    let liquidity = numerator / denominator;

    Ok(liquidity)
}

/// Calculates accumulated swap fees for all LP providers, similar to Uniswap V2.
///
/// This function calculates the total growth in pool reserves due to swap fees (0.3% per swap),
/// subtracts the protocol share (1/6 or 0.05%), and returns the remaining fees (0.25%) as the
/// equivalent LP token value for all providers combined. Returns 0 if no growth or fees disabled.
///
/// Can be called for estimation. Does not modify state.
pub fn calculate_lp_fee(state: &State, total_supply: U256) -> Result<U256, PairError> {
    let protocol_fee = calculate_protocol_fee(state, total_supply)?;

    if protocol_fee.is_zero() {
        return Ok(U256::zero());
    }

    // LP fees = total growth - protocol fee (5/6 of growth)
    let total_growth = /* Calculate total growth, e.g., from root_k_diff * denominator / 6 or similar; for simplicity, assume protocol is 1/6 */
        protocol_fee.checked_mul(U256::from(5)).ok_or(PairError::Overflow)?;

    Ok(total_growth)
}

pub fn calculate_lp_user_fee(
    state: &State,
    user_lp_balance: U256,
    total_supply: U256,
) -> Result<U256, PairError> {
    let total_lp_fee = calculate_lp_fee(state, total_supply)?;

    if total_lp_fee.is_zero() {
        return Ok(U256::zero());
    }

    if total_supply.is_zero() {
        return Ok(U256::zero());
    }

    let user_share = user_lp_balance
        .checked_mul(total_lp_fee)
        .ok_or(PairError::Overflow)?
        / total_supply;

    Ok(user_share)
}

pub fn calculate_remove_liquidity(
    state: &State,
    liquidity: U256,
    total_supply: U256,
) -> Result<(U256, U256), PairError> {
    if exec::gas_available() < state.config.gas_for_full_tx {
        return Err(PairError::NotEnoghAttachedGas);
    }
    if !state.lock.is_free() {
        return Err(PairError::AnotherTxInProgress);
    }
    if liquidity.is_zero() {
        return Ok((U256::zero(), U256::zero()));
    }

    // Simulate protocol fee dilution (calculate potential increase in total_supply)
    let protocol_fee = calculate_protocol_fee(state, total_supply)?;
    let simulated_total_supply = total_supply + protocol_fee; // Dilution from mint_fee

    // Calculate amounts based on reserves (assuming they include swap fees)
    let amount0 = liquidity
        .checked_mul(state.reserve0)
        .ok_or(PairError::Overflow)?
        / simulated_total_supply;
    let amount1 = liquidity
        .checked_mul(state.reserve1)
        .ok_or(PairError::Overflow)?
        / simulated_total_supply;

    Ok((amount0, amount1))
}
