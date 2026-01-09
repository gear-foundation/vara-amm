use crate::*;

#[tokio::test]
async fn test_multiple_lps_with_swap_fees_and_withdrawal() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;

    // Setup 5 liquidity providers + 1 swapper
    let lp_users = vec![
        100, // LP1
        101, // LP2
        102, // LP3
        103, // LP4
        104, // LP5
    ];
    let swapper = 200;

    // Different liquidity amounts for each LP
    let lp_amounts_a = vec![
        U256::from(10000) * U256::exp10(18), // LP1: 10,000 A
        U256::from(5000) * U256::exp10(18),  // LP2: 5,000 A
        U256::from(15000) * U256::exp10(18), // LP3: 15,000 A
        U256::from(8000) * U256::exp10(18),  // LP4: 8,000 A
        U256::from(12000) * U256::exp10(18), // LP5: 12,000 A
    ];
    let lp_amounts_b = vec![
        U256::from(10000) * U256::exp10(18), // LP1: 10,000 B
        U256::from(5000) * U256::exp10(18),  // LP2: 5,000 B
        U256::from(15000) * U256::exp10(18), // LP3: 15,000 B
        U256::from(8000) * U256::exp10(18),  // LP4: 8,000 B
        U256::from(12000) * U256::exp10(18), // LP5: 12,000 B
    ];

    // Setup users with tokens
    for (i, &lp_user) in lp_users.iter().enumerate() {
        env.setup_user(lp_user, lp_amounts_a[i] + lp_amounts_b[i])
            .await;
    }

    // Give swapper lots of tokens for swapping
    let swapper_tokens = U256::from(200000) * U256::exp10(18);
    env.setup_user(swapper, swapper_tokens).await;
    env.remoting
        .system()
        .mint_to(swapper, 1_000_000_000_000_000);
    env.remoting
        .system()
        .mint_to(ACTOR_ID, 1_000_000_000_000_000);
    env.remoting.system().mint_to(FEE_TO, 1_000_000_000_000_000);

    // Track LP tokens for each user
    let mut lp_tokens: Vec<U256> = Vec::new();
    let mut initial_balances_a: Vec<U256> = Vec::new();
    let mut initial_balances_b: Vec<U256> = Vec::new();

    // Each LP adds liquidity
    for (i, &lp_user) in lp_users.iter().enumerate() {
        let (before_a, before_b, before_lp) = env.get_balances(lp_user.into()).await;
        initial_balances_a.push(before_a);
        initial_balances_b.push(before_b);

        println!(
            "LP{} adding liquidity: {} A, {} B",
            i + 1,
            lp_amounts_a[i],
            lp_amounts_b[i]
        );

        env.pair_client
            .add_liquidity(
                lp_amounts_a[i],
                lp_amounts_b[i],
                lp_amounts_a[i] * U256::from(95) / U256::from(100), // 5% slippage
                lp_amounts_b[i] * U256::from(95) / U256::from(100),
                env.get_deadline(),
            )
            .with_args(|args| args.with_actor_id(lp_user.into()))
            .send_recv(env.pair_id)
            .await
            .unwrap();

        let (after_a, after_b, after_lp) = env.get_balances(lp_user.into()).await;
        let lp_tokens_received = after_lp - before_lp;
        lp_tokens.push(lp_tokens_received);

        println!("LP{} received {} LP tokens", i + 1, lp_tokens_received);
    }

    // Get state after all LPs added liquidity
    let (initial_reserve_a, initial_reserve_b) = env
        .pair_client
        .get_reserves()
        .recv(env.pair_id)
        .await
        .unwrap();
    let initial_k = initial_reserve_a * initial_reserve_b;
    let total_lp_supply = env
        .lp_vft_client
        .total_supply()
        .recv(env.pair_id)
        .await
        .unwrap();

    println!("\nInitial state after LP setup:");
    println!(
        "  Total reserves: A={}, B={}",
        initial_reserve_a, initial_reserve_b
    );
    println!("  Initial k={}", initial_k);
    println!("  Total LP supply={}", total_lp_supply);

    // Constants for calculations
    let thousand = U256::from(1000u64);
    let fee_multiplier = U256::from(997u64);

    println!("\n🔄 Starting 30 swaps by swapper...");

    // Swapper performs multiple swaps to generate fees
    let num_swaps = 30;
    let mut total_fees_collected = U256::zero();

    for i in 0..num_swaps {
        let swap_a_to_b = i % 2 == 0;

        if swap_a_to_b {
            // Swap A -> B
            let amount_out = U256::from(100 + i * 20) * U256::exp10(18);
            let amount_in_max = U256::from(500 + i * 50) * U256::exp10(18);

            let (before_a, before_b, _) = env.get_balances(swapper.into()).await;

            env.pair_client
                .swap_tokens_for_exact_tokens(
                    amount_out,
                    amount_in_max,
                    true, // A to B
                    env.get_deadline(),
                )
                .with_args(|args| args.with_actor_id(swapper.into()))
                .send_recv(env.pair_id)
                .await
                .unwrap();

            let (after_a, after_b, _) = env.get_balances(swapper.into()).await;
            let used_a = before_a - after_a;

            // Calculate fee (0.3% of input)
            let fee_paid = used_a * U256::from(3) / thousand;
            total_fees_collected += fee_paid;

            if (i + 1) % 10 == 0 {
                println!("  Swap {}: A->B, fee_paid={}", i + 1, fee_paid);
            }
        } else {
            // Swap B -> A
            let amount_out = U256::from(80 + i * 15) * U256::exp10(18);
            let amount_in_max = U256::from(400 + i * 40) * U256::exp10(18);

            let (before_a, before_b, _) = env.get_balances(swapper.into()).await;

            env.pair_client
                .swap_tokens_for_exact_tokens(
                    amount_out,
                    amount_in_max,
                    false, // B to A
                    env.get_deadline(),
                )
                .with_args(|args| args.with_actor_id(swapper.into()))
                .send_recv(env.pair_id)
                .await
                .unwrap();

            let (_, after_b, _) = env.get_balances(swapper.into()).await;
            let used_b = before_b - after_b;

            // Calculate fee (0.3% of input)
            let fee_paid = used_b * U256::from(3) / thousand;
            total_fees_collected += fee_paid;

            if (i + 1) % 10 == 0 {
                println!("  Swap {}: B->A, fee_paid={}", i + 1, fee_paid);
            }
        }
    }

    // Get state after swaps
    let (mid_reserve_a, mid_reserve_b) = env
        .pair_client
        .get_reserves()
        .recv(env.pair_id)
        .await
        .unwrap();
    let mid_k = mid_reserve_a * mid_reserve_b;
    let k_growth = mid_k - initial_k;

    println!("\nState after {} swaps:", num_swaps);
    println!("  New reserves: A={}, B={}", mid_reserve_a, mid_reserve_b);
    println!("  New k={}", mid_k);
    println!(
        "  k growth={} ({:.4}%)",
        k_growth,
        (k_growth * U256::from(10000) / initial_k).as_u64() as f64 / 100.0
    );
    println!("  Estimated total fees collected={}", total_fees_collected);

    println!("\nLPs withdrawing liquidity and claiming fees...");

    // Track results for each LP
    let mut lp_results = Vec::new();

    let current_price_b_in_a = mid_reserve_a * U256::exp10(18) / mid_reserve_b; // Price of B in terms of A
                                                                                // Each LP removes their liquidity
    for (i, &lp_user) in lp_users.iter().enumerate() {
        let lp_tokens_to_remove = lp_tokens[i];

        println!(
            "👤 LP{} removing {} LP tokens...",
            i + 1,
            lp_tokens_to_remove
        );

        let (before_a, before_b, before_lp) = env.get_balances(lp_user.into()).await;

        // Remove liquidity
        env.pair_client
            .remove_liquidity(
                lp_tokens_to_remove,
                U256::zero(), // min_amount_a (accept any)
                U256::zero(), // min_amount_b (accept any)
                env.get_deadline(),
            )
            .with_args(|args| args.with_actor_id(lp_user.into()))
            .send_recv(env.pair_id)
            .await
            .unwrap();

        let (after_a, after_b, after_lp) = env.get_balances(lp_user.into()).await;

        let received_a = after_a - before_a;
        let received_b = after_b - before_b;
        let lp_tokens_burned = before_lp - after_lp;

        // Calculate changes in each token (can be negative due to impermanent loss)
        let change_a = if received_a >= lp_amounts_a[i] {
            (true, received_a - lp_amounts_a[i]) // gain
        } else {
            (false, lp_amounts_a[i] - received_a) // loss
        };

        let change_b = if received_b >= lp_amounts_b[i] {
            (true, received_b - lp_amounts_b[i]) // gain (unlikely due to B depreciation)
        } else {
            (false, lp_amounts_b[i] - received_b) // loss (expected)
        };

        // Calculate total value in terms of token A (accounting for current price)
        let initial_value_in_a = lp_amounts_a[i] + lp_amounts_b[i]; // At initial 1:1 price
        let current_value_in_a = received_a + (received_b * current_price_b_in_a / U256::exp10(18));

        let (total_profit_positive, total_profit_amount) =
            if current_value_in_a >= initial_value_in_a {
                (true, current_value_in_a - initial_value_in_a)
            } else {
                (false, initial_value_in_a - current_value_in_a)
            };

        // Calculate LP's share of total supply
        let lp_share_percentage = (lp_tokens[i] * U256::from(10000) / total_lp_supply).as_u64();

        lp_results.push((
            received_a,
            received_b,
            change_a.1,
            change_b.1,
            total_profit_amount,
            lp_share_percentage,
        ));

        println!("LP{} results:", i + 1);
        println!("    LP tokens burned: {}", lp_tokens_burned);
        println!("    Received: {} A, {} B", received_a, received_b);
        println!(
            "    Token A change: {}{}",
            if change_a.0 { "+" } else { "-" },
            change_a.1
        );
        println!(
            "    Token B change: {}{} (impermanent loss due to B depreciation)",
            if change_b.0 { "+" } else { "-" },
            change_b.1
        );
        println!(
            "    Total value change: {}{} A (considering B price depreciation)",
            if total_profit_positive { "+" } else { "-" },
            total_profit_amount
        );
        println!(
            "    LP share: {}.{:02}%",
            lp_share_percentage / 100,
            lp_share_percentage % 100
        );

        assert!(
            received_a > lp_amounts_a[i],
            "LP{} should get more A tokens (fees + IL compensation)",
            i + 1
        );
        assert!(
            received_b < lp_amounts_b[i],
            "LP{} should get less B tokens (B depreciated)",
            i + 1
        );
        // Total profit assertion depends on whether fees > impermanent loss
        if !total_profit_positive {
            println!(
                " LP{} has net loss - impermanent loss exceeded swap fees",
                i + 1
            );
        }
    }

    // Final verification
    let (final_reserve_a, final_reserve_b) = env
        .pair_client
        .get_reserves()
        .recv(env.pair_id)
        .await
        .unwrap();
    let final_lp_supply = env
        .lp_vft_client
        .total_supply()
        .recv(env.pair_id)
        .await
        .unwrap();

    println!("\nFINAL RESULTS:");
    println!(
        "  Final reserves: A={}, B={}",
        final_reserve_a, final_reserve_b
    );
    println!("  Final LP supply={}", final_lp_supply);

    // Check if there are protocol fees to withdraw
    let protocol_fee_tokens = final_lp_supply - U256::from(1000);
    let (before_a, before_b, before_lp) = env.get_balances(FEE_TO.into()).await;
    assert_eq!(
        before_lp, protocol_fee_tokens,
        "Protocol fee balance mismatch"
    );
    println!(
        "👤 fee_to withdrawing {} protocol fee LP tokens...",
        protocol_fee_tokens
    );
    // Remove protocol fee liquidity
    env.pair_client
        .remove_liquidity(
            protocol_fee_tokens,
            U256::zero(), // min_amount_a (accept any)
            U256::zero(), // min_amount_b (accept any)
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(FEE_TO.into()))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (after_a, after_b, after_lp) = env.get_balances(FEE_TO.into()).await;

    let protocol_received_a = after_a - before_a;
    let protocol_received_b = after_b - before_b;
    let protocol_lp_burned = before_lp - after_lp;

    // Calculate protocol fee value at current price
    let protocol_value_in_a =
        protocol_received_a + (protocol_received_b * current_price_b_in_a / U256::exp10(18));

    println!("  ✅ Protocol fee results:");
    println!("    LP tokens burned: {}", protocol_lp_burned);
    println!(
        "    Received: {} A, {} B",
        protocol_received_a, protocol_received_b
    );
    println!(
        "    Total value: {} A (at current price)",
        protocol_value_in_a
    );

    // Calculate protocol fee as percentage of total trading volume
    let protocol_fee_percentage =
        (protocol_value_in_a * U256::from(10000) / (total_fees_collected)).as_u64();
    println!(
        "    Protocol fee: {}.{:02}% of total swap fees",
        protocol_fee_percentage / 100,
        protocol_fee_percentage % 100
    );

    // Verify protocol got reasonable fees
    assert!(
        protocol_received_a > U256::zero(),
        "Protocol should receive A tokens"
    );
    assert!(
        protocol_received_b > U256::zero(),
        "Protocol should receive B tokens"
    );
    assert!(
        protocol_value_in_a > U256::zero(),
        "Protocol should have positive value"
    );

    // Final check - only MINIMUM_LIQUIDITY should remain
    let final_final_lp_supply = env
        .lp_vft_client
        .total_supply()
        .recv(env.pair_id)
        .await
        .unwrap();
    assert_eq!(
        final_final_lp_supply,
        U256::from(1000),
        "Only MINIMUM_LIQUIDITY should remain"
    );
}
