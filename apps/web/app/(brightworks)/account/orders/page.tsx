import type { JSX } from "react";
import Link from "next/link";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getOrders,
  formatCurrency,
  formatOrderStatus,
} from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrdersPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    return (
      <main>
        <p>
          Please{" "}
          <Link href="/login" className="btn secondary">
            log in
          </Link>{" "}
          to view your orders.
        </p>
      </main>
    );
  }

  const orders = await getOrders(user.id);

  return (
    <main>
      <h1>Order History</h1>
      <p>View your past orders and initiate returns.</p>

      {orders.length === 0 ? (
        <div className="empty">
          <p>You haven&apos;t placed any orders yet.</p>
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
                <td>
                  <span className="muted">
                    {order.id.slice(0, 8).toUpperCase()}
                  </span>
                </td>
                <td>{new Date(order.created_at).toLocaleDateString()}</td>
                <td>{formatOrderStatus(order.status)}</td>
                <td>{formatCurrency(order.total_cents, order.currency)}</td>
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
