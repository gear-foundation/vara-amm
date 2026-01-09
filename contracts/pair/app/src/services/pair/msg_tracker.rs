use gstd::{static_mut, static_ref};
use sails_rs::{collections::HashMap, prelude::*};
static mut MSG_TRACKER: Option<MessageTracker> = None;

/// State machine which tracks state of each message that was submitted into
/// `request_bridging` method.
#[derive(Default, Debug)]
pub struct MessageTracker {
    /// Message states.
    pub message_info: HashMap<MessageId, MessageStatus>,
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

/// Initialize global state of the message tracker.
pub fn init() {
    unsafe { MSG_TRACKER = Some(MessageTracker::default()) }
}

/// Get reference to a global message tracker.
pub fn msg_tracker_ref() -> &'static MessageTracker {
    unsafe { static_ref!(MSG_TRACKER).as_ref() }.expect("State is not initialized")
}

/// Get mutable reference to a global message tracker.
pub fn msg_tracker_mut() -> &'static mut MessageTracker {
    unsafe { static_mut!(MSG_TRACKER).as_mut() }.expect("State is not initialized")
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
}
