import { buildDb } from "@/lib/db";

export interface Order {
  id: string;
  user_id: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  tracking_number: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface RmaRequest {
  id: string;
  order_id: string;
  user_id: string;
  status: string;
  reason: string;
  notes: string | null;
  disclaimer_acknowledged: boolean;
  created_at: string;
}

export interface CreateRmaData {
  order_id: string;
  user_id: string;
  reason: string;
  notes: string | null;
  disclaimer_acknowledged: boolean;
}

export async function getOrders(userId: string): Promise<Order[]> {
  const db = buildDb();
  return db.query<Order>(
    `SELECT id, user_id, status, total_cents, currency,
            created_at, updated_at, shipping_address_line1,
            shipping_address_line2, shipping_city, shipping_state,
            shipping_zip, shipping_country, tracking_number
       FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    userId,
  );
}

export async function getOrderById(
  orderId: string,
  userId: string,
): Promise<OrderWithItems | null> {
  const db = buildDb();
  const orders = await db.query<Order>(
    `SELECT id, user_id, status, total_cents, currency,
            created_at, updated_at, shipping_address_line1,
            shipping_address_line2, shipping_city, shipping_state,
            shipping_zip, shipping_country, tracking_number
       FROM orders
      WHERE id = $1 AND user_id = $2`,
    orderId,
    userId,
  );
  if (orders.length === 0) return null;

  const items = await db.query<OrderItem>(
    `SELECT id, order_id, product_name, product_sku,
            quantity, unit_price_cents, subtotal_cents
       FROM order_items
      WHERE order_id = $1
      ORDER BY id ASC`,
    orderId,
  );

  return { ...orders[0], items };
}

export async function getRmaRequests(
  orderId: string,
  userId: string,
): Promise<RmaRequest[]> {
  const db = buildDb();
  return db.query<RmaRequest>(
    `SELECT id, order_id, user_id, status, reason, notes,
            disclaimer_acknowledged, created_at
       FROM rma_requests
      WHERE order_id = $1 AND user_id = $2
      ORDER BY created_at DESC`,
    orderId,
    userId,
  );
}

export async function createRmaRequest(
  data: CreateRmaData,
): Promise<RmaRequest> {
  const db = buildDb();
  const rows = await db.query<RmaRequest>(
    `INSERT INTO rma_requests
           (id, order_id, user_id, status, reason, notes,
            disclaimer_acknowledged, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'pending', $3, $4, $5, NOW(), NOW())
     RETURNING id, order_id, user_id, status, reason, notes,
               disclaimer_acknowledged, created_at`,
    data.order_id,
    data.user_id,
    data.reason,
    data.notes ?? null,
    data.disclaimer_acknowledged,
  );
  if (rows.length === 0) throw new Error("Failed to create RMA request");
  return rows[0];
}
