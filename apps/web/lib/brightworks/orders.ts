/**
 * Order history + RMA data access (F1-005).
 *
 * Server-only. Uses the same externalized `pg` pool pattern as lib/blog.ts.
 * All queries are parameterized ($1, $2 …). Tables are prefixed brightworks_
 * to avoid collisions with lego-owned tables.
 */

export interface OrderItem {
  id: string;
  order_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  shipping_address: string | null;
  notes: string | null;
  placed_at: string;
  created_at: string;
  updated_at: string;
}

export interface RmaRequest {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  details: string | null;
  status: "pending" | "approved" | "rejected" | "completed";
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
} {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool: PgPool } = require("pg") as {
    Pool: new (config: Record<string, unknown>) => {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    };
  };
  _pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

function toOrder(r: Record<string, unknown>): Order {
  return {
    id: String(r.id),
    order_number: String(r.order_number),
    user_id: String(r.user_id),
    status: String(r.status) as Order["status"],
    subtotal_cents: Number(r.subtotal_cents ?? 0),
    tax_cents: Number(r.tax_cents ?? 0),
    shipping_cents: Number(r.shipping_cents ?? 0),
    total_cents: Number(r.total_cents ?? 0),
    currency: String(r.currency ?? "usd"),
    shipping_address: r.shipping_address ? String(r.shipping_address) : null,
    notes: r.notes ? String(r.notes) : null,
    placed_at: String(r.placed_at),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function listOrders(userId: string): Promise<Order[]> {
  try {
    const { rows } = await getPool().query(
      `SELECT id, order_number, user_id, status, subtotal_cents, tax_cents,
              shipping_cents, total_cents, currency, shipping_address,
              notes, placed_at, created_at, updated_at
         FROM brightworks_orders
        WHERE user_id = $1
        ORDER BY placed_at DESC
        LIMIT 100`,
      [userId],
    );
    return (rows as Record<string, unknown>[]).map(toOrder);
  } catch {
    return [];
  }
}

export async function getOrder(
  orderId: string,
  userId: string,
): Promise<Order | null> {
  try {
    const { rows } = await getPool().query(
      `SELECT id, order_number, user_id, status, subtotal_cents, tax_cents,
              shipping_cents, total_cents, currency, shipping_address,
              notes, placed_at, created_at, updated_at
         FROM brightworks_orders
        WHERE id = $1 AND user_id = $2
        LIMIT 1`,
      [orderId, userId],
    );
    const r = rows[0] as Record<string, unknown> | undefined;
    if (!r) return null;
    return toOrder(r);
  } catch {
    return null;
  }
}

export async function listOrderItems(orderId: string): Promise<OrderItem[]> {
  try {
    const { rows } = await getPool().query(
      `SELECT id, order_id, sku, name, quantity, unit_price_cents, total_price_cents
         FROM brightworks_order_items
        WHERE order_id = $1
        ORDER BY id`,
      [orderId],
    );
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      order_id: String(r.order_id),
      sku: String(r.sku),
      name: String(r.name),
      quantity: Number(r.quantity),
      unit_price_cents: Number(r.unit_price_cents ?? 0),
      total_price_cents: Number(r.total_price_cents ?? 0),
    }));
  } catch {
    return [];
  }
}

export async function getRmaForOrder(orderId: string): Promise<RmaRequest | null> {
  try {
    const { rows } = await getPool().query(
      `SELECT id, order_id, user_id, reason, details, status, created_at, updated_at
         FROM brightworks_rma_requests
        WHERE order_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [orderId],
    );
    const r = rows[0] as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: String(r.id),
      order_id: String(r.order_id),
      user_id: String(r.user_id),
      reason: String(r.reason),
      details: r.details ? String(r.details) : null,
      status: String(r.status) as RmaRequest["status"],
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  } catch {
    return null;
  }
}

export async function createRmaRequest(
  orderId: string,
  userId: string,
  reason: string,
  details: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { rows } = await getPool().query(
      `INSERT INTO brightworks_rma_requests
         (order_id, user_id, reason, details, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [orderId, userId, reason, details || null],
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return { success: false, error: "Failed to create RMA request." };
    return { success: true, id: String(row.id) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
