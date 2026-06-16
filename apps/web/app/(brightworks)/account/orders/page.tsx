import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  listOrdersForUser,
  formatCents,
  statusLabel,
} from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrdersPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  let orders: Awaited<ReturnType<typeof listOrdersForUser>> = [];
  let fetchError: string | null = null;
  try {
    orders = await listOrdersForUser(user.id);
  } catch (err) {
    fetchError = "Unable to load orders at this time. Please try again later.";
    console.error("[brightworks/orders] listOrdersForUser failed:", err);
  }

  return (
    <main>
      <h1>Order History</h1>
      <p>View your past orders and initiate return requests.</p>

      {fetchError && (
        <div role="alert" className="card">
          <p>{fetchError}</p>
        </div>
      )}

      {!fetchError && orders.length === 0 && (
        <div className="empty">
          <p>You have no orders yet.</p>
          <Link href="/products" className="btn">
            Browse Products
          </Link>
        </div>
      )}

      {!fetchError && orders.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Order #</th>
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
                  <strong>{order.order_number}</strong>
                </td>
                <td>
                  {new Date(order.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td>{statusLabel(order.status)}</td>
                <td>{formatCents(order.total_cents)}</td>
                <td>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="btn secondary"
                  >
                    View Details
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
