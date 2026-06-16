import type { JSX } from "react";
import Link from "next/link";
import { getSessionUser } from "@/lib/admin-auth";
import { getOrdersByUser } from "@/lib/brightworks/orders";
import type { Order } from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_LABELS: Record<Order["status"], string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export default async function OrdersPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    return (
      <main>
        <p>
          Please <Link href="/login">log in</Link> to view your orders.
        </p>
      </main>
    );
  }

  let orders: Order[] = [];
  let fetchError = false;
  try {
    orders = await getOrdersByUser(user.id);
  } catch {
    fetchError = true;
  }

  return (
    <main>
      <h1>Order History</h1>
      <p>View your past orders and request returns or exchanges.</p>

      {fetchError && (
        <div className="card">
          <p className="muted">
            Unable to load orders at this time. Please try again later.
          </p>
        </div>
      )}

      {!fetchError && orders.length === 0 && (
        <div className="empty">
          <p>You have no orders yet.</p>
          <p className="muted">Orders placed through the Brightworks store will appear here.</p>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <code>{order.id.slice(0, 8).toUpperCase()}</code>
                </td>
                <td>{formatDate(order.created_at)}</td>
                <td>{STATUS_LABELS[order.status] ?? order.status}</td>
                <td>{formatCents(order.total_cents, order.currency)}</td>
                <td>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="btn secondary"
                  >
                    View details
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
