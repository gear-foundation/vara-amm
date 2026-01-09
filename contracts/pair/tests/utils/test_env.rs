use crate::*;

pub struct TestEnv {
    pub remoting: GTestRemoting,
    pub token_a: ActorId,
    pub token_b: ActorId,
    pub pair_id: ActorId,
    pub pair_client: pair_client::Pair<GTestRemoting>,
    pub lp_vft_client: pair_client::Vft<GTestRemoting>,
    pub token_client: extended_vft_client::Vft<GTestRemoting>,
}

impl TestEnv {
    pub async fn new(treasury_id: ActorId) -> Self {
        let system = System::new();
        system.init_logger();
        system.mint_to(ACTOR_ID, 1_000_000_000_000_000);

        let remoting = GTestRemoting::new(system, ACTOR_ID.into());

        let (token_a, token_b, pair_id) =
            TestEnv::setup_tokens_and_pair(&remoting, FEE_TO.into(), treasury_id).await;

        let pair_client = pair_client::Pair::new(remoting.clone());
        let lp_vft_client = pair_client::Vft::new(remoting.clone());
        let token_client = extended_vft_client::Vft::new(remoting.clone());

        Self {
            remoting,
            token_a,
            token_b,
            pair_id,
            pair_client,
            lp_vft_client,
            token_client,
        }
    }

    pub async fn setup_tokens_and_pair(
        remoting: &GTestRemoting,
        fee_to: ActorId,
        treasury_id: ActorId,
    ) -> (ActorId, ActorId, ActorId) {
        let token_code_id = remoting
            .system()
            .submit_code_file("../target/wasm32-gear/release/extended_vft.opt.wasm");

        let token_factory = extended_vft_client::ExtendedVftFactory::new(remoting.clone());

        let token_a = token_factory
            .new("TokenA".to_string(), "TokenA".to_string(), 6)
            .send_recv(token_code_id, b"salt1")
            .await
            .unwrap();

        let token_b = token_factory
            .new("TokenB".to_string(), "TokenB".to_string(), 12)
            .send_recv(token_code_id, b"salt2")
            .await
            .unwrap();

        let program_code_id = remoting.system().submit_code(pair::WASM_BINARY);
        let program_factory = pair_client::PairFactory::new(remoting.clone());

        let config = Config {
            gas_for_token_ops: 5_000_000_000,
            gas_for_reply_deposit: 5_000_000_000,
            reply_timeout: 50,
            gas_for_full_tx: 100_000_000_000,
        };

        let pair_id = program_factory
            .new(
                config,
                token_a,
                token_b,
                fee_to,
                treasury_id,
                ACTOR_ID.into(),
            )
            .send_recv(program_code_id, b"salt")
            .await
            .unwrap();

        (token_a, token_b, pair_id)
    }

    pub async fn setup_user(&self, user_id: u64, token_amount: U256) {
        self.remoting.system().mint_to(user_id, 1_000_000_000_000_000);
        self.mint_and_approve_tokens(user_id.into(), token_amount)
            .await;
    }

    pub async fn mint_and_approve_tokens(&self, user: ActorId, amount: U256) {
        let mut token_client = extended_vft_client::Vft::new(self.remoting.clone());

        // Mint tokens to user
        token_client
            .mint(user.into(), amount)
            .send_recv(self.token_a)
            .await
            .unwrap();
        token_client
            .mint(user.into(), amount)
            .send_recv(self.token_b)
            .await
            .unwrap();

        // Approve pair to spend tokens
        token_client
            .approve(self.pair_id, amount)
            .with_args(|args| args.with_actor_id(user))
            .send_recv(self.token_a)
            .await
            .unwrap();
        token_client
            .approve(self.pair_id, amount)
            .with_args(|args| args.with_actor_id(user))
            .send_recv(self.token_b)
            .await
            .unwrap();
    }

    pub fn get_deadline(&self) -> u64 {
        self.remoting.system().block_timestamp() + 100_000_000
    }

    /// Get user balances (token_a, token_b, lp_tokens)
    pub async fn get_balances(&self, user: ActorId) -> (U256, U256, U256) {
        let token_a_balance = self
            .token_client
            .balance_of(user)
            .recv(self.token_a)
            .await
            .unwrap();

        let token_b_balance = self
            .token_client
            .balance_of(user)
            .recv(self.token_b)
            .await
            .unwrap();

        let lp_balance = self
            .lp_vft_client
            .balance_of(user)
            .recv(self.pair_id)
            .await
            .unwrap();
        (token_a_balance, token_b_balance, lp_balance)
    }

    /// Get current pair reserves
    pub async fn get_reserves(&self) -> (U256, U256) {
        self.pair_client
            .get_reserves()
            .recv(self.pair_id)
            .await
            .unwrap()
    }

    /// Get total LP token supply
    pub async fn get_total_supply(&self) -> U256 {
        self.lp_vft_client
            .total_supply()
            .recv(self.pair_id)
            .await
            .unwrap()
    }

    /// Get current pair price (B tokens per A token)
    pub async fn get_price_b_per_a(&self) -> U256 {
        let (reserve_a, reserve_b) = self.get_reserves().await;
        if reserve_a == U256::zero() {
            U256::zero()
        } else {
            reserve_b * U256::exp10(18) / reserve_a
        }
    }
}
