import { buildDb } from "@/lib/db";

export interface Order {
  id: string;
  user_id: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";
  total_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
  tracking_number: string | null;
  shipping_address: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
}

export interface RmaRequest {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "completed";
  created_at: string;
}

export async function getOrdersByUser(userId: string): Promise<Order[]> {
  const db = buildDb();
  return db.query<Order>(
    `SELECT id, user_id, status, total_cents, currency, created_at, updated_at,
            tracking_number, shipping_address
       FROM orders
      WHERE user_id = $1::uuid
      ORDER BY created_at DESC`,
    userId,
  );
}

export async function getOrderById(
  orderId: string,
  userId: string,
): Promise<Order | null> {
  const db = buildDb();
  const rows = await db.query<Order>(
    `SELECT id, user_id, status, total_cents, currency, created_at, updated_at,
            tracking_number, shipping_address
       FROM orders
      WHERE id = $1::uuid AND user_id = $2::uuid
      LIMIT 1`,
    orderId,
    userId,
  );
  return rows[0] ?? null;
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const db = buildDb();
  return db.query<OrderItem>(
    `SELECT id, order_id, sku, name, quantity, unit_price_cents
       FROM order_items
      WHERE order_id = $1::uuid
      ORDER BY id ASC`,
    orderId,
  );
}

export async function getRmasByOrder(orderId: string): Promise<RmaRequest[]> {
  const db = buildDb();
  return db.query<RmaRequest>(
    `SELECT id, order_id, user_id, reason, status, created_at
       FROM rma_requests
      WHERE order_id = $1::uuid
      ORDER BY created_at DESC`,
    orderId,
  );
}

export async function createRmaRequest(input: {
  orderId: string;
  userId: string;
  reason: string;
}): Promise<RmaRequest> {
  const db = buildDb();
  const id = crypto.randomUUID();
  const rows = await db.query<RmaRequest>(
    `INSERT INTO rma_requests (id, order_id, user_id, reason, status, created_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'pending', NOW())
     RETURNING id, order_id, user_id, reason, status, created_at`,
    id,
    input.orderId,
    input.userId,
    input.reason,
  );
  const created = rows[0];
  if (!created) {
    throw new Error("RMA insert returned no rows");
  }
  return created;
}
