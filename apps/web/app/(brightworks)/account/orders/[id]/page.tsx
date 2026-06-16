/**
 * /account/orders/[id] — order detail + RMA request initiation (F1-005).
 *
 * Server component. Shows order details, line items, and an RMA form.
 * IP65/weatherproof limitation disclaimer (required by liability_assessor)
 * is presented and must be acknowledged before the RMA can be submitted.
 * Submission uses an inline server action — no separate API route needed.
 */
import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getOrder,
  listOrderItems,
  getRmaForOrder,
  createRmaRequest,
} from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
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

const RMA_REASONS = [
  "Defective / not working",
  "Wrong item received",
  "Item damaged in shipping",
  "Not as described",
  "Changed my mind",
  "Other",
];

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const userId = user.id;
  const orderId = params.id;

  const [order, items, existingRma] = await Promise.all([
    getOrder(orderId, userId),
    listOrderItems(orderId),
    getRmaForOrder(orderId),
  ]);

  if (!order) {
    return (
      <main>
        <p>
          <Link href="/account/orders">← Back to orders</Link>
        </p>
        <div className="empty">
          <p>Order not found or you do not have access to it.</p>
        </div>
      </main>
    );
  }

  const rmaStatus = Array.isArray(searchParams?.rma)
    ? searchParams?.rma[0]
    : searchParams?.rma;
  const rmaError = Array.isArray(searchParams?.error)
    ? searchParams?.error[0]
    : searchParams?.error;

  const rmaSubmitted = rmaStatus === "success";
  const canRequestRma =
    !existingRma && !rmaSubmitted && order.status !== "cancelled";

  async function handleRmaSubmit(formData: FormData): Promise<void> {
    "use server";
    const reason = String(formData.get("reason") ?? "").trim();
    const details = String(formData.get("details") ?? "").trim();
    const disclaimer = formData.get("ip65_disclaimer");

    if (!reason) {
      redirect(
        `/account/orders/${orderId}?error=${encodeURIComponent("Please select a reason for the return.")}`,
      );
    }
    if (!disclaimer) {
      redirect(
        `/account/orders/${orderId}?error=${encodeURIComponent("You must acknowledge the IP65 limitation notice to proceed.")}`,
      );
    }

    const result = await createRmaRequest(orderId, userId, reason, details);
    if (result.success) {
      redirect(`/account/orders/${orderId}?rma=success`);
    } else {
      redirect(
        `/account/orders/${orderId}?error=${encodeURIComponent(result.error ?? "Failed to submit return request.")}`,
      );
    }
  }

  return (
    <main>
      <p>
        <Link href="/account/orders">← Back to orders</Link>
      </p>
      <h1>Order {order.order_number}</h1>
      <p className="muted">
        Placed {formatDate(order.placed_at)} ·{" "}
        {STATUS_LABELS[order.status] ?? order.status}
      </p>

      <div className="card">
        <h2>Order Summary</h2>
        {items.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="muted">{item.sku}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCents(item.unit_price_cents, order.currency)}</td>
                  <td>{formatCents(item.total_price_cents, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No line items recorded for this order.</p>
        )}
        <hr />
        <p>
          <strong>Subtotal:</strong>{" "}
          {formatCents(order.subtotal_cents, order.currency)}
        </p>
        <p>
          <strong>Shipping:</strong>{" "}
          {formatCents(order.shipping_cents, order.currency)}
        </p>
        <p>
          <strong>Tax:</strong> {formatCents(order.tax_cents, order.currency)}
        </p>
        <p>
          <strong>Total:</strong>{" "}
          {formatCents(order.total_cents, order.currency)}
        </p>
        {order.shipping_address && (
          <p>
            <strong>Shipping to:</strong> {order.shipping_address}
          </p>
        )}
        {order.notes && (
          <p>
            <strong>Notes:</strong> {order.notes}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Return / RMA Request</h2>

        {rmaSubmitted && (
          <p style={{ color: "green" }}>
            Your return request has been submitted. Our team will review it
            and contact you within 2–3 business days.
          </p>
        )}

        {rmaError && (
          <p style={{ color: "red" }}>{decodeURIComponent(rmaError)}</p>
        )}

        {existingRma && !rmaSubmitted ? (
          <div>
            <p>A return request is already on file for this order.</p>
            <p className="muted">
              <strong>Status:</strong>{" "}
              {existingRma.status.charAt(0).toUpperCase() +
                existingRma.status.slice(1)}{" "}
              · Submitted {formatDate(existingRma.created_at)}
            </p>
            <p className="muted">
              <strong>Reason:</strong> {existingRma.reason}
            </p>
            {existingRma.details && (
              <p className="muted">
                <strong>Details:</strong> {existingRma.details}
              </p>
            )}
          </div>
        ) : order.status === "cancelled" ? (
          <p className="muted">
            RMA requests are not available for cancelled orders.
          </p>
        ) : canRequestRma ? (
          <form action={handleRmaSubmit}>
            <div className="card" style={{ background: "var(--substrate-bg-muted, #f9f9f9)" }}>
              <p>
                <strong>IP65 / Weatherproof Limitation Notice</strong>
              </p>
              <p className="muted">
                Brightworks products carry an IP65 weatherproof rating for
                splash and dust resistance only. Prolonged submersion, pressure
                washing, or installation in continuously wet or submerged
                environments voids the warranty and may create electrical
                hazards. RMA eligibility does not apply to damage caused by
                improper installation or exposure beyond the rated IP65
                conditions. By submitting this request you confirm you have
                read and understood these limitations.
              </p>
              <label>
                <input
                  type="checkbox"
                  name="ip65_disclaimer"
                  value="acknowledged"
                  required
                />{" "}
                I have read and understand the IP65 limitation notice above.
              </label>
            </div>

            <div>
              <label htmlFor="rma-reason">Reason for return</label>
              <select id="rma-reason" name="reason" required>
                <option value="">Select a reason…</option>
                {RMA_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rma-details">
                Additional details{" "}
                <span className="muted">(optional)</span>
              </label>
              <textarea
                id="rma-details"
                name="details"
                rows={4}
                placeholder="Describe the issue in more detail, including any photos or serial numbers if relevant…"
              />
            </div>

            <button type="submit">Submit Return Request</button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
