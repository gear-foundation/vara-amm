use sails_rs::{
    calls::*,
    gtest::{calls::*, System},
    prelude::*,
    U256,
};

mod utils;
const ACTOR_ID: u64 = 42;
use extended_vft_client::traits::*;
use pair_client::{traits::Vft as LpVft, traits::*, Config};

#[tokio::test]
async fn pair_add_liquidity() {
    // === SETUP ===
    let system = System::new();
    system.init_logger();
    system.mint_to(ACTOR_ID, 100_000_000_000_000);
    let initial_mint_amount = U256::from(10) * U256::exp10(18); // 10 tokens with 18 decimals
    let remoting = GTestRemoting::new(system, ACTOR_ID.into());
    let fee_to: ActorId = 10.into();

    let (token_a, token_b, pair_id) = utils::setup_tokens_and_pair(&remoting, fee_to).await;

    // Mint and approve tokens for first user
    utils::mint_and_approve_tokens(
        &remoting,
        ACTOR_ID.into(),
        token_a,
        token_b,
        pair_id,
        initial_mint_amount,
    )
    .await;

    let mut pair_client = pair_client::Pair::new(remoting.clone());
    let mut lp_vft_client = pair_client::Vft::new(remoting.clone());

    // === FIRST LIQUIDITY ADDITION ===
    println!("=== FIRST LIQUIDITY ADDITION ===");

    let first_liquidity = utils::LiquidityAddition::balanced(initial_mint_amount);
    let deadline = remoting.system().block_timestamp() + 100_000_000;

    // Expected values for first addition:
    // liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY
    //          = sqrt(10000000000000000000 * 10000000000000000000) - 1000
    //          = 10^19 - 1000 = 9 999 999 999 999 999 000
    let total_supply = initial_mint_amount;
    let expected_first_state = utils::PairState {
        reserve0: initial_mint_amount,
        reserve1: initial_mint_amount,
        total_supply,
    };
    let expected_first_user_balance = total_supply - U256::from(1000);

    utils::add_liquidity_and_verify(
        &mut pair_client,
        &mut lp_vft_client,
        pair_id,
        first_liquidity,
        expected_first_state,
        expected_first_user_balance,
        ACTOR_ID.into(),
        deadline,
        "first liquidity addition",
    )
    .await;

    // === SECOND LIQUIDITY ADDITION ===
    println!("\n=== SECOND LIQUIDITY ADDITION ===");

    // Setup second user
    let second_user = ActorId::from(43);
    remoting.system().mint_to(second_user, 100_000_000_000_000);
    let second_mint_amount = U256::from(123456u64) * U256::exp10(12); // 123.456 tokens with 18 decimals = 123456 * 10^12 = 1.23456e17
    utils::mint_and_approve_tokens(
        &remoting,
        second_user,
        token_a,
        token_b,
        pair_id,
        second_mint_amount * U256::from(2u32), // Mint more for B to allow correction
    )
    .await;

    // Second user adds with non-ideal ratio
    let second_liquidity = utils::LiquidityAddition::new(
        second_mint_amount,                    // amount_a_desired = 1.23456e17
        second_mint_amount * U256::from(2u32), // amount_b_desired = 2.46912e17 (twice as much)
        second_mint_amount / U256::from(2u32), // amount_a_min = ~6.1728e16
        second_mint_amount,                    // amount_b_min = 1.23456e17
    );

    // Expected values with rounding:
    // Current reserves: 10^19 each
    // amount_b_optimal = quote(1.23456e17, 10^19, 10^19) = (1.23456e17 * 10^19) / 10^19 = 1.23456e17 (exact, no rounding)
    // total_supply = 10^19, reserve_a = 10^19, amount_a_added = 1.23456e17
    // liq_a = 1.23456e17 * 10^19 / 10^19 = 1.23456e17 (exact)
    // new reserves = 10^19 + 1.23456e17 = 1.0123456e19 each
    // new total_supply = 10^19 + 1.23456e17 = 1.0123456e19
    // user_balance = 1.23456e17
    let initial_reserve = initial_mint_amount;
    let sqrt_first = initial_reserve;
    let added = second_mint_amount;
    let expected_second_state = utils::PairState {
        reserve0: initial_reserve + added,
        reserve1: initial_reserve + added,
        total_supply: sqrt_first + added,
    };
    let expected_second_user_balance = added;
    utils::add_liquidity_and_verify(
        &mut pair_client,
        &mut lp_vft_client,
        pair_id,
        second_liquidity,
        expected_second_state,
        expected_second_user_balance,
        second_user,
        deadline,
        "second liquidity addition",
    )
    .await;
}

#[tokio::test]
async fn dex_pool_flow() {
    let system = System::new();
    system.init_logger();

    let remoting = GTestRemoting::new(system, ACTOR_ID.into());

    // Setup multiple users
    let users = [
        (ACTOR_ID, "Alice"),
        (50, "Bob"),
        (51, "Charlie"),
        (52, "David"),
        (53, "Eve"),
    ];

    for (user_id, _name) in &users {
        remoting.system().mint_to(*user_id, 100_000_000_000_000);
    }

    let fee_to: ActorId = 10.into();

    let (token_a, token_b, pair_id) = utils::setup_tokens_and_pair(&remoting, fee_to).await;

    let mut pair_client = pair_client::Pair::new(remoting.clone());
    let mut lp_vft_client = pair_client::Vft::new(remoting.clone());
    let mut token_client = extended_vft_client::Vft::new(remoting.clone());

    // Initialize calculator
    let mut calculator = utils::PoolCalculator::new();

    let deadline = remoting.system().block_timestamp() + 100_000_000;

    // === PHASE 1: INITIAL LIQUIDITY ADDITIONS WITH CALCULATIONS ===
    println!("📈 === PHASE 1: LIQUIDITY ADDITIONS === 📈");

    // Alice: Initial liquidity with 2:3 ratio
    let alice_amount_a = U256::from(2) * U256::exp10(18); // 2 TokenA
    let alice_amount_b = U256::from(3) * U256::exp10(18); // 3 TokenB

    utils::mint_and_approve_tokens(
        &remoting,
        users[0].0.into(),
        token_a,
        token_b,
        pair_id,
        alice_amount_a.max(alice_amount_b) * U256::from(2),
    )
    .await;

    // Calculate expected values for Alice

    let expected_alice_liquidity =
        calculator.calculate_initial_liquidity(alice_amount_a, alice_amount_b);
    calculator.print_expectations("Alice's addition");
    println!("Expected Alice LP tokens: {}", expected_alice_liquidity);

    println!("Alice adds initial liquidity: 2 TokenA : 3 TokenB");
    pair_client
        .add_liquidity(
            alice_amount_a,
            alice_amount_b,
            alice_amount_a / U256::from(2),
            alice_amount_b / U256::from(2),
            deadline,
        )
        .with_args(|args| args.with_actor_id(users[0].0.into()))
        .send_recv(pair_id)
        .await
        .unwrap();

    let state_after_alice = utils::PairState::fetch(&pair_client, &lp_vft_client, pair_id).await;
    state_after_alice.print("After Alice's liquidity (ACTUAL)");
    let alice_lp_balance = lp_vft_client
        .balance_of(users[0].0.into())
        .recv(pair_id)
        .await
        .unwrap();

    // Verify Alice's results
    assert_eq!(
        alice_lp_balance, expected_alice_liquidity,
        "❌ Alice LP balance mismatch!"
    );
    assert_eq!(
        state_after_alice.reserve0, alice_amount_a,
        "❌ Reserve0 mismatch after Alice!"
    );
    assert_eq!(
        state_after_alice.reserve1, alice_amount_b,
        "❌ Reserve1 mismatch after Alice!"
    );
    println!("✅ Alice's calculations verified!\n");

    // Bob: Adds liquidity with 5:2 ratio (calculator will optimize)
    let bob_amount_a = U256::from(5) * U256::exp10(18);
    let bob_amount_b = U256::from(2) * U256::exp10(18);

    utils::mint_and_approve_tokens(
        &remoting,
        users[1].0.into(),
        token_a,
        token_b,
        pair_id,
        bob_amount_a.max(bob_amount_b) * U256::from(3),
    )
    .await;

    let (expected_bob_a, expected_bob_b, expected_bob_liquidity) =
        calculator.calculate_additional_liquidity(bob_amount_a, bob_amount_b);
    calculator.print_expectations("Bob's addition");
    println!(
        "🧮 Expected Bob: {}A, {}B, {} LP tokens",
        expected_bob_a, expected_bob_b, expected_bob_liquidity
    );

    println!("Bob adds liquidity: 5 TokenA : 2 TokenB (will be optimized)");
    pair_client
        .add_liquidity(
            bob_amount_a,
            bob_amount_b,
            U256::from(1) * U256::exp10(17),
            U256::from(1) * U256::exp10(17),
            deadline,
        )
        .with_args(|args| args.with_actor_id(users[1].0.into()))
        .send_recv(pair_id)
        .await
        .unwrap();

    let state_after_bob = utils::PairState::fetch(&pair_client, &lp_vft_client, pair_id).await;
    state_after_bob.print("After Bob's liquidity (ACTUAL)");
    let bob_lp_balance = lp_vft_client
        .balance_of(users[1].0.into())
        .recv(pair_id)
        .await
        .unwrap();

    // Verify Bob's results
    assert_eq!(
        bob_lp_balance, expected_bob_liquidity,
        "❌ Bob LP balance mismatch!"
    );
    println!("✅ Bob's calculations verified!\n");

    // Charlie: 1:4 ratio
    let charlie_amount_a = U256::from(1) * U256::exp10(18);
    let charlie_amount_b = U256::from(4) * U256::exp10(18);

    utils::mint_and_approve_tokens(
        &remoting,
        users[2].0.into(),
        token_a,
        token_b,
        pair_id,
        charlie_amount_a.max(charlie_amount_b) * U256::from(2),
    )
    .await;

    let (expected_charlie_a, expected_charlie_b, expected_charlie_liquidity) =
        calculator.calculate_additional_liquidity(charlie_amount_a, charlie_amount_b);
    calculator.print_expectations("Charlie's addition");
    println!(
        "🧮 Expected Charlie: {}A, {}B, {} LP tokens",
        expected_charlie_a, expected_charlie_b, expected_charlie_liquidity
    );

    println!("Charlie adds liquidity: 1 TokenA : 4 TokenB (will be optimized)");
    pair_client
        .add_liquidity(
            charlie_amount_a,
            charlie_amount_b,
            charlie_amount_a / U256::from(10),
            charlie_amount_b / U256::from(10),
            deadline,
        )
        .with_args(|args| args.with_actor_id(users[2].0.into()))
        .send_recv(pair_id)
        .await
        .unwrap();

    let state_after_charlie = utils::PairState::fetch(&pair_client, &lp_vft_client, pair_id).await;
    state_after_charlie.print("After Charlie's liquidity (ACTUAL)");
    let charlie_lp_balance = lp_vft_client
        .balance_of(users[2].0.into())
        .recv(pair_id)
        .await
        .unwrap();

    // Verify Charlie's results
    assert_eq!(
        charlie_lp_balance, expected_charlie_liquidity,
        "❌ Charlie LP balance mismatch!"
    );
    println!("✅ Charlie's calculations verified!\n");

    // David: Swap calculations
    let david_swap_amount = U256::from(5) * U256::exp10(17); // 0.5 tokens
    utils::mint_and_approve_tokens(
        &remoting,
        users[3].0.into(),
        token_a,
        token_b,
        pair_id,
        david_swap_amount * U256::from(20),
    )
    .await;

    // Swap 1: TokenA -> TokenB
    println!("🧮 Calculating expected output for 0.5 TokenA -> TokenB swap...");
    let expected_output_1 = calculator.calculate_swap_output(david_swap_amount, true);
    calculator.print_expectations("after swap 1");
    println!("🧮 Expected output: {} TokenB", expected_output_1);

    println!("👨‍💻 David Swap 1: 0.5 TokenA -> TokenB");
    pair_client
        .swap_exact_tokens_for_tokens(david_swap_amount, U256::from(1), true, deadline)
        .with_args(|args| args.with_actor_id(users[3].0.into()))
        .send_recv(pair_id)
        .await
        .unwrap();

    let state_after_swap1 = utils::PairState::fetch(&pair_client, &lp_vft_client, pair_id).await;
    state_after_swap1.print("After David's Swap 1 (ACTUAL)");
    let david_token_b_balance = token_client
        .balance_of(users[3].0.into())
        .recv(token_b)
        .await
        .unwrap();
    // Verify David's results
    assert_eq!(
        david_token_b_balance,
        expected_output_1 + david_swap_amount * U256::from(20),
        "❌ David token B balance mismatch!"
    );
    println!("✅ Swap 1 executed\n");

    // Swap 2: TokenB -> TokenA
    let reverse_swap_amount = U256::from(3) * U256::exp10(17); // 0.3 tokens
    println!("🧮 Calculating expected output for 0.3 TokenB -> TokenA swap...");
    let expected_output_2 = calculator.calculate_swap_output(reverse_swap_amount, false);
    calculator.print_expectations("after swap 2");
    println!("🧮 Expected output: {} TokenA", expected_output_2);

    println!("👨‍💻 David Swap 2: 0.3 TokenB -> TokenA");
    pair_client
        .swap_exact_tokens_for_tokens(reverse_swap_amount, U256::from(1), false, deadline)
        .with_args(|args| args.with_actor_id(users[3].0.into()))
        .send_recv(pair_id)
        .await
        .unwrap();

    let state_after_swap2 = utils::PairState::fetch(&pair_client, &lp_vft_client, pair_id).await;
    state_after_swap2.print("After David's Swap 2 (ACTUAL)");
    let david_token_a_balance = token_client
        .balance_of(users[3].0.into())
        .recv(token_a)
        .await
        .unwrap();
    // Verify David's results
    assert_eq!(
        david_token_a_balance,
        david_swap_amount * U256::from(20) - david_swap_amount + expected_output_2,
        "❌ David token A balance mismatch!"
    );
    println!("✅ Swap 2 executed\n");

    // Eve: Large swap
    let eve_large_swap = U256::from(1) * U256::exp10(18);
    utils::mint_and_approve_tokens(
        &remoting,
        users[4].0.into(),
        token_a,
        token_b,
        pair_id,
        eve_large_swap * U256::from(2),
    )
    .await;

    println!("🧮 Calculating expected output for 1 TokenA -> TokenB large swap...");
    let expected_large_output = calculator.calculate_swap_output(eve_large_swap, true);
    println!(
        "🧮 Expected large swap output: {} TokenB",
        expected_large_output
    );

    println!("👩‍🔬 Eve Large Swap: 1 TokenA -> TokenB");
    pair_client
        .swap_exact_tokens_for_tokens(eve_large_swap, U256::from(1), true, deadline)
        .with_args(|args| args.with_actor_id(users[4].0.into()))
        .send_recv(pair_id)
        .await
        .unwrap();

    let state_after_large_swap =
        utils::PairState::fetch(&pair_client, &lp_vft_client, pair_id).await;
    state_after_large_swap.print("After Eve's Large Swap (ACTUAL)");

    let eve_token_b_balance = token_client
        .balance_of(users[4].0.into())
        .recv(token_b)
        .await
        .unwrap();

    // Verify Eve's results

    assert_eq!(
        eve_token_b_balance,
        eve_large_swap * U256::from(2) + expected_large_output,
        "❌ Eve token B balance mismatch!"
    );
    println!("✅ Swap 3 executed\n");

    // Additional swaps for fee accumulation
    println!("🔄 Additional swaps for fee accumulation...");

    for i in 0..3 {
        let swap_amount = U256::from(2 + i) * U256::exp10(17);
        let is_token0_to_token1 = i % 2 == 0;

        let expected_out = calculator.calculate_swap_output(swap_amount, is_token0_to_token1);
        println!(
            "  Swap {}: {} {} -> {} {} (expected: {})",
            i + 1,
            swap_amount,
            if is_token0_to_token1 {
                "TokenA"
            } else {
                "TokenB"
            },
            if is_token0_to_token1 {
                "TokenB"
            } else {
                "TokenA"
            },
            if is_token0_to_token1 {
                "TokenB"
            } else {
                "TokenA"
            },
            expected_out
        );

        pair_client
            .swap_exact_tokens_for_tokens(swap_amount, U256::from(1), is_token0_to_token1, deadline)
            .with_args(|args| args.with_actor_id(users[4].0.into()))
            .send_recv(pair_id)
            .await
            .unwrap();
    }

    let state_after_all_swaps =
        utils::PairState::fetch(&pair_client, &lp_vft_client, pair_id).await;
    state_after_all_swaps.print("After All Swaps (ACTUAL)");
    calculator.print_expectations("after all swaps");

    // === PHASE 3: LIQUIDITY REMOVAL WITH CALCULATIONS ===
    println!("📉 === PHASE 3: LIQUIDITY REMOVAL WITH CALCULATIONS === 📉");

    let alice_lp_before = alice_lp_balance;
    let bob_lp_before = bob_lp_balance;
    let charlie_lp_before = charlie_lp_balance;

    // Alice removes 50%
    let alice_remove_amount = alice_lp_before / U256::from(2);

    // Check protocol fees BEFORE Alice's removal (should still be 0 or minimal)
    let protocol_fees_before_removal = lp_vft_client
        .balance_of(fee_to)
        .recv(pair_id)
        .await
        .unwrap();
    println!(
        "💼 Protocol fees BEFORE Alice removal: {}",
        protocol_fees_before_removal
    );

    let (expected_alice_a_out, expected_alice_b_out, alice_removal_protocol_fees) =
        calculator.calculate_removal_amounts(alice_remove_amount);
    println!(
        "🧮 Expected Alice removal: {} TokenA, {} TokenB",
        expected_alice_a_out, expected_alice_b_out
    );
    println!(
        "🏦 Expected protocol fees minted during Alice's removal: {}",
        alice_removal_protocol_fees
    );

    let alice_token_a_balance_before = token_client
        .balance_of(users[0].0.into())
        .recv(token_a)
        .await
        .unwrap();

    let alice_token_b_balance_before = token_client
        .balance_of(users[0].0.into())
        .recv(token_b)
        .await
        .unwrap();
    pair_client
        .remove_liquidity(alice_remove_amount, U256::from(1), U256::from(1), deadline)
        .with_args(|args| args.with_actor_id(users[0].0.into()))
        .send_recv(pair_id)
        .await
        .unwrap();

    let alice_token_a_balance_after = token_client
        .balance_of(users[0].0.into())
        .recv(token_a)
        .await
        .unwrap();

    let alice_token_b_balance_after = token_client
        .balance_of(users[0].0.into())
        .recv(token_b)
        .await
        .unwrap();

    assert_eq!(
        alice_token_a_balance_after - alice_token_a_balance_before,
        expected_alice_a_out,
        "❌ Alice token A balance mismatch!"
    );

    assert_eq!(
        alice_token_b_balance_after - alice_token_b_balance_before,
        expected_alice_b_out,
        "❌ Alice token B balance mismatch!"
    );

    let protocol_fees = lp_vft_client
        .balance_of(fee_to)
        .recv(pair_id)
        .await
        .unwrap();
    assert_eq!(
        protocol_fees, alice_removal_protocol_fees,
        "❌ Protokol fees mismatch!"
    );
}
