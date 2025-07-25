use crate::services::pair::{Config, PairError};
use extended_vft_client::vft::io::TransferFrom;
use sails_rs::{U256, gstd::exec, prelude::*};

pub async fn transfer_from(
    token_id: ActorId,
    sender: ActorId,
    receiver: ActorId,
    amount: U256,
    config: &Config,
    //  msg_id: MessageId,
) -> Result<(), PairError> {
    let bytes: Vec<u8> = TransferFrom::encode_call(sender, receiver, amount);

    send_message_with_gas_for_reply(
        token_id,
        bytes,
        config.gas_for_token_ops,
        config.gas_for_reply_deposit,
        config.reply_timeout,
        //    msg_id,
    )
    .await
}

pub async fn transfer(
    token_id: ActorId,
    program_id: ActorId,
    receiver: ActorId,
    amount: U256,
    config: &Config,
    //  msg_id: MessageId,
) -> Result<(), PairError> {
    let bytes: Vec<u8> = TransferFrom::encode_call(program_id, receiver, amount);

    send_message_with_gas_for_reply(
        token_id,
        bytes,
        config.gas_for_token_ops,
        config.gas_for_reply_deposit,
        config.reply_timeout,
        //    msg_id,
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
    //  msg_id: MessageId,
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
    // .handle_reply(move || handle_reply_hook(msg_id))
    // .map_err(|_| Error::ReplyHook)?
    .await
    .map_err(|_| PairError::ReplyFailure)?;

    Ok(())
}
