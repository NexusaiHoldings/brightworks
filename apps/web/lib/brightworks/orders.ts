/**
 * Order data access — brightworks DTC e-commerce.
 *
 * Server-only. Uses `pg` pool (same externalization pattern as lib/blog.ts).
 * Tables: orders, order_items, rma_requests.
 * All functions catch DB errors and return empty/null so pages degrade
 * gracefully on fresh deploys before migrations run.
 */

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: string;
  total_cents: number;
  currency: string;
  shipping_address: Record<string, string> | null;
  safety_disclaimer_acknowledged: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  image_url: string | null;
}

export interface RmaRequest {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  items_requested: string[];
  status: string;
  ops_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWithItems {
  order: Order;
  items: OrderItem[];
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

export async function listOrdersByUser(userId: string): Promise<Order[]> {
  try {
    const { rows } = await getPool().query(
      `SELECT id, user_id, order_number, status, total_cents, currency,
              shipping_address, safety_disclaimer_acknowledged, created_at, updated_at
         FROM orders
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [userId],
    );
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      user_id: String(r.user_id),
      order_number: String(r.order_number),
      status: String(r.status),
      total_cents: Number(r.total_cents),
      currency: String(r.currency ?? "usd"),
      shipping_address: r.shipping_address
        ? (r.shipping_address as Record<string, string>)
        : null,
      safety_disclaimer_acknowledged: Boolean(r.safety_disclaimer_acknowledged),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    }));
  } catch {
    return [];
  }
}

export async function getOrderWithItems(
  orderId: string,
  userId: string,
): Promise<OrderWithItems | null> {
  try {
    const { rows: orderRows } = await getPool().query(
      `SELECT id, user_id, order_number, status, total_cents, currency,
              shipping_address, safety_disclaimer_acknowledged, created_at, updated_at
         FROM orders
        WHERE id = $1 AND user_id = $2
        LIMIT 1`,
      [orderId, userId],
    );
    if (orderRows.length === 0) return null;

    const r = orderRows[0] as Record<string, unknown>;
    const order: Order = {
      id: String(r.id),
      user_id: String(r.user_id),
      order_number: String(r.order_number),
      status: String(r.status),
      total_cents: Number(r.total_cents),
      currency: String(r.currency ?? "usd"),
      shipping_address: r.shipping_address
        ? (r.shipping_address as Record<string, string>)
        : null,
      safety_disclaimer_acknowledged: Boolean(r.safety_disclaimer_acknowledged),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };

    const { rows: itemRows } = await getPool().query(
      `SELECT id, order_id, sku, product_name, quantity, unit_price_cents, image_url
         FROM order_items
        WHERE order_id = $1
        ORDER BY created_at ASC`,
      [orderId],
    );
    const items: OrderItem[] = (itemRows as Record<string, unknown>[]).map(
      (ir) => ({
        id: String(ir.id),
        order_id: String(ir.order_id),
        sku: String(ir.sku),
        product_name: String(ir.product_name),
        quantity: Number(ir.quantity),
        unit_price_cents: Number(ir.unit_price_cents),
        image_url: ir.image_url ? String(ir.image_url) : null,
      }),
    );

    return { order, items };
  } catch {
    return null;
  }
}

export async function getRmaRequestsByOrder(
  orderId: string,
): Promise<RmaRequest[]> {
  try {
    const { rows } = await getPool().query(
      `SELECT id, order_id, user_id, reason, items_requested, status, ops_notes,
              created_at, updated_at
         FROM rma_requests
        WHERE order_id = $1
        ORDER BY created_at DESC`,
      [orderId],
    );
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      order_id: String(r.order_id),
      user_id: String(r.user_id),
      reason: String(r.reason),
      items_requested: Array.isArray(r.items_requested)
        ? (r.items_requested as string[])
        : [],
      status: String(r.status),
      ops_notes: r.ops_notes ? String(r.ops_notes) : null,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    }));
  } catch {
    return [];
  }
}

export async function createRmaRequest(
  orderId: string,
  userId: string,
  reason: string,
  items: string[],
): Promise<RmaRequest | null> {
  try {
    const { rows } = await getPool().query(
      `INSERT INTO rma_requests
         (order_id, user_id, reason, items_requested, status)
       VALUES ($1, $2, $3, $4::jsonb, 'pending')
       RETURNING id, order_id, user_id, reason, items_requested, status,
                 ops_notes, created_at, updated_at`,
      [orderId, userId, reason, JSON.stringify(items)],
    );
    if (rows.length === 0) return null;
    const r = rows[0] as Record<string, unknown>;
    return {
      id: String(r.id),
      order_id: String(r.order_id),
      user_id: String(r.user_id),
      reason: String(r.reason),
      items_requested: Array.isArray(r.items_requested)
        ? (r.items_requested as string[])
        : [],
      status: String(r.status),
      ops_notes: r.ops_notes ? String(r.ops_notes) : null,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  } catch {
    return null;
  }
}
