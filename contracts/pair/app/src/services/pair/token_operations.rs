use crate::PairService;
use crate::services::pair::{Config, PairError, msg_tracker::MessageStatus};
use extended_vft_client::vft::io::{BalanceOf, Transfer, TransferFrom};
use sails_rs::client::CallCodec;
use sails_rs::{U256, prelude::*};

impl<'a> PairService<'a> {
    pub async fn transfer_from(
        &self,
        token_id: ActorId,
        sender: ActorId,
        receiver: ActorId,
        amount: U256,
        config: &Config,
        msg_id: MessageId,
    ) -> Result<(), PairError> {
        let bytes: Vec<u8> =
            TransferFrom::encode_params_with_prefix("Vft", sender, receiver, amount);
        self.send_message_with_gas_for_reply(
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
        &self,
        token_id: ActorId,
        receiver: ActorId,
        amount: U256,
        config: &Config,
        msg_id: MessageId,
    ) -> Result<(), PairError> {
        let bytes: Vec<u8> = Transfer::encode_params_with_prefix("Vft", receiver, amount);

        self.send_message_with_gas_for_reply(
            token_id,
            bytes,
            config.gas_for_token_ops,
            config.gas_for_reply_deposit,
            config.reply_timeout,
            msg_id,
        )
        .await
    }

    async fn send_message_with_gas_for_reply(
        &self,
        destination: ActorId,
        message: Vec<u8>,
        gas_to_send: u64,
        gas_deposit: u64,
        reply_timeout: u32,
        root_msg_id: MessageId,
    ) -> Result<(), PairError> {
        let fut = sails_rs::gstd::msg::send_bytes_with_gas_for_reply(
            destination,
            message,
            gas_to_send,
            0,
            gas_deposit,
        )
        .map_err(|_| PairError::SendFailure)?;

        let reply_to_id = fut.waiting_reply_to;
        self.with_tracker_mut(|tr| {
            tr.bind_reply(reply_to_id, root_msg_id);
        });

        fut.up_to(Some(reply_timeout))
            .map_err(|_| PairError::ReplyTimeout)?
            .await
            .map_err(|_| PairError::ReplyFailure)?;

        self.fetch_transfer_result(&root_msg_id)
    }

    /// Fetch result of the message sent to transfer tokens into this program.
    ///
    /// It will look for the specified [MessageId] in the [MessageTracker] and return result
    /// based on this message state. The state should be present in the [MessageTracker] according
    /// to the [handle_reply_hook] logic.
    fn fetch_transfer_result(&self, msg_id: &MessageId) -> Result<(), PairError> {
        self.with_tracker(|tr| {
            let status = tr
                .message_info
                .get(msg_id)
                .ok_or(PairError::MessageNotFound)?;

            let success = match status {
                MessageStatus::TokenALocked(s)
                | MessageStatus::TokenBLocked(s)
                | MessageStatus::TokensAReturnComplete(s)
                | MessageStatus::TokenInTransfered(s)
                | MessageStatus::TokenOutTransfered(s)
                | MessageStatus::TokenInReturnComplete(s)
                | MessageStatus::TokenAUnlocked(s)
                | MessageStatus::TreasuryTokenASent(s)
                | MessageStatus::TreasuryTokenBSent(s)
                | MessageStatus::TokenBUnlocked(s) => *s,
                _ => return Err(PairError::InvalidMessageStatus),
            };

            if success {
                Ok(())
            } else {
                Err(PairError::TokenTransferFailed)
            }
        })
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
pub fn decode_transfer_from_reply(bytes: &[u8]) -> bool {
    TransferFrom::decode_reply_with_prefix("Vft", bytes).unwrap_or(false)
}
/// Decode reply received from the TransferFrom method.
pub fn decode_transfer_reply(bytes: &[u8]) -> bool {
    Transfer::decode_reply_with_prefix("Vft", bytes).unwrap_or(false)
}
