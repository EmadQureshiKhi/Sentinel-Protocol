/**
 * Sentinel Protocol MPC Program
 * 
 * Privacy-preserving liquidation protection on Solana using Arcium Network.
 * Enables encrypted position monitoring, dark pool order matching, and MEV-protected swaps.
 * 
 * To build: arcium build
 * To test: arcium test
 * To deploy: arcium deploy --cluster-offset <offset>
 */

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

declare_id!("SENTpLHjqfWKdZ8RUgjvzwYRNQ5cuEAXeNBFcYew7LD");

const COMP_DEF_OFFSET_INIT_POSITION: u32 = comp_def_offset("init_encrypted_position");
const COMP_DEF_OFFSET_UPDATE_HEALTH: u32 = comp_def_offset("update_health_factor");
const COMP_DEF_OFFSET_PROVE_HEALTH: u32 = comp_def_offset("prove_health_threshold");
const COMP_DEF_OFFSET_INIT_DARK_ORDER: u32 = comp_def_offset("init_dark_pool_order");
const COMP_DEF_OFFSET_MATCH_ORDERS: u32 = comp_def_offset("match_dark_pool_orders");
const COMP_DEF_OFFSET_PRIVATE_SWAP: u32 = comp_def_offset("execute_private_swap");
const COMP_DEF_OFFSET_BATCH_HEALTH: u32 = comp_def_offset("batch_health_check");
const COMP_DEF_OFFSET_LIQUIDATION_RISK: u32 = comp_def_offset("calculate_liquidation_risk");

const SIGN_PDA_SEED: &[u8] = b"sentinel_sign";
const POSITION_PDA_SEED: &[u8] = b"sentinel_position";
const DARK_POOL_SEED: &[u8] = b"sentinel_dark_pool";

#[arcium_program]
pub mod sentinel_mpc {
    use super::*;

    pub fn init_position_comp_def(ctx: Context<InitPositionCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    pub fn init_health_comp_def(ctx: Context<InitHealthCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    pub fn init_dark_pool_comp_def(ctx: Context<InitDarkPoolCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    pub fn init_swap_comp_def(ctx: Context<InitSwapCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    pub fn init_encrypted_position(
        ctx: Context<InitEncryptedPosition>,
        computation_offset: u64,
        position_id: [u8; 32],
        protocol: u8,
    ) -> Result<()> {
        let args = vec![
            Argument::PlaintextBytes32(position_id),
            Argument::PlaintextU8(protocol),
        ];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![InitEncryptedPositionCallback::callback_ix(&[])],
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "init_encrypted_position")]
    pub fn init_encrypted_position_callback(
        ctx: Context<InitEncryptedPositionCallback>,
        output: ComputationOutputs<InitEncryptedPositionOutput>,
    ) -> Result<()> {
        let _position = match output {
            ComputationOutputs::Success(InitEncryptedPositionOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(PositionInitialized {
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn update_health_factor(
        ctx: Context<UpdateHealthFactor>,
        computation_offset: u64,
        position_id: [u8; 32],
    ) -> Result<()> {
        let args = vec![
            Argument::PlaintextBytes32(position_id),
        ];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![UpdateHealthFactorCallback::callback_ix(&[])],
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "update_health_factor")]
    pub fn update_health_factor_callback(
        ctx: Context<UpdateHealthFactorCallback>,
        output: ComputationOutputs<UpdateHealthFactorOutput>,
    ) -> Result<()> {
        let _health = match output {
            ComputationOutputs::Success(UpdateHealthFactorOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(HealthFactorUpdated {
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn prove_health_threshold(
        ctx: Context<ProveHealthThreshold>,
        computation_offset: u64,
        threshold_bps: u64,
    ) -> Result<()> {
        let args = vec![
            Argument::PlaintextU64(threshold_bps),
        ];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![ProveHealthThresholdCallback::callback_ix(&[])],
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "prove_health_threshold")]
    pub fn prove_health_threshold_callback(
        ctx: Context<ProveHealthThresholdCallback>,
        output: ComputationOutputs<ProveHealthThresholdOutput>,
    ) -> Result<()> {
        let is_healthy = match output {
            ComputationOutputs::Success(ProveHealthThresholdOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(HealthThresholdProved {
            is_healthy,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn init_dark_pool_order(
        ctx: Context<InitDarkPoolOrder>,
        computation_offset: u64,
        order_id: [u8; 32],
        side: u8,
        expires_at: i64,
    ) -> Result<()> {
        let args = vec![
            Argument::PlaintextBytes32(order_id),
            Argument::PlaintextU8(side),
            Argument::PlaintextI64(expires_at),
        ];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![InitDarkPoolOrderCallback::callback_ix(&[])],
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "init_dark_pool_order")]
    pub fn init_dark_pool_order_callback(
        ctx: Context<InitDarkPoolOrderCallback>,
        output: ComputationOutputs<InitDarkPoolOrderOutput>,
    ) -> Result<()> {
        let _order = match output {
            ComputationOutputs::Success(InitDarkPoolOrderOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(DarkPoolOrderCreated {
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn match_dark_pool_orders(
        ctx: Context<MatchDarkPoolOrders>,
        computation_offset: u64,
        buy_order_id: [u8; 32],
        sell_order_id: [u8; 32],
    ) -> Result<()> {
        let args = vec![
            Argument::PlaintextBytes32(buy_order_id),
            Argument::PlaintextBytes32(sell_order_id),
        ];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![MatchDarkPoolOrdersCallback::callback_ix(&[])],
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "match_dark_pool_orders")]
    pub fn match_dark_pool_orders_callback(
        ctx: Context<MatchDarkPoolOrdersCallback>,
        output: ComputationOutputs<MatchDarkPoolOrdersOutput>,
    ) -> Result<()> {
        let match_result = match output {
            ComputationOutputs::Success(MatchDarkPoolOrdersOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(DarkPoolOrdersMatched {
            is_matched: match_result,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn execute_private_swap(
        ctx: Context<ExecutePrivateSwap>,
        computation_offset: u64,
        intent_id: [u8; 32],
        max_slippage_bps: u64,
    ) -> Result<()> {
        let args = vec![
            Argument::PlaintextBytes32(intent_id),
            Argument::PlaintextU64(max_slippage_bps),
        ];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![ExecutePrivateSwapCallback::callback_ix(&[])],
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "execute_private_swap")]
    pub fn execute_private_swap_callback(
        ctx: Context<ExecutePrivateSwapCallback>,
        output: ComputationOutputs<ExecutePrivateSwapOutput>,
    ) -> Result<()> {
        let swap_success = match output {
            ComputationOutputs::Success(ExecutePrivateSwapOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(PrivateSwapExecuted {
            success: swap_success,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn batch_health_check(
        ctx: Context<BatchHealthCheck>,
        computation_offset: u64,
        position_count: u8,
    ) -> Result<()> {
        let args = vec![
            Argument::PlaintextU8(position_count),
        ];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![BatchHealthCheckCallback::callback_ix(&[])],
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "batch_health_check")]
    pub fn batch_health_check_callback(
        ctx: Context<BatchHealthCheckCallback>,
        output: ComputationOutputs<BatchHealthCheckOutput>,
    ) -> Result<()> {
        let at_risk_count = match output {
            ComputationOutputs::Success(BatchHealthCheckOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(BatchHealthChecked {
            at_risk_count,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn calculate_liquidation_risk(
        ctx: Context<CalculateLiquidationRisk>,
        computation_offset: u64,
        position_id: [u8; 32],
        price_impact_bps: u64,
    ) -> Result<()> {
        let args = vec![
            Argument::PlaintextBytes32(position_id),
            Argument::PlaintextU64(price_impact_bps),
        ];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![CalculateLiquidationRiskCallback::callback_ix(&[])],
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "calculate_liquidation_risk")]
    pub fn calculate_liquidation_risk_callback(
        ctx: Context<CalculateLiquidationRiskCallback>,
        output: ComputationOutputs<CalculateLiquidationRiskOutput>,
    ) -> Result<()> {
        let risk_level = match output {
            ComputationOutputs::Success(CalculateLiquidationRiskOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(LiquidationRiskCalculated {
            risk_level,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }
}


#[event]
pub struct PositionInitialized {
    pub timestamp: i64,
}

#[event]
pub struct HealthFactorUpdated {
    pub timestamp: i64,
}

#[event]
pub struct HealthThresholdProved {
    pub is_healthy: bool,
    pub timestamp: i64,
}

#[event]
pub struct DarkPoolOrderCreated {
    pub timestamp: i64,
}

#[event]
pub struct DarkPoolOrdersMatched {
    pub is_matched: bool,
    pub timestamp: i64,
}

#[event]
pub struct PrivateSwapExecuted {
    pub success: bool,
    pub timestamp: i64,
}

#[event]
pub struct BatchHealthChecked {
    pub at_risk_count: u8,
    pub timestamp: i64,
}

#[event]
pub struct LiquidationRiskCalculated {
    pub risk_level: u8,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not configured")]
    ClusterNotSet,
    #[msg("Invalid position state")]
    InvalidPositionState,
    #[msg("Order expired")]
    OrderExpired,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
}

#[init_computation_definition_accounts("init_encrypted_position", payer)]
#[derive(Accounts)]
pub struct InitPositionCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("prove_health_threshold", payer)]
#[derive(Accounts)]
pub struct InitHealthCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("init_dark_pool_order", payer)]
#[derive(Accounts)]
pub struct InitDarkPoolCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("execute_private_swap", payer)]
#[derive(Accounts)]
pub struct InitSwapCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("init_encrypted_position", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct InitEncryptedPosition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_POSITION))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("init_encrypted_position")]
#[derive(Accounts)]
pub struct InitEncryptedPositionCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_POSITION))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}

#[queue_computation_accounts("update_health_factor", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct UpdateHealthFactor<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_UPDATE_HEALTH))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("update_health_factor")]
#[derive(Accounts)]
pub struct UpdateHealthFactorCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_UPDATE_HEALTH))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}


#[queue_computation_accounts("prove_health_threshold", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ProveHealthThreshold<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PROVE_HEALTH))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("prove_health_threshold")]
#[derive(Accounts)]
pub struct ProveHealthThresholdCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PROVE_HEALTH))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}

#[queue_computation_accounts("init_dark_pool_order", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct InitDarkPoolOrder<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_DARK_ORDER))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("init_dark_pool_order")]
#[derive(Accounts)]
pub struct InitDarkPoolOrderCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_DARK_ORDER))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}

#[queue_computation_accounts("match_dark_pool_orders", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct MatchDarkPoolOrders<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_MATCH_ORDERS))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("match_dark_pool_orders")]
#[derive(Accounts)]
pub struct MatchDarkPoolOrdersCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_MATCH_ORDERS))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}

#[queue_computation_accounts("execute_private_swap", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ExecutePrivateSwap<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PRIVATE_SWAP))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("execute_private_swap")]
#[derive(Accounts)]
pub struct ExecutePrivateSwapCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PRIVATE_SWAP))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}

#[queue_computation_accounts("batch_health_check", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct BatchHealthCheck<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_BATCH_HEALTH))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("batch_health_check")]
#[derive(Accounts)]
pub struct BatchHealthCheckCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_BATCH_HEALTH))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}

#[queue_computation_accounts("calculate_liquidation_risk", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct CalculateLiquidationRisk<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_LIQUIDATION_RISK))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("calculate_liquidation_risk")]
#[derive(Accounts)]
pub struct CalculateLiquidationRiskCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_LIQUIDATION_RISK))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}
