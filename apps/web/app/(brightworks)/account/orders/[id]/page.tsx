/**
 * /account/orders/[id] — Order detail page with RMA request initiation.
 *
 * Server component. RMA form submission is handled via an inline server action
 * so no 'use client' wrapper is needed.
 *
 * RMA eligibility: orders with status 'shipped' or 'delivered'.
 * Submitted RMA records are stored for human ops — no 3PL API integration at MVP
 * (per feasibility_analysis human_ops_required: 'Returns processing and reverse
 * logistics').
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getOrderById,
  getOrderItems,
  getRmaForOrder,
  formatAmount,
  isRmaEligible,
} from "@/lib/brightworks/orders";

export const metadata = {
  title: "Order Details | Brightworks",
};

interface PageProps {
  params: { id: string };
}

export default async function OrderDetailPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [order, items, existingRma] = await Promise.all([
    getOrderById(params.id, user.id),
    getOrderItems(params.id),
    getRmaForOrder(params.id, user.id),
  ]);

  if (!order) {
    notFound();
  }

  const rmaEligible = isRmaEligible(order.status);

  async function submitRmaRequest(formData: FormData) {
    "use server";

    // Re-validate session and ownership inside the action (server actions are
    // public POST endpoints; never rely solely on the render-time user check).
    const { getSessionUser: revalidate } = await import("@/lib/admin-auth");
    const { createRmaRequest: insertRma, getOrderById: verifyOwnership } =
      await import("@/lib/brightworks/orders");

    const sessionUser = await revalidate();
    if (!sessionUser) redirect("/login");

    // params.id is the URL segment — always a string.
    const verifiedOrder = await verifyOwnership(params.id, sessionUser.id);
    if (!verifiedOrder) redirect("/account/orders");

    const reason = formData.get("reason");
    const notes = formData.get("notes");

    if (typeof reason !== "string" || !reason.trim()) return;

    await insertRma({
      order_id: params.id,
      user_id: sessionUser.id,
      reason: reason.trim(),
      notes:
        typeof notes === "string" && notes.trim() ? notes.trim() : undefined,
    });

    redirect(`/account/orders/${params.id}?rma=submitted`);
  }

  const shippingAddress = [
    order.shipping_name,
    order.shipping_line1,
    order.shipping_line2,
    `${order.shipping_city}, ${order.shipping_state} ${order.shipping_zip}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main>
      <p>
        <Link href="/account/orders">← Back to Order History</Link>
      </p>

      <h1>Order Details</h1>
      <p>
        Order <strong>{order.id.slice(0, 8).toUpperCase()}</strong> placed on{" "}
        {new Date(order.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      <div className="card">
        <h2>Order Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No items found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product_name}</td>
                  <td className="muted">{item.sku}</td>
                  <td>{item.quantity}</td>
                  <td>{formatAmount(item.unit_price)}</td>
                  <td>{formatAmount(item.unit_price * item.quantity)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>
                <strong>Order Total</strong>
              </td>
              <td>
                <strong>{formatAmount(order.total_amount)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card">
        <h2>Shipping Address</h2>
        <p style={{ whiteSpace: "pre-line" }}>{shippingAddress}</p>
        <p>
          <strong>Status:</strong>{" "}
          <span style={{ textTransform: "capitalize" }}>{order.status}</span>
        </p>
      </div>

      <div className="card">
        <h2>Return Request (RMA)</h2>

        {existingRma ? (
          <div>
            <p>
              A return request was submitted on{" "}
              {new Date(existingRma.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              .
            </p>
            <table>
              <tbody>
                <tr>
                  <th>Status</th>
                  <td style={{ textTransform: "capitalize" }}>{existingRma.status}</td>
                </tr>
                <tr>
                  <th>Reason</th>
                  <td>{existingRma.reason}</td>
                </tr>
                {existingRma.notes && (
                  <tr>
                    <th>Notes</th>
                    <td>{existingRma.notes}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="muted">
              Our team will contact you at your registered email to arrange the
              return shipment.
            </p>
          </div>
        ) : rmaEligible ? (
          <div>
            <p>
              Not satisfied with your order? Submit a return request below and
              our team will follow up within 2 business days.
            </p>
            <p className="muted">
              Note: Brightworks products are rated IP65 for weather resistance.
              Damage caused by submersion or exposure beyond IP65 limits is not
              covered under our return policy.
            </p>
            <form action={submitRmaRequest}>
              <div>
                <label htmlFor="reason">
                  Reason for return <span aria-hidden="true">*</span>
                </label>
                <select id="reason" name="reason" required>
                  <option value="">Select a reason…</option>
                  <option value="Defective or not working">
                    Defective or not working
                  </option>
                  <option value="Wrong item received">Wrong item received</option>
                  <option value="Item does not match description">
                    Item does not match description
                  </option>
                  <option value="Changed my mind">Changed my mind</option>
                  <option value="Arrived damaged">Arrived damaged</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="notes">Additional details (optional)</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  placeholder="Describe the issue in more detail…"
                />
              </div>
              <button type="submit">Submit Return Request</button>
            </form>
          </div>
        ) : (
          <div className="empty">
            <p>
              Returns can only be initiated for shipped or delivered orders.
              Current status:{" "}
              <span style={{ textTransform: "capitalize" }}>{order.status}</span>
              .
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
