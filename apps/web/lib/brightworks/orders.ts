import { buildDb } from "@/lib/db";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type RmaStatus = "pending" | "approved" | "rejected" | "completed";

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  shipping_address: string;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
}

export interface RmaRequest {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  status: RmaStatus;
  created_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  rma_request: RmaRequest | null;
}

async function ensureOrderTables(): Promise<void> {
  const db = buildDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bw_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      shipping_address TEXT NOT NULL DEFAULT '',
      tracking_number TEXT,
      safety_disclaimer_acknowledged_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bw_order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES bw_orders(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_cents INTEGER NOT NULL DEFAULT 0,
      subtotal_cents INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bw_rma_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES bw_orders(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getOrders(userId: string): Promise<Order[]> {
  await ensureOrderTables();
  const db = buildDb();
  return db.query<Order>(
    `SELECT id, user_id, status, total_cents, currency,
            shipping_address, tracking_number, created_at, updated_at
       FROM bw_orders
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    userId,
  );
}

export async function getOrderWithItems(
  orderId: string,
  userId: string,
): Promise<OrderWithItems | null> {
  await ensureOrderTables();
  const db = buildDb();

  const orders = await db.query<Order>(
    `SELECT id, user_id, status, total_cents, currency,
            shipping_address, tracking_number, created_at, updated_at
       FROM bw_orders
      WHERE id = $1 AND user_id = $2`,
    orderId,
    userId,
  );

  if (orders.length === 0) return null;

  const order = orders[0];

  const items = await db.query<OrderItem>(
    `SELECT id, order_id, product_name, sku, quantity,
            unit_price_cents, subtotal_cents
       FROM bw_order_items
      WHERE order_id = $1
      ORDER BY created_at ASC`,
    orderId,
  );

  const rmaRows = await db.query<RmaRequest>(
    `SELECT id, order_id, user_id, reason, status, created_at
       FROM bw_rma_requests
      WHERE order_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    orderId,
    userId,
  );

  return {
    ...order,
    items,
    rma_request: rmaRows.length > 0 ? rmaRows[0] : null,
  };
}

export async function createRmaRequest(
  orderId: string,
  userId: string,
  reason: string,
): Promise<RmaRequest> {
  await ensureOrderTables();
  const db = buildDb();

  const results = await db.query<RmaRequest>(
    `INSERT INTO bw_rma_requests (order_id, user_id, reason, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id, order_id, user_id, reason, status, created_at`,
    orderId,
    userId,
    reason,
  );

  if (results.length === 0) {
    throw new Error("Failed to create RMA request");
  }

  return results[0];
}

export function formatCurrency(
  cents: number,
  currency: string = "USD",
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatOrderStatus(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}

export function formatRmaStatus(status: string): string {
  const labels: Record<string, string> = {
    pending: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
    completed: "Completed",
  };
  return labels[status] ?? status;
}

export function isRmaEligible(order: Order): boolean {
  return order.status === "delivered" || order.status === "shipped";
}
