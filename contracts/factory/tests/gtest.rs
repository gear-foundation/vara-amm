use factory_app::ONE_VARA;
use factory_client::{factory::*, FactoryClient, FactoryClientCtors};
use sails_rs::gtest::System;
use sails_rs::{client::*, prelude::*};

const ADMIN_ID: u64 = 1;
const USER_ID: u64 = 2;

fn default_factory_config() -> factory_client::Config {
    factory_client::Config {
        gas_for_token_ops: 20_000_000_000,
        gas_for_reply_deposit: 20_000_000_000,
        reply_timeout: 100,
        gas_for_full_tx: 100_000_000_000,
        gas_for_pair_creation: 200_000_000_000,
        gas_to_change_fee_to: 20_000_000_000,
    }
}

async fn deploy_factory() -> (GtestEnv, Service<FactoryImpl, GtestEnv>, CodeId) {
    let system = System::new();
    let admin: ActorId = ActorId::from(ADMIN_ID);
    let fee_to: ActorId = ActorId::from(900u64);
    let treasury_id: ActorId = ActorId::from(901u64);
    system.mint_to(admin, 100 * ONE_VARA);
    let env = GtestEnv::new(system, admin);

    // code ids
    let pair_code_id = env.system().submit_code(pair::WASM_BINARY);
    let factory_code_id = env.system().submit_code(factory::WASM_BINARY);

    // deploy factory program
    let factory_program = env
        .deploy::<factory_client::FactoryClientProgram>(factory_code_id, b"salt".to_vec())
        .new(
            pair_code_id,
            admin,
            fee_to,
            default_factory_config(),
            treasury_id,
        )
        .await
        .unwrap();

    (env, factory_program.factory(), pair_code_id)
}

#[tokio::test]
async fn factory_create_pair_happy_path_sorts_and_stores() {
    let (env, mut factory, _pair_code_id) = deploy_factory().await;

    let user: ActorId = ActorId::from(USER_ID);
    env.system().mint_to(user, ONE_VARA * 1000);

    // Intentionally unsorted to check sort_tokens()
    let token_a = ActorId::from(200u64);
    let token_b = ActorId::from(100u64);

    factory
        .create_pair(token_a, token_b)
        .with_params(|p| p.with_actor_id(user).with_value(ONE_VARA))
        .await
        .unwrap();

    // Event must contain sorted tokens and non-zero pair address
    let (t0, t1) = if token_a < token_b {
        (token_a, token_b)
    } else {
        (token_b, token_a)
    };

    // get_pair should work for both orders
    let p1 = factory.get_pair(token_a, token_b).await.unwrap();
    let p2 = factory.get_pair(token_b, token_a).await.unwrap();
    assert_eq!(p1, p2);
    assert!(!p1.is_zero());

    // pairs list should contain exactly one entry with sorted key
    let pairs = factory.pairs().await.unwrap();
    assert_eq!(pairs.len(), 1);
    assert_eq!(pairs[0].0, (t0, t1));
    assert_eq!(pairs[0].1, p1);
}

#[tokio::test]
async fn factory_create_pair_requires_one_vara() {
    let (env, mut factory, _) = deploy_factory().await;
    let user: ActorId = ActorId::from(USER_ID);
    env.system().mint_to(user, ONE_VARA * 1000);

    let token0 = ActorId::from(10u64);
    let token1 = ActorId::from(11u64);

    // wrong attached value
    let res = factory
        .create_pair(token0, token1)
        .with_params(|p| p.with_actor_id(user).with_value(ONE_VARA - 1))
        .await;

    assert!(res.is_err());

    // no pair stored
    let pairs = factory.pairs().await.unwrap();
    assert!(pairs.is_empty());
}

#[tokio::test]
async fn factory_create_pair_rejects_duplicates() {
    let (env, mut factory, _) = deploy_factory().await;

    let user: ActorId = ActorId::from(USER_ID);
    env.system().mint_to(user, ONE_VARA * 1000);
    let token0 = ActorId::from(10u64);
    let token1 = ActorId::from(11u64);

    // first ok
    factory
        .create_pair(token0, token1)
        .with_params(|p| p.with_actor_id(user).with_value(ONE_VARA))
        .await
        .unwrap();

    // second must fail
    let res = factory
        .create_pair(token0, token1)
        .with_params(|p| p.with_actor_id(user).with_value(ONE_VARA))
        .await;

    assert!(res.is_err());

    let pairs = factory.pairs().await.unwrap();
    assert_eq!(pairs.len(), 1);
}

#[tokio::test]
async fn factory_add_pair_admin_only_and_sorts_key() {
    let (env, mut factory, _) = deploy_factory().await;
    let admin: ActorId = ActorId::from(ADMIN_ID);
    let user: ActorId = ActorId::from(USER_ID);
    env.system().mint_to(user, ONE_VARA * 1000);
    env.system().mint_to(admin, ONE_VARA * 1000);
    let token_a = ActorId::from(200u64);
    let token_b = ActorId::from(100u64);
    let fake_pair = ActorId::from(777u64);

    // non-admin must fail
    let res = factory
        .add_pair(token_a, token_b, fake_pair)
        .with_params(|p| p.with_actor_id(user))
        .await;
    assert!(res.is_err());

    // admin ok
    factory
        .add_pair(token_a, token_b, fake_pair)
        .with_params(|p| p.with_actor_id(admin))
        .await
        .unwrap();

    let (t0, t1) = if token_a < token_b {
        (token_a, token_b)
    } else {
        (token_b, token_a)
    };
    let got = factory.get_pair(token_b, token_a).await.unwrap();
    assert_eq!(got, fake_pair);

    let pairs = factory.pairs().await.unwrap();
    assert_eq!(pairs.len(), 1);
    assert_eq!(pairs[0].0, (t0, t1));
    assert_eq!(pairs[0].1, fake_pair);
}

#[tokio::test]
async fn factory_change_fee_to_admin_only() {
    let (env, mut factory, _) = deploy_factory().await;
    let admin: ActorId = ActorId::from(ADMIN_ID);
    let user: ActorId = ActorId::from(USER_ID);
    env.system().mint_to(user, ONE_VARA * 1000);
    env.system().mint_to(admin, ONE_VARA * 1000);

    let old = factory.fee_to().await.unwrap();
    let new_fee_to = ActorId::from(999u64);

    // non-admin fails
    let res = factory
        .change_fee_to(new_fee_to)
        .with_params(|p| p.with_actor_id(user))
        .await;
    assert!(res.is_err());
    assert_eq!(factory.fee_to().await.unwrap(), old);

    // admin ok
    factory
        .change_fee_to(new_fee_to)
        .with_params(|p| p.with_actor_id(admin))
        .await
        .unwrap();

    assert_eq!(factory.fee_to().await.unwrap(), new_fee_to);
}

#[tokio::test]
async fn factory_change_treasury_id_admin_only() {
    let (env, mut factory, _) = deploy_factory().await;
    let admin: ActorId = ActorId::from(ADMIN_ID);
    let user: ActorId = ActorId::from(USER_ID);

    env.system().mint_to(user, ONE_VARA * 1000);
    env.system().mint_to(admin, ONE_VARA * 1000);
    let old = factory.treasury_id().await.unwrap();
    let new_treasury = ActorId::from(888u64);

    // non-admin fails
    let res = factory
        .change_treasury_id(new_treasury)
        .with_params(|p| p.with_actor_id(user))
        .await;
    assert!(res.is_err());
    assert_eq!(factory.treasury_id().await.unwrap(), old);

    // admin ok
    factory
        .change_treasury_id(new_treasury)
        .with_params(|p| p.with_actor_id(admin))
        .await
        .unwrap();

    assert_eq!(factory.treasury_id().await.unwrap(), new_treasury);
}
