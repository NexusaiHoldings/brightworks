/**
 * Order history and RMA request data layer for Brightworks.
 *
 * Queries brightworks_orders, brightworks_order_items, and
 * brightworks_rma_requests tables via the substrate pg pool.
 * All queries use parameterized placeholders ($1, $2) — never string
 * interpolation for user-supplied values.
 */
import { buildDb } from "@/lib/db";

export interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  total_cents: number;
  item_count: number;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price_cents: number;
}

export interface OrderDetailRow {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  total_cents: number;
  item_count: number;
  shipping_name: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  items: OrderItemRow[];
}

export interface RmaRow {
  id: string;
  order_id: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
}

export async function getOrders(userId: string): Promise<OrderRow[]> {
  const db = buildDb();
  return db.query<OrderRow>(
    `SELECT
       id,
       order_number,
       status,
       created_at::text,
       total_cents,
       item_count
     FROM brightworks_orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    userId,
  );
}

export async function getOrderById(
  orderId: string,
  userId: string,
): Promise<OrderDetailRow | null> {
  const db = buildDb();

  const rows = await db.query<Omit<OrderDetailRow, "items">>(
    `SELECT
       id,
       order_number,
       status,
       created_at::text,
       total_cents,
       item_count,
       shipping_name,
       shipping_address_line1,
       shipping_address_line2,
       shipping_city,
       shipping_state,
       shipping_zip
     FROM brightworks_orders
     WHERE id = $1
       AND user_id = $2`,
    orderId,
    userId,
  );

  const orderBase = rows[0];
  if (!orderBase) return null;

  const items = await db.query<OrderItemRow>(
    `SELECT
       id,
       order_id,
       product_name,
       sku,
       quantity,
       unit_price_cents
     FROM brightworks_order_items
     WHERE order_id = $1
     ORDER BY created_at ASC`,
    orderId,
  );

  const result: OrderDetailRow = {
    id: orderBase.id,
    order_number: orderBase.order_number,
    status: orderBase.status,
    created_at: orderBase.created_at,
    total_cents: orderBase.total_cents,
    item_count: orderBase.item_count,
    shipping_name: orderBase.shipping_name,
    shipping_address_line1: orderBase.shipping_address_line1,
    shipping_address_line2: orderBase.shipping_address_line2,
    shipping_city: orderBase.shipping_city,
    shipping_state: orderBase.shipping_state,
    shipping_zip: orderBase.shipping_zip,
    items,
  };

  return result;
}

export async function getOrderRmaRequests(orderId: string): Promise<RmaRow[]> {
  const db = buildDb();
  return db.query<RmaRow>(
    `SELECT
       id,
       order_id,
       reason,
       notes,
       status,
       created_at::text
     FROM brightworks_rma_requests
     WHERE order_id = $1
     ORDER BY created_at DESC`,
    orderId,
  );
}

export async function createRmaRequest(
  orderId: string,
  userId: string,
  reason: string,
  notes: string,
): Promise<string> {
  const db = buildDb();
  const rows = await db.query<{ id: string }>(
    `INSERT INTO brightworks_rma_requests
       (id, order_id, user_id, reason, notes, status, created_at)
     VALUES
       (gen_random_uuid(), $1, $2, $3, $4, 'pending', NOW())
     RETURNING id`,
    orderId,
    userId,
    reason,
    notes,
  );
  const row = rows[0];
  if (!row) throw new Error("RMA request creation failed — no row returned");
  return row.id;
}
