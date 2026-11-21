/**
 * Domain types for Hedgile trading application.
 * These types represent the core business concepts.
 */

/** Unique identifier for trades, contracts, and entities */
export type Id = string & { readonly brand: unique symbol };

/**
 * Represents a nickel trade in the system.
 * A trade can be a buy or sell of nickel.
 */
export interface Trade {
  id: Id;
  /** Type of trade: buy or sell */
  type: 'buy' | 'sell';
  /** Quantity in metric tons */
  quantity: number;
  /** Price per metric ton in USD */
  price: number;
  /** Trade date in ISO 8601 format */
  tradeDate: string;
  /** Settlement date in ISO 8601 format */
  settlementDate: string;
  /** Contract identifier */
  contractId: string;
  /** Counterparty name */
  counterparty: string;
  /** Status of the trade */
  status: TradeStatus;
  /** Creation timestamp in ISO 8601 format */
  createdAt: string;
  /** Last update timestamp in ISO 8601 format */
  updatedAt: string;
}

/** Possible statuses for a trade */
export type TradeStatus = 'pending' | 'confirmed' | 'settled' | 'cancelled' | 'invoiced';

/**
 * Represents a valuation of a trade or portfolio.
 */
export interface Valuation {
  id: Id;
  /** Reference date for the valuation */
  valuationDate: string;
  /** Total market value in USD */
  marketValue: number;
  /** Unrealized profit/loss in USD */
  unrealizedPnL: number;
  /** Realized profit/loss in USD */
  realizedPnL: number;
  /** Total profit/loss in USD */
  totalPnL: number;
  /** Currency of all monetary values */
  currency: string;
}

/**
 * Represents a daily position summary.
 */
export interface Position {
  /** Trading date in ISO 8601 format */
  date: string;
  /** Total quantity bought in metric tons */
  boughtQuantity: number;
  /** Total quantity sold in metric tons */
  soldQuantity: number;
  /** Net position (bought - sold) in metric tons */
  netPosition: number;
  /** Average buy price in USD/metric ton */
  averageBuyPrice: number | null;
  /** Average sell price in USD/metric ton */
  averageSellPrice: number | null;
}

/**
 * Input for creating a new trade.
 * Used for API requests and form submissions.
 */
export interface CreateTradeInput {
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  tradeDate: string;
  settlementDate: string;
  contractId: string;
  counterparty: string;
}

/**
 * Input for updating an existing trade.
 */
export interface UpdateTradeInput {
  id: Id;
  type?: 'buy' | 'sell';
  quantity?: number;
  price?: number;
  tradeDate?: string;
  settlementDate?: string;
  contractId?: string;
  counterparty?: string;
  status?: TradeStatus;
}

/**
 * Helper to create a typed ID from a string.
 * This is a type-safe way to create IDs.
 */
export function createId(id: string): Id {
  return id as Id;
}

/**
 * Helper to generate a new unique ID.
 */
export function generateId(): Id {
  return createId(crypto.randomUUID());
}
