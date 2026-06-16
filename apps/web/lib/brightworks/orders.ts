import { buildDb } from "@/lib/db";

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Order {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  items: OrderItem[];
  shipping_address: ShippingAddress | null;
  created_at: string;
  updated_at: string;
}

export interface RmaRequest {
  id: string;
  order_id: string;
  reason: string;
  items_to_return: OrderItem[];
  status: string;
  safety_disclaimer_acknowledged: boolean;
  created_at: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  items: unknown;
  shipping_address: unknown;
  created_at: string;
  updated_at: string;
}

interface RmaRow {
  id: string;
  order_id: string;
  reason: string;
  items_to_return: unknown;
  status: string;
  safety_disclaimer_acknowledged: boolean;
  created_at: string;
}

function parseJsonField<T>(value: unknown): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  return value as T;
}

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  const db = buildDb();
  const rows = await db.query<OrderRow>(
    `SELECT id, order_number, status, total_cents, items, shipping_address,
     created_at::text, updated_at::text
     FROM bw_orders
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT 50`,
    userId,
  );

  return rows.map((row) => ({
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    total_cents: row.total_cents,
    items: parseJsonField<OrderItem[]>(row.items) ?? [],
    shipping_address: row.shipping_address
      ? parseJsonField<ShippingAddress>(row.shipping_address)
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getOrderForUser(
  orderId: string,
  userId: string,
): Promise<Order | null> {
  const db = buildDb();
  const rows = await db.query<OrderRow>(
    `SELECT id, order_number, status, total_cents, items, shipping_address,
     created_at::text, updated_at::text
     FROM bw_orders
     WHERE id = $1::uuid AND user_id = $2::uuid
     LIMIT 1`,
    orderId,
    userId,
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    total_cents: row.total_cents,
    items: parseJsonField<OrderItem[]>(row.items) ?? [],
    shipping_address: row.shipping_address
      ? parseJsonField<ShippingAddress>(row.shipping_address)
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listRmaRequestsForOrder(
  orderId: string,
): Promise<RmaRequest[]> {
  const db = buildDb();
  const rows = await db.query<RmaRow>(
    `SELECT id, order_id, reason, items_to_return, status,
     safety_disclaimer_acknowledged, created_at::text
     FROM bw_rma_requests
     WHERE order_id = $1::uuid
     ORDER BY created_at DESC`,
    orderId,
  );

  return rows.map((row) => ({
    id: row.id,
    order_id: row.order_id,
    reason: row.reason,
    items_to_return: parseJsonField<OrderItem[]>(row.items_to_return) ?? [],
    status: row.status,
    safety_disclaimer_acknowledged: row.safety_disclaimer_acknowledged,
    created_at: row.created_at,
  }));
}

export async function createRmaRequest(
  orderId: string,
  userId: string,
  reason: string,
  itemsToReturn: OrderItem[],
  safetyDisclaimerAcknowledged: boolean,
): Promise<{ id: string }> {
  const db = buildDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO bw_rma_requests
     (id, order_id, user_id, reason, items_to_return, status, safety_disclaimer_acknowledged)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, 'pending', $6)`,
    id,
    orderId,
    userId,
    reason,
    JSON.stringify(itemsToReturn),
    safetyDisclaimerAcknowledged,
  );
  return { id };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };
  return labels[status] ?? status;
}

export function rmaStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
    completed: "Completed",
  };
  return labels[status] ?? status;
}
