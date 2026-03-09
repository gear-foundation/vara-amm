use crate::services::lp_token::state::LpTokenState;
use crate::services::pair::token_operations;
use crate::services::pair::{PairService, State};
use sails_rs::{collections::HashMap, gstd::msg, prelude::*};

/// State machine which tracks state of each message that was submitted into
/// `request_bridging` method.
#[derive(Default, Debug)]
pub struct MessageTracker {
    /// Message states.
    pub message_info: HashMap<MessageId, MessageStatus>,
    //// reply_to -> root_msg_id
    pub reply_to_root: HashMap<MessageId, MessageId>,
}

/// State in which message processing can be.
#[derive(Debug, Clone, PartialEq, Encode, Decode, TypeInfo)]
pub enum MessageStatus {
    // during add liquiduty
    SendingMsgToLockTokenA,
    /// Reply is received for a token deposit message.
    TokenALocked(bool),

    // during add liquiduty
    SendingMsgToLockTokenB,
    /// Reply is received for a token deposit message.
    TokenBLocked(bool),
    /// Message to refund tokens is sent.
    SendingMessageToReturnTokensA,
    /// Reply is received for a token refund message.
    TokensAReturnComplete(bool),

    SendingMsgToTransferTokenIn,
    TokenInTransfered(bool),
    SendingMsgToTransferTokenOut,
    TokenOutTransfered(bool),
    SendingMessageToReturnTokenIn,
    TokenInReturnComplete(bool),
    SendingMsgToUnlockTokenA,
    /// Reply is received for a token deposit message.
    TokenAUnlocked(bool),
    SendingTreasuryTokenA,
    SendingTreasuryTokenB,
    TreasuryTokenASent(bool),
    TreasuryTokenBSent(bool),

    // during add liquiduty
    SendingMsgToUnlockTokenB,
    /// Reply is received for a token deposit message.
    TokenBUnlocked(bool),
}

impl MessageTracker {
    /// Start tracking state of the message.
    pub fn insert_msg_status(&mut self, msg_id: MessageId, status: MessageStatus) {
        self.message_info.insert(msg_id, status);
    }

    /// Drive state machine further for a given `msg_id`.
    pub fn update_msg_status(&mut self, msg_id: MessageId, new_status: MessageStatus) {
        if let Some(status) = self.message_info.get_mut(&msg_id) {
            *status = new_status;
        }
    }

    /// Get current state of the tracked message. Will return `None` if message isn't found.
    pub fn get_msg_status(&self, msg_id: &MessageId) -> Option<&MessageStatus> {
        self.message_info.get(msg_id)
    }

    /// Stop tracking message state. It will return current state of the target message.
    pub fn remove_msg_status(&mut self, msg_id: &MessageId) -> Option<MessageStatus> {
        self.message_info.remove(msg_id)
    }

    pub fn bind_reply(&mut self, reply_to: MessageId, root: MessageId) {
        self.reply_to_root.insert(reply_to, root);
    }
    pub fn take_root(&mut self, reply_to: &MessageId) -> Option<MessageId> {
        self.reply_to_root.remove(reply_to)
    }

    /// Clear all tracked messages
    pub fn clear_all(&mut self) {
        self.message_info.clear();
        self.reply_to_root.clear();
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReplyCodec {
    Transfer,
    TransferFrom,
    None,
}

impl MessageStatus {
    pub fn reply_codec(&self) -> ReplyCodec {
        use MessageStatus::*;
        match self {
            SendingMsgToLockTokenA | SendingMsgToLockTokenB | SendingMsgToTransferTokenIn => {
                ReplyCodec::TransferFrom
            }

            SendingMessageToReturnTokensA
            | SendingMsgToTransferTokenOut
            | SendingMessageToReturnTokenIn
            | SendingMsgToUnlockTokenA
            | SendingMsgToUnlockTokenB
            | SendingTreasuryTokenA
            | SendingTreasuryTokenB => ReplyCodec::Transfer,

            _ => ReplyCodec::None,
        }
    }
}

impl MessageStatus {
    pub fn apply_reply(
        &self,
        ok: bool,
        state: &mut State,
        lp: &LpTokenState,
        tr: &mut MessageTracker,
        msg_id: MessageId,
    ) {
        use MessageStatus::*;

        match self {
            SendingMsgToLockTokenA => {
                tr.update_msg_status(msg_id, TokenALocked(ok));
                if !ok {
                    state.lock.set_free();
                    let _ = lp.pause.resume();
                }
            }
            SendingMsgToLockTokenB => {
                tr.update_msg_status(msg_id, TokenBLocked(ok));
            }
            SendingMessageToReturnTokensA => {
                tr.update_msg_status(msg_id, TokensAReturnComplete(ok));
                if ok {
                    state.lock.set_free();
                    let _ = lp.pause.resume();
                } else {
                    state.lock.pause_keep_ctx();
                }
            }

            SendingMsgToTransferTokenIn => {
                tr.update_msg_status(msg_id, TokenInTransfered(ok));
                if !ok {
                    state.lock.set_free();
                    let _ = lp.pause.resume();
                }
            }
            SendingMsgToTransferTokenOut => {
                tr.update_msg_status(msg_id, TokenOutTransfered(ok));
            }
            SendingMessageToReturnTokenIn => {
                tr.update_msg_status(msg_id, TokenInReturnComplete(ok));
                if ok {
                    state.lock.set_free();
                    let _ = lp.pause.resume();
                } else {
                    state.lock.pause_keep_ctx();
                }
            }

            SendingMsgToUnlockTokenA => {
                tr.update_msg_status(msg_id, TokenAUnlocked(ok));
                if ok {
                    state.lock.advance_after_token0_ok();
                } else {
                    state.lock.pause_keep_ctx();
                }
            }
            SendingMsgToUnlockTokenB => {
                tr.update_msg_status(msg_id, TokenBUnlocked(ok));
                if !ok {
                    state.lock.pause_keep_ctx();
                }
            }

            SendingTreasuryTokenA => {
                tr.update_msg_status(msg_id, TreasuryTokenASent(ok));
                if ok {
                    state.lock.advance_after_token0_ok();
                } else {
                    state.lock.pause_keep_ctx();
                }
            }
            SendingTreasuryTokenB => {
                tr.update_msg_status(msg_id, TreasuryTokenBSent(ok));
                if !ok {
                    state.lock.pause_keep_ctx();
                }
            }

            _ => {}
        }
    }
}

impl<'a> PairService<'a> {
    pub fn on_reply(&self) {
        let reply_to_id = msg::reply_to().expect("reply_to only in reply context"); // :contentReference[oaicite:3]{index=3}
        let bytes = msg::load_bytes().expect("Unable to load bytes");

        let root_msg_id = self.with_tracker_mut(|tr| tr.take_root(&reply_to_id));
        let Some(root_msg_id) = root_msg_id else {
            return;
        };

        let status = self.with_tracker(|tr| {
            tr.get_msg_status(&root_msg_id)
                .expect("Unexpected: msg info does not exist")
                .clone()
        });

        let ok = match status.reply_codec() {
            ReplyCodec::TransferFrom => token_operations::decode_transfer_from_reply(&bytes),
            ReplyCodec::Transfer => token_operations::decode_transfer_reply(&bytes),
            ReplyCodec::None => return,
        };

        self.with_tracker_mut(|tr| {
            self.with_state_mut(|st| {
                status.apply_reply(ok, st, self.lp, tr, root_msg_id);
            })
        });
    }
}
