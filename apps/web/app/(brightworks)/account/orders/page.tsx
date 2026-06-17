/**
 * /account/orders — Customer order history page.
 *
 * Server component: fetches orders server-side after session validation.
 * Redirects to /login when the user is not authenticated.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/admin-auth";
import { getOrders, formatAmount } from "@/lib/brightworks/orders";

export const metadata = {
  title: "Order History | Brightworks",
};

export default async function OrdersPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const orders = await getOrders(user.id);

  return (
    <main>
      <h1>Order History</h1>
      <p>Track your Brightworks orders and request returns for eligible items.</p>

      {orders.length === 0 ? (
        <div className="empty">
          <p>You have no orders yet. Browse our products to place your first order.</p>
          <Link href="/products" className="btn">
            Shop Now
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <span className="muted">{order.id.slice(0, 8).toUpperCase()}</span>
                </td>
                <td>
                  {new Date(order.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td>
                  <span style={{ textTransform: "capitalize" }}>{order.status}</span>
                </td>
                <td>{formatAmount(order.total_amount)}</td>
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
