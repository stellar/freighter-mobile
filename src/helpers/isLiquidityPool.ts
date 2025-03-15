import { Balance, LiquidityPoolBalance } from "services/backend";

/**
 * Check if balance is a liquidity pool
 */
export const isLiquidityPool = (
  balance: Balance,
): balance is LiquidityPoolBalance =>
  "liquidityPoolId" in balance && "reserves" in balance;
