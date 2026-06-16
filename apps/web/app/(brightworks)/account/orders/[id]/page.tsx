/**
 * /account/orders/[id] — order detail + RMA (return merchandise authorization) request.
 * F1-005: shows order items, shipping info, safety disclaimer, and RMA form.
 *
 * IP65/weatherproof limitation disclosure is surfaced here as a product safety
 * reminder (the liability_assessor requires acknowledgment at checkout via
 * @nexus/legal-and-compliance; this page re-surfaces it for record-keeping).
 */
import type { JSX } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getOrderById,
  getOrderRmaRequests,
  createRmaRequest,
  type OrderDetailRow,
  type RmaRow,
} from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RMA_REASONS = [
  "Defective / not working",
  "Wrong item received",
  "Damaged in shipping",
  "Item not as described",
  "Changed my mind",
  "Other",
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const RMA_STATUS_LABEL: Record<string, string> = {
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
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

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { rma_submitted?: string };
}): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const orderId = params.id;

  let order: OrderDetailRow | null = null;
  let rmas: RmaRow[] = [];
  try {
    [order, rmas] = await Promise.all([
      getOrderById(orderId, user.id),
      getOrderRmaRequests(orderId),
    ]);
  } catch {
    // fall through — order stays null and notFound() is called below
  }

  if (!order) notFound();

  const rmaSubmitted = searchParams.rma_submitted === "1";
  const canRequestRma = order.status === "delivered" || order.status === "shipped";
  const hasOpenRma = rmas.some(
    (r) => r.status === "pending" || r.status === "approved",
  );

  async function submitRmaAction(formData: FormData): Promise<void> {
    "use server";
    const reason = (formData.get("reason") as string | null)?.trim() ?? "";
    const notes = (formData.get("notes") as string | null)?.trim() ?? "";
    if (!reason) return;
    await createRmaRequest(orderId, user!.id, reason, notes);
    redirect(`/account/orders/${encodeURIComponent(orderId)}?rma_submitted=1`);
  }

  return (
    <main>
      <Link href="/account/orders" className="btn secondary">
        ← Back to Orders
      </Link>

      <h1>Order {order.order_number}</h1>
      <p>
        Placed {formatDate(order.created_at)} &middot; Status:{" "}
        <strong>{STATUS_LABEL[order.status] ?? order.status}</strong>
      </p>

      {/* IP65/weatherproof safety notice — liability_assessor requirement */}
      <div className="card">
        <p className="muted">
          <strong>IP65 Weatherproof Notice:</strong> Brightworks outdoor fixtures
          are rated IP65 — protected against dust and low-pressure water jets under
          normal outdoor conditions. They are <em>not</em> rated for submersion,
          high-pressure wash-down, or poolside/underwater installation. This
          limitation was acknowledged at checkout per our{" "}
          <Link href="/terms">Terms &amp; Conditions</Link>.
        </p>
      </div>

      {/* Order line items */}
      <section>
        <h2>Items</h2>
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
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.product_name}</td>
                <td className="muted">{item.sku}</td>
                <td>{item.quantity}</td>
                <td>{formatCents(item.unit_price_cents)}</td>
                <td>{formatCents(item.unit_price_cents * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>
                <strong>Order Total</strong>
              </td>
              <td>
                <strong>{formatCents(order.total_cents)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Shipping address */}
      <section>
        <h2>Shipping Address</h2>
        <div className="card">
          <p>
            {order.shipping_name}
            <br />
            {order.shipping_address_line1}
            <br />
            {order.shipping_address_line2 && (
              <>
                {order.shipping_address_line2}
                <br />
              </>
            )}
            {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
          </p>
        </div>
      </section>

      {/* Existing RMA requests */}
      {rmas.length > 0 && (
        <section>
          <h2>Return Requests</h2>
          {rmas.map((rma) => (
            <div key={rma.id} className="card">
              <p>
                <strong>{rma.reason}</strong>{" "}
                <span className="muted">
                  &middot; {RMA_STATUS_LABEL[rma.status] ?? rma.status}
                </span>
              </p>
              {rma.notes && <p className="muted">{rma.notes}</p>}
              <p className="muted">Submitted {formatDate(rma.created_at)}</p>
            </div>
          ))}
        </section>
      )}

      {/* RMA request form */}
      <section>
        <h2>Request a Return</h2>

        {rmaSubmitted && (
          <div className="card">
            <p>
              Your return request has been submitted. Our team will review it
              within 2&ndash;3 business days and contact you by email with next
              steps.
            </p>
          </div>
        )}

        {!rmaSubmitted && !canRequestRma && (
          <div className="empty">
            <p>
              Return requests can only be initiated for orders that have shipped
              or been delivered.
            </p>
          </div>
        )}

        {!rmaSubmitted && canRequestRma && hasOpenRma && (
          <div className="card">
            <p className="muted">
              You already have an open return request for this order. Our team
              will be in touch shortly.
            </p>
          </div>
        )}

        {!rmaSubmitted && canRequestRma && !hasOpenRma && (
          <form action={submitRmaAction}>
            <label htmlFor="reason">Reason for return</label>
            <select id="reason" name="reason" required>
              <option value="">— Select a reason —</option>
              {RMA_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <label htmlFor="notes">Additional details (optional)</label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="Describe the issue or any other relevant details…"
            />

            <button type="submit">Submit Return Request</button>
          </form>
        )}
      </section>
    </main>
  );
}
