/**
 * Order history and RMA request logic for Brightworks.
 *
 * Uses the substrate's pg-backed Db adapter (buildDb) for parameterised SQL.
 * Tables: brightworks_orders, brightworks_order_items, brightworks_rma_requests.
 *
 * Note on schema: the DDL below documents the required tables. Production
 * deployments run this via the packages/db migration pipeline.
 *
 * IP65/weatherproof limitation disclaimer is enforced at checkout via
 * @nexus/legal-and-compliance before orders are created; this module only
 * reads completed orders and records RMA requests for human ops.
 */

import { buildDb } from "@/lib/db";

// ── Schema DDL (informational — picked up by packages/db/company/brightworks.ts) ──

export const BRIGHTWORKS_ORDERS_DDL = `
CREATE TABLE IF NOT EXISTS brightworks_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  status         text NOT NULL DEFAULT 'pending',
  total_amount   integer NOT NULL,
  shipping_name  text NOT NULL DEFAULT '',
  shipping_line1 text NOT NULL DEFAULT '',
  shipping_line2 text,
  shipping_city  text NOT NULL DEFAULT '',
  shipping_state text NOT NULL DEFAULT '',
  shipping_zip   text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brightworks_orders_user
  ON brightworks_orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS brightworks_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES brightworks_orders(id) ON DELETE CASCADE,
  sku          text NOT NULL,
  product_name text NOT NULL,
  quantity     integer NOT NULL,
  unit_price   integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brightworks_order_items_order
  ON brightworks_order_items (order_id);

CREATE TABLE IF NOT EXISTS brightworks_rma_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES brightworks_orders(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  reason      text NOT NULL,
  notes       text,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brightworks_rma_order
  ON brightworks_rma_requests (order_id);
`;

// ── Types ──

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type RmaStatus = "pending" | "approved" | "denied" | "completed";

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_name: string;
  shipping_line1: string;
  shipping_line2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface RmaRequest {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  notes: string | null;
  status: RmaStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateRmaInput {
  order_id: string;
  user_id: string;
  reason: string;
  notes?: string;
}

// ── Queries ──

/**
 * Fetch all orders for a given user, most-recent first.
 */
export async function getOrders(userId: string): Promise<Order[]> {
  const db = buildDb();
  return db.query<Order>(
    `SELECT id, user_id, status, total_amount,
            shipping_name, shipping_line1, shipping_line2,
            shipping_city, shipping_state, shipping_zip,
            created_at, updated_at
     FROM brightworks_orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    userId
  );
}

/**
 * Fetch a single order belonging to the given user. Returns null when the
 * order does not exist or belongs to a different user.
 */
export async function getOrderById(
  orderId: string,
  userId: string
): Promise<Order | null> {
  const db = buildDb();
  const rows = await db.query<Order>(
    `SELECT id, user_id, status, total_amount,
            shipping_name, shipping_line1, shipping_line2,
            shipping_city, shipping_state, shipping_zip,
            created_at, updated_at
     FROM brightworks_orders
     WHERE id = $1 AND user_id = $2`,
    orderId,
    userId
  );
  return rows[0] ?? null;
}

/**
 * Fetch all line items for an order.
 */
export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const db = buildDb();
  return db.query<OrderItem>(
    `SELECT id, order_id, sku, product_name, quantity, unit_price, created_at
     FROM brightworks_order_items
     WHERE order_id = $1
     ORDER BY created_at ASC`,
    orderId
  );
}

/**
 * Return the most-recent RMA request for a given order+user pair, or null.
 */
export async function getRmaForOrder(
  orderId: string,
  userId: string
): Promise<RmaRequest | null> {
  const db = buildDb();
  const rows = await db.query<RmaRequest>(
    `SELECT id, order_id, user_id, reason, notes, status, created_at, updated_at
     FROM brightworks_rma_requests
     WHERE order_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    orderId,
    userId
  );
  return rows[0] ?? null;
}

/**
 * Create a new RMA request record for human ops to action. Returns the
 * newly-inserted row.
 */
export async function createRmaRequest(
  input: CreateRmaInput
): Promise<RmaRequest> {
  const db = buildDb();
  const rows = await db.query<RmaRequest>(
    `INSERT INTO brightworks_rma_requests
       (id, order_id, user_id, reason, notes, status, created_at, updated_at)
     VALUES
       (gen_random_uuid(), $1, $2, $3, $4, 'pending', now(), now())
     RETURNING id, order_id, user_id, reason, notes, status, created_at, updated_at`,
    input.order_id,
    input.user_id,
    input.reason,
    input.notes ?? null
  );
  if (!rows[0]) {
    throw new Error("Failed to create RMA request");
  }
  return rows[0];
}

/**
 * Format a total_amount stored as integer cents into a display string.
 */
export function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Returns true for order statuses where a return can be initiated.
 */
export function isRmaEligible(status: OrderStatus): boolean {
  return status === "delivered" || status === "shipped";
}
