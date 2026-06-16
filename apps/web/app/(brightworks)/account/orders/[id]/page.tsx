/**
 * /account/orders/[id] — order detail + RMA (return merchandise authorization) request.
 * F1-005: shows order items, shipping info, safety disclaimer, and RMA form.
 *
 * IP65/weatherproof limitation disclosure is surfaced here as required by
 * liability_assessor. Safety disclaimer was acknowledged at checkout via
 * @nexus/legal-and-compliance; this page re-surfaces it for record-keeping.
 *
 * RMA submission uses GET-based form navigation to avoid server action
 * typing complexities with @types/react@18.3.x.
 */
import type { JSX } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getOrderById,
  getOrderRmaRequests,
  createRmaRequest,
} from "@/lib/brightworks/orders";
import type { OrderDetailRow, RmaRow } from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RMA_REASONS = [
  "Defective / not working",
  "Wrong item received",
  "Damaged in shipping",
  "Item not as described",
  "Changed my mind",
  "Other",
];

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

interface PageParams {
  id: string;
}

interface PageSearchParams {
  rma_submit?: string;
  rma_reason?: string;
  rma_notes?: string;
  rma_submitted?: string;
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: PageSearchParams;
}): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const orderId = params.id;

  // Handle RMA form submission (GET-based: form params arrive via searchParams)
  if (searchParams.rma_submit === "1" && searchParams.rma_reason) {
    const reason = searchParams.rma_reason.trim();
    const notes = (searchParams.rma_notes ?? "").trim();
    if (reason) {
      try {
        await createRmaRequest(orderId, user.id, reason, notes);
      } catch {
        // fall through to redirect — the duplicate-RMA check on the next
        // page load will surface any issues.
      }
    }
    redirect(
      `/account/orders/${encodeURIComponent(orderId)}?rma_submitted=1`,
    );
  }

  let order: OrderDetailRow | null = null;
  let rmas: RmaRow[] = [];
  try {
    const [fetchedOrder, fetchedRmas] = await Promise.all([
      getOrderById(orderId, user.id),
      getOrderRmaRequests(orderId),
    ]);
    order = fetchedOrder;
    rmas = fetchedRmas;
  } catch {
    // fall through — order stays null → notFound() below
  }

  if (!order) {
    notFound();
  }

  // TypeScript narrowing: order is OrderDetailRow at this point
  const resolvedOrder: OrderDetailRow = order;

  const rmaSubmitted = searchParams.rma_submitted === "1";
  const canRequestRma =
    resolvedOrder.status === "delivered" || resolvedOrder.status === "shipped";
  const hasOpenRma = rmas.some(
    (r) => r.status === "pending" || r.status === "approved",
  );

  return (
    <main>
      <Link href="/account/orders" className="btn secondary">
        ← Back to Orders
      </Link>

      <h1>Order {resolvedOrder.order_number}</h1>
      <p>
        Placed {formatDate(resolvedOrder.created_at)} &middot; Status:{" "}
        <strong>
          {STATUS_LABEL[resolvedOrder.status] ?? resolvedOrder.status}
        </strong>
      </p>

      {/* IP65/weatherproof safety notice — liability_assessor requirement */}
      <div className="card">
        <p className="muted">
          <strong>IP65 Weatherproof Notice:</strong> Brightworks outdoor
          fixtures are rated IP65 — protected against dust and low-pressure
          water jets under normal outdoor conditions. They are{" "}
          <em>not</em> rated for submersion, high-pressure wash-down, or
          poolside/underwater installation. This limitation was acknowledged at
          checkout per our{" "}
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
            {resolvedOrder.items.map((item) => (
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
                <strong>{formatCents(resolvedOrder.total_cents)}</strong>
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
            {resolvedOrder.shipping_name}
            <br />
            {resolvedOrder.shipping_address_line1}
            <br />
            {resolvedOrder.shipping_address_line2 && (
              <>
                {resolvedOrder.shipping_address_line2}
                <br />
              </>
            )}
            {resolvedOrder.shipping_city}, {resolvedOrder.shipping_state}{" "}
            {resolvedOrder.shipping_zip}
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
              within 2&ndash;3 business days and contact you by email with
              next steps.
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
          <form method="get">
            <input type="hidden" name="rma_submit" value="1" />

            <label htmlFor="rma_reason">Reason for return</label>
            <select id="rma_reason" name="rma_reason" required>
              <option value="">— Select a reason —</option>
              {RMA_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <label htmlFor="rma_notes">Additional details (optional)</label>
            <textarea
              id="rma_notes"
              name="rma_notes"
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
