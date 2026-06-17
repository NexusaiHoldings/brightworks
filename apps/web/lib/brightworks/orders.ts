import { buildDb } from "@/lib/db";

export interface OrderItem {
  id: string;
  order_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
}

export interface Order {
  id: string;
  user_id: string;
  status: string;
  total_cents: number;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface RMARequest {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function ensureTables(): Promise<void> {
  const db = buildDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS brightworks_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_cents INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS brightworks_order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_cents INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS brightworks_rma_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL,
      user_id UUID NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function listOrders(userId: string): Promise<Order[]> {
  try {
    await ensureTables();
    const db = buildDb();
    return await db.query<Order>(
      `SELECT id, user_id, status, total_cents,
              created_at::text AS created_at,
              updated_at::text AS updated_at
       FROM brightworks_orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      userId
    );
  } catch {
    return [];
  }
}

export async function getOrder(orderId: string, userId: string): Promise<Order | null> {
  try {
    await ensureTables();
    const db = buildDb();
    const rows = await db.query<Order>(
      `SELECT id, user_id, status, total_cents,
              created_at::text AS created_at,
              updated_at::text AS updated_at
       FROM brightworks_orders
       WHERE id = $1 AND user_id = $2`,
      orderId, userId
    );
    if (rows.length === 0) return null;
    const order = rows[0];
    const items = await db.query<OrderItem>(
      `SELECT id, order_id, sku, name, quantity, unit_price_cents
       FROM brightworks_order_items
       WHERE order_id = $1
       ORDER BY id`,
      orderId
    );
    order.items = items;
    return order;
  } catch {
    return null;
  }
}

export async function getOrderRMARequests(orderId: string): Promise<RMARequest[]> {
  try {
    const db = buildDb();
    return await db.query<RMARequest>(
      `SELECT id, order_id, user_id, reason, notes, status,
              created_at::text AS created_at
       FROM brightworks_rma_requests
       WHERE order_id = $1
       ORDER BY created_at DESC`,
      orderId
    );
  } catch {
    return [];
  }
}

export async function createRMARequest(
  orderId: string,
  userId: string,
  reason: string,
  notes: string | null
): Promise<{ success: boolean; rma?: RMARequest; error?: string }> {
  try {
    const db = buildDb();
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM brightworks_rma_requests
       WHERE order_id = $1 AND user_id = $2 AND status NOT IN ('rejected', 'cancelled')
       LIMIT 1`,
      orderId, userId
    );
    if (existing.length > 0) {
      return { success: false, error: "An active RMA request already exists for this order." };
    }
    const rows = await db.query<RMARequest>(
      `INSERT INTO brightworks_rma_requests (order_id, user_id, reason, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, order_id, user_id, reason, notes, status,
                 created_at::text AS created_at`,
      orderId, userId, reason, notes
    );
    return { success: true, rma: rows[0] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create RMA request";
    return { success: false, error: message };
  }
}
