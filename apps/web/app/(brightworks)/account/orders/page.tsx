import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import { listOrders, formatCents } from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrdersPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/account/orders");

  const orders = await listOrders(user.id);

  return (
    <main>
      <h1>Order History</h1>
      <p>View your past orders and request returns (RMA) for delivered items.</p>

      {orders.length === 0 ? (
        <div className="empty">
          <p>You have not placed any orders yet.</p>
          <Link href="/" className="btn">Browse products</Link>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order</th>
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
                  <Link href={`/account/orders/${order.id}`}>
                    #{order.id.slice(0, 8).toUpperCase()}
                  </Link>
                </td>
                <td>{order.created_at.slice(0, 10)}</td>
                <td>
                  <span className="muted">
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </td>
                <td>{formatCents(order.total_cents)}</td>
                <td>
                  <Link href={`/account/orders/${order.id}`} className="btn secondary">
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
