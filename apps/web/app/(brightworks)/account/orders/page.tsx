/**
 * /account/orders — customer order history (F1-005).
 *
 * Server component: fetches orders for the signed-in homeowner and renders
 * a plain-HTML table. Redirects to /login when unauthenticated.
 * Styling comes from the substrate globals.css baseline.
 */
import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import { listOrders } from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatCents(cents: number, currency = "usd"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrdersPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const orders = await listOrders(user.id);

  return (
    <main>
      <h1>Order History</h1>
      <p>View your Brightworks orders and request returns.</p>
      <p>
        <Link href="/account" className="btn secondary">← Back to Account</Link>
      </p>
      {orders.length === 0 ? (
        <div className="empty">
          <p>You have no orders yet. Products ordered through a Brightworks installer or our store will appear here.</p>
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
            {orders.map((o) => (
              <tr key={o.id}>
                <td><strong>{o.order_number}</strong></td>
                <td>{formatDate(o.placed_at)}</td>
                <td>{STATUS_LABELS[o.status] ?? o.status}</td>
                <td>{formatCents(o.total_cents, o.currency)}</td>
                <td>
                  <Link
                    href={`/account/orders/${encodeURIComponent(o.id)}`}
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
