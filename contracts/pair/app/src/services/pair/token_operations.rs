use crate::services::pair::{
    Config, LockCtx, LockState, PairError, SendTokenStage,
    msg_tracker::{MessageStatus, MessageTracker, msg_tracker_mut},
    state_mut,
};
use extended_vft_client::vft::io::{BalanceOf, Transfer, TransferFrom};
use sails_rs::{U256, client::CallCodec, gstd::msg, prelude::*};

pub async fn transfer_from(
    token_id: ActorId,
    sender: ActorId,
    receiver: ActorId,
    amount: U256,
    config: &Config,
    msg_id: MessageId,
) -> Result<(), PairError> {
    let bytes: Vec<u8> = TransferFrom::encode_params_with_prefix("Vft", sender, receiver, amount);

    send_message_with_gas_for_reply(
        token_id,
        bytes,
        config.gas_for_token_ops,
        config.gas_for_reply_deposit,
        config.reply_timeout,
        msg_id,
    )
    .await
}

pub async fn transfer(
    token_id: ActorId,
    receiver: ActorId,
    amount: U256,
    config: &Config,
    msg_id: MessageId,
) -> Result<(), PairError> {
    let bytes: Vec<u8> = Transfer::encode_params_with_prefix("Vft", receiver, amount);

    send_message_with_gas_for_reply(
        token_id,
        bytes,
        config.gas_for_token_ops,
        config.gas_for_reply_deposit,
        config.reply_timeout,
        msg_id,
    )
    .await
}

/// Configure parameters for message sending and send message
/// asyncronously waiting for the reply.
///
/// It will set reply hook to the [handle_reply_hook] and
/// timeout to the `reply_timeout`.
async fn send_message_with_gas_for_reply(
    destination: ActorId,
    message: Vec<u8>,
    gas_to_send: u64,
    gas_deposit: u64,
    reply_timeout: u32,
    msg_id: MessageId,
) -> Result<(), PairError> {
    sails_rs::gstd::msg::send_bytes_with_gas_for_reply(
        destination,
        message,
        gas_to_send,
        0,
        gas_deposit,
    )
    .map_err(|_| PairError::SendFailure)?
    .up_to(Some(reply_timeout))
    .map_err(|_| PairError::ReplyTimeout)?
    .handle_reply(move || handle_reply_hook(msg_id))
    .map_err(|_| PairError::ReplyHook)?
    .await
    .map_err(|_| PairError::ReplyFailure)?;

    fetch_transfer_result(&*msg_tracker_mut(), &msg_id)
}

/// Handle reply received from `VFT` program.
///
/// It will drive [MessageTracker] state machine further.
fn handle_reply_hook(msg_id: MessageId) {
    let msg_tracker = msg_tracker_mut();
    let state = state_mut();

    let msg_status = msg_tracker
        .get_msg_status(&msg_id)
        .expect("Unexpected: msg info does not exist");
    let reply_bytes = msg::load_bytes().expect("Unable to load bytes");

    match msg_status {
        MessageStatus::SendingMsgToLockTokenA => {
            let reply = decode_transfer_from_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenALocked(reply));
            // If we failed to lock token A, the operation did not progress; release the lock.
            if !reply {
                state.lock = LockState::Free;
            }
        }
        MessageStatus::SendingMsgToLockTokenB => {
            let reply = decode_transfer_from_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenBLocked(reply));
        }
        MessageStatus::SendingMessageToReturnTokensA => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokensAReturnComplete(reply));

            // ADD-LIQUIDITY REFUND:
            // This is a "recovery/refund" path after add_liquidity partially failed.
            // If the refund transfer itself fails, funds may become stuck => pause for manual investigation.
            if !reply {
                pause_keep_ctx(&mut state.lock);
            } else {
                state.lock = LockState::Free;
            }
        }
        MessageStatus::SendingMsgToTransferTokenIn => {
            let reply = decode_transfer_from_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenInTransfered(reply));

            // If token_in could not be taken from the user, the swap did not start; release the lock.
            if !reply {
                state.lock = LockState::Free;
            }
        }
        MessageStatus::SendingMsgToTransferTokenOut => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenOutTransfered(reply));
            // lock stays Busy; failure handling is usually in later stages / refund
        }
        MessageStatus::SendingMessageToReturnTokenIn => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenInReturnComplete(reply));
            // SWAP REFUND:
            // This is a "recovery/refund" path. If refund fails, user funds may be stuck => pause for manual investigation.
            if !reply {
                pause_keep_ctx(&mut state.lock);
            } else {
                state.lock = LockState::Free;
            }
        }
        MessageStatus::SendingMsgToUnlockTokenA => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenAUnlocked(reply));
            // REMOVE LIQUIDITY:
            // Extremely rare but high-impact: failure to transfer underlying back to the user => pause for manual investigation/recovery.
            if reply {
                match &mut state.lock {
                    LockState::Busy(LockCtx::RemLiq { stage, .. })
                    | LockState::Busy(LockCtx::MigrateAllLiquidity { stage, .. }) => {
                        *stage = SendTokenStage::SendToken1;
                    }
                    _ => {}
                }
            } else {
                pause_keep_ctx(&mut state.lock);
            }
        }
        MessageStatus::SendingMsgToUnlockTokenB => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenBUnlocked(reply));
            // REMOVE LIQUIDITY:
            // Extremely rare but high-impact: failure to transfer underlying back to the user => pause for manual investigation/recovery.
            if !reply {
                pause_keep_ctx(&mut state.lock);
            }
        }
        MessageStatus::SendingTreasuryTokenA => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TreasuryTokenASent(reply));
            if reply {
                if let LockState::Busy(LockCtx::TreasuryPayout { stage, .. }) = &mut state.lock {
                    *stage = SendTokenStage::SendToken1;
                }
            } else {
                pause_keep_ctx(&mut state.lock);
            }
        }

        MessageStatus::SendingTreasuryTokenB => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TreasuryTokenBSent(reply));
            if !reply {
                pause_keep_ctx(&mut state.lock);
            }
        }
        _ => {}
    };
}

fn pause_keep_ctx(lock: &mut LockState) {
    *lock = match mem::replace(lock, LockState::Free) {
        LockState::Busy(ctx) => LockState::Paused(ctx),
        other => other,
    };
}

/// Fetch result of the message sent to transfer tokens into this program.
///
/// It will look for the specified [MessageId] in the [MessageTracker] and return result
/// based on this message state. The state should be present in the [MessageTracker] according
/// to the [handle_reply_hook] logic.
fn fetch_transfer_result(
    msg_tracker: &MessageTracker,
    msg_id: &MessageId,
) -> Result<(), PairError> {
    let status = msg_tracker
        .message_info
        .get(msg_id)
        .ok_or(PairError::MessageNotFound)?;

    let success = match status {
        MessageStatus::TokenALocked(success)
        | MessageStatus::TokenBLocked(success)
        | MessageStatus::TokensAReturnComplete(success)
        | MessageStatus::TokenInTransfered(success)
        | MessageStatus::TokenOutTransfered(success)
        | MessageStatus::TokenInReturnComplete(success)
        | MessageStatus::TokenAUnlocked(success)
        | MessageStatus::TreasuryTokenASent(success)
        | MessageStatus::TreasuryTokenBSent(success)
        | MessageStatus::TokenBUnlocked(success) => *success,
        _ => return Err(PairError::InvalidMessageStatus),
    };
    if success {
        Ok(())
    } else {
        Err(PairError::TokenTransferFailed)
    }
}

pub async fn balance_of(
    token_id: ActorId,
    account_id: ActorId,
    config: &Config,
) -> Result<U256, PairError> {
    let bytes: Vec<u8> = BalanceOf::encode_params_with_prefix("Vft", account_id);

    let reply_bytes = sails_rs::gstd::msg::send_bytes_with_gas_for_reply(
        token_id,
        bytes,
        config.gas_for_token_ops,
        0,
        config.gas_for_reply_deposit,
    )
    .map_err(|_| PairError::SendFailure)?
    .up_to(Some(config.reply_timeout))
    .map_err(|_| PairError::ReplyTimeout)?
    .await
    .map_err(|_| PairError::ReplyFailure)?;

    BalanceOf::decode_reply_with_prefix("Vft", &reply_bytes).map_err(|_| PairError::UnableToDecode)
}

/// Decode reply received from the TransferFrom method.
fn decode_transfer_from_reply(bytes: &[u8]) -> bool {
    TransferFrom::decode_reply_with_prefix("Vft", bytes).unwrap_or(false)
}
/// Decode reply received from the TransferFrom method.
fn decode_transfer_reply(bytes: &[u8]) -> bool {
    Transfer::decode_reply_with_prefix("Vft", bytes).unwrap_or(false)
}
