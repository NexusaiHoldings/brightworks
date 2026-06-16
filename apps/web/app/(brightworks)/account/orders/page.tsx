/**
 * /account/orders — authenticated homeowner order history.
 * F1-005: lists all orders placed by the current user with links to detail pages.
 */
import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import { getOrders } from "@/lib/brightworks/orders";
import type { OrderRow } from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function OrdersPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let orders: OrderRow[] = [];
  try {
    orders = await getOrders(user.id);
  } catch {
    orders = [];
  }

  return (
    <main>
      <h1>Order History</h1>
      <p>Track your Brightworks purchases and initiate returns when needed.</p>

      {orders.length === 0 ? (
        <div className="empty">
          <p>You have no orders yet.</p>
          <Link href="/products" className="btn">
            Browse Products
          </Link>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Date</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link
                    href={`/account/orders/${encodeURIComponent(order.id)}`}
                  >
                    {order.order_number}
                  </Link>
                </td>
                <td>{formatDate(order.created_at)}</td>
                <td>{order.item_count}</td>
                <td>{formatCents(order.total_cents)}</td>
                <td>{STATUS_LABEL[order.status] ?? order.status}</td>
                <td>
                  <Link
                    href={`/account/orders/${encodeURIComponent(order.id)}`}
                    className="btn secondary"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
