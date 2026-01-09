use crate::services::pair::{
    Config, PairError,
    msg_tracker::{MessageStatus, MessageTracker, msg_tracker_mut},
    state_mut,
};
use extended_vft_client::vft::io::{Transfer, TransferFrom, BalanceOf};
use sails_rs::{U256, calls::ActionIo, gstd::msg, prelude::*};

pub async fn transfer_from(
    token_id: ActorId,
    sender: ActorId,
    receiver: ActorId,
    amount: U256,
    config: &Config,
    msg_id: MessageId,
) -> Result<(), PairError> {
    let bytes: Vec<u8> = TransferFrom::encode_call(sender, receiver, amount);

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
    let bytes: Vec<u8> = Transfer::encode_call(receiver, amount);

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
            if !reply {
                state.lock = false;
            }
        }
        MessageStatus::SendingMsgToLockTokenB => {
            let reply = decode_transfer_from_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenBLocked(reply));
        }
        MessageStatus::SendingMessageToReturnTokensA => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokensAReturnComplete(reply));
            state.lock = false;
        }
        MessageStatus::SendingMsgToTransferTokenIn => {
            let reply = decode_transfer_from_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenInTransfered(reply));
            if !reply {
                state.lock = false;
            }
        }
        MessageStatus::SendingMsgToTransferTokenOut => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenOutTransfered(reply));
        }
        MessageStatus::SendingMessageToReturnTokenIn => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenInReturnComplete(reply));
            state.lock = false;
        }
        MessageStatus::SendingMsgToUnlockTokenA => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenAUnlocked(reply));
        }
        MessageStatus::SendingMsgToUnlockTokenB => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TokenBUnlocked(reply));
        }
        MessageStatus::SendingTreasuryTokenA => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TreasuryTokenASent(reply));
        }

        MessageStatus::SendingTreasuryTokenB => {
            let reply = decode_transfer_reply(&reply_bytes);
            msg_tracker.update_msg_status(msg_id, MessageStatus::TreasuryTokenBSent(reply));
        }
        _ => {}
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
    let bytes: Vec<u8> = BalanceOf::encode_call(account_id);

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

    BalanceOf::decode_reply(&reply_bytes).map_err(|_| PairError::UnableToDecode)
}

/// Decode reply received from the TransferFrom method.
fn decode_transfer_from_reply(bytes: &[u8]) -> bool {
    TransferFrom::decode_reply(bytes).unwrap_or(false)
}
/// Decode reply received from the TransferFrom method.
fn decode_transfer_reply(bytes: &[u8]) -> bool {
    Transfer::decode_reply(bytes).unwrap_or(false)
}
