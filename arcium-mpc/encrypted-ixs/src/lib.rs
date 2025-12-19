use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    pub struct EncryptedPosition {
        collateral_usd: u64,
        debt_usd: u64,
        health_factor_bps: u64,
        leverage_bps: u64,
        liquidation_price: u64,
        protocol_id: u8,
        last_updated: i64,
    }

    pub struct DarkPoolOrder {
        side: u8,
        token_mint: [u8; 32],
        amount: u64,
        limit_price: u64,
        min_fill_amount: u64,
        expires_at: i64,
    }

    pub struct SwapIntent {
        from_token: [u8; 32],
        to_token: [u8; 32],
        amount_in: u64,
        min_amount_out: u64,
        max_slippage_bps: u64,
        deadline: i64,
    }

    pub struct HealthCheckResult {
        is_healthy: bool,
        risk_level: u8,
        time_to_liquidation: i64,
    }

    pub struct OrderMatchResult {
        is_matched: bool,
        execution_price: u64,
        fill_amount: u64,
    }

    #[instruction]
    pub fn init_encrypted_position(
        mxe: Mxe,
        position_id: [u8; 32],
        protocol: u8,
    ) -> Enc<Mxe, EncryptedPosition> {
        let position = EncryptedPosition {
            collateral_usd: 0,
            debt_usd: 0,
            health_factor_bps: 10000,
            leverage_bps: 10000,
            liquidation_price: 0,
            protocol_id: protocol,
            last_updated: 0,
        };
        mxe.from_arcis(position)
    }

    #[instruction]
    pub fn update_position_data(
        position_ctxt: Enc<Shared, EncryptedPosition>,
        stored_ctxt: Enc<Mxe, EncryptedPosition>,
    ) -> Enc<Mxe, EncryptedPosition> {
        let position = position_ctxt.to_arcis();
        stored_ctxt.owner.from_arcis(position)
    }


    #[instruction]
    pub fn update_health_factor(
        stored_ctxt: Enc<Mxe, EncryptedPosition>,
        new_collateral: u64,
        new_debt: u64,
    ) -> Enc<Mxe, EncryptedPosition> {
        let mut position = stored_ctxt.to_arcis();
        
        position.collateral_usd = new_collateral;
        position.debt_usd = new_debt;
        
        if new_debt > 0 {
            position.health_factor_bps = (new_collateral * 10000) / new_debt;
            position.leverage_bps = (new_debt * 10000) / new_collateral;
        } else {
            position.health_factor_bps = 10000;
            position.leverage_bps = 10000;
        }
        
        stored_ctxt.owner.from_arcis(position)
    }

    #[instruction]
    pub fn prove_health_threshold(
        position_ctxt: Enc<Mxe, EncryptedPosition>,
        threshold_bps: u64,
    ) -> bool {
        let position = position_ctxt.to_arcis();
        (position.health_factor_bps >= threshold_bps).reveal()
    }

    #[instruction]
    pub fn calculate_liquidation_risk(
        position_ctxt: Enc<Mxe, EncryptedPosition>,
        price_impact_bps: u64,
    ) -> u8 {
        let position = position_ctxt.to_arcis();
        
        let adjusted_health = if position.health_factor_bps > price_impact_bps {
            position.health_factor_bps - price_impact_bps
        } else {
            0
        };
        
        let risk_level: u8 = if adjusted_health >= 15000 {
            0
        } else if adjusted_health >= 12500 {
            1
        } else if adjusted_health >= 11000 {
            2
        } else if adjusted_health >= 10500 {
            3
        } else {
            4
        };
        
        risk_level.reveal()
    }

    #[instruction]
    pub fn batch_health_check(
        positions: Enc<Shared, [EncryptedPosition; 10]>,
        threshold_bps: u64,
    ) -> u8 {
        let pos_array = positions.to_arcis();
        let mut at_risk_count: u8 = 0;
        
        let mut i = 0;
        while i < 10 {
            if pos_array[i].health_factor_bps < threshold_bps && pos_array[i].debt_usd > 0 {
                at_risk_count = at_risk_count + 1;
            }
            i = i + 1;
        }
        
        at_risk_count.reveal()
    }

    #[instruction]
    pub fn init_dark_pool_order(
        mxe: Mxe,
        order_id: [u8; 32],
        side: u8,
        expires_at: i64,
    ) -> Enc<Mxe, DarkPoolOrder> {
        let order = DarkPoolOrder {
            side,
            token_mint: [0u8; 32],
            amount: 0,
            limit_price: 0,
            min_fill_amount: 0,
            expires_at,
        };
        mxe.from_arcis(order)
    }

    #[instruction]
    pub fn update_dark_pool_order(
        order_ctxt: Enc<Shared, DarkPoolOrder>,
        stored_ctxt: Enc<Mxe, DarkPoolOrder>,
    ) -> Enc<Mxe, DarkPoolOrder> {
        let order = order_ctxt.to_arcis();
        stored_ctxt.owner.from_arcis(order)
    }

    #[instruction]
    pub fn match_dark_pool_orders(
        buy_order: Enc<Mxe, DarkPoolOrder>,
        sell_order: Enc<Mxe, DarkPoolOrder>,
    ) -> bool {
        let buy = buy_order.to_arcis();
        let sell = sell_order.to_arcis();
        
        let tokens_match = buy.token_mint == sell.token_mint;
        let price_compatible = buy.limit_price >= sell.limit_price;
        let amount_sufficient = buy.amount >= sell.min_fill_amount && sell.amount >= buy.min_fill_amount;
        let sides_valid = buy.side == 0 && sell.side == 1;
        
        (tokens_match && price_compatible && amount_sufficient && sides_valid).reveal()
    }

    #[instruction]
    pub fn calculate_execution_price(
        buy_order: Enc<Mxe, DarkPoolOrder>,
        sell_order: Enc<Mxe, DarkPoolOrder>,
    ) -> Enc<Shared, OrderMatchResult> {
        let buy = buy_order.to_arcis();
        let sell = sell_order.to_arcis();
        
        let execution_price = (buy.limit_price + sell.limit_price) / 2;
        let fill_amount = if buy.amount < sell.amount { buy.amount } else { sell.amount };
        
        let is_matched = buy.limit_price >= sell.limit_price;
        
        let result = OrderMatchResult {
            is_matched,
            execution_price,
            fill_amount,
        };
        
        buy_order.owner.from_arcis(result)
    }


    #[instruction]
    pub fn init_swap_intent(
        mxe: Mxe,
        intent_id: [u8; 32],
    ) -> Enc<Mxe, SwapIntent> {
        let intent = SwapIntent {
            from_token: [0u8; 32],
            to_token: [0u8; 32],
            amount_in: 0,
            min_amount_out: 0,
            max_slippage_bps: 50,
            deadline: 0,
        };
        mxe.from_arcis(intent)
    }

    #[instruction]
    pub fn update_swap_intent(
        intent_ctxt: Enc<Shared, SwapIntent>,
        stored_ctxt: Enc<Mxe, SwapIntent>,
    ) -> Enc<Mxe, SwapIntent> {
        let intent = intent_ctxt.to_arcis();
        stored_ctxt.owner.from_arcis(intent)
    }

    #[instruction]
    pub fn execute_private_swap(
        intent_ctxt: Enc<Mxe, SwapIntent>,
        actual_output: u64,
        max_slippage_bps: u64,
    ) -> bool {
        let intent = intent_ctxt.to_arcis();
        
        let slippage_ok = actual_output >= intent.min_amount_out;
        let within_max_slippage = intent.max_slippage_bps <= max_slippage_bps;
        
        (slippage_ok && within_max_slippage).reveal()
    }

    #[instruction]
    pub fn verify_swap_fairness(
        intent_ctxt: Enc<Mxe, SwapIntent>,
        oracle_price: u64,
        execution_price: u64,
        max_deviation_bps: u64,
    ) -> bool {
        let _intent = intent_ctxt.to_arcis();
        
        let price_diff = if execution_price > oracle_price {
            execution_price - oracle_price
        } else {
            oracle_price - execution_price
        };
        
        let deviation_bps = (price_diff * 10000) / oracle_price;
        
        (deviation_bps <= max_deviation_bps).reveal()
    }

    #[instruction]
    pub fn compute_optimal_rebalance(
        position_ctxt: Enc<Mxe, EncryptedPosition>,
        target_health_bps: u64,
    ) -> u64 {
        let position = position_ctxt.to_arcis();
        
        if position.health_factor_bps >= target_health_bps {
            return 0u64.reveal();
        }
        
        let required_collateral = (position.debt_usd * target_health_bps) / 10000;
        let additional_needed = if required_collateral > position.collateral_usd {
            required_collateral - position.collateral_usd
        } else {
            0
        };
        
        additional_needed.reveal()
    }

    #[instruction]
    pub fn prove_no_front_running(
        intent_ctxt: Enc<Mxe, SwapIntent>,
        block_timestamp: i64,
        execution_timestamp: i64,
        max_delay_seconds: i64,
    ) -> bool {
        let intent = intent_ctxt.to_arcis();
        
        let within_deadline = execution_timestamp <= intent.deadline;
        let reasonable_delay = (execution_timestamp - block_timestamp) <= max_delay_seconds;
        
        (within_deadline && reasonable_delay).reveal()
    }

    pub struct AggregatedRiskMetrics {
        total_collateral: u64,
        total_debt: u64,
        weighted_health: u64,
        positions_at_risk: u8,
    }

    #[instruction]
    pub fn aggregate_portfolio_risk(
        positions: Enc<Shared, [EncryptedPosition; 10]>,
        risk_threshold_bps: u64,
    ) -> Enc<Shared, AggregatedRiskMetrics> {
        let pos_array = positions.to_arcis();
        
        let mut total_collateral: u64 = 0;
        let mut total_debt: u64 = 0;
        let mut positions_at_risk: u8 = 0;
        
        let mut i = 0;
        while i < 10 {
            if pos_array[i].debt_usd > 0 {
                total_collateral = total_collateral + pos_array[i].collateral_usd;
                total_debt = total_debt + pos_array[i].debt_usd;
                
                if pos_array[i].health_factor_bps < risk_threshold_bps {
                    positions_at_risk = positions_at_risk + 1;
                }
            }
            i = i + 1;
        }
        
        let weighted_health = if total_debt > 0 {
            (total_collateral * 10000) / total_debt
        } else {
            10000
        };
        
        let metrics = AggregatedRiskMetrics {
            total_collateral,
            total_debt,
            weighted_health,
            positions_at_risk,
        };
        
        positions.owner.from_arcis(metrics)
    }
}
