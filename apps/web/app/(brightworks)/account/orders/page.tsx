/**
 * /account/orders — customer order history (brightworks DTC).
 *
 * Server component; force-dynamic so session cookies are always read fresh.
 * Unauthenticated visitors are redirected to /login.
 */
import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import { listOrdersByUser } from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}

export default async function OrdersPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const orders = await listOrdersByUser(user.id);

  return (
    <main>
      <h1>Order History</h1>
      <p>View your past orders and request returns.</p>
      {orders.length === 0 ? (
        <div className="empty">
          <p>No orders yet.</p>
          <p className="muted">Your orders will appear here after purchase.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Date</th>
              <th>Status</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.order_number}</td>
                <td>{new Date(order.created_at).toLocaleDateString("en-US")}</td>
                <td>{statusLabel(order.status)}</td>
                <td>{formatCents(order.total_cents, order.currency)}</td>
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
