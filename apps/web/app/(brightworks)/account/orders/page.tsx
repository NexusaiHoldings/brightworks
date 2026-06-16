import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import { getOrders } from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function OrdersPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const orders = await getOrders(user.id);

  return (
    <main>
      <h1>Order History</h1>
      <p>View your past orders, track shipments, and request returns.</p>

      {orders.length === 0 ? (
        <div className="empty">
          <p>You haven&apos;t placed any orders yet.</p>
          <Link href="/products" className="btn">
            Browse Products
          </Link>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>Status</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <code className="muted">{order.id.slice(0, 8)}&hellip;</code>
                </td>
                <td>{formatDate(order.created_at)}</td>
                <td style={{ textTransform: "capitalize" }}>{order.status}</td>
                <td>{formatCents(order.total_cents, order.currency)}</td>
                <td>
                  <Link
                    href={`/account/orders/${order.id}`}
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
