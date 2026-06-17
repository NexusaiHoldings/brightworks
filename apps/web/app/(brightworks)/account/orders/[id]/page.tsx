import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getOrder,
  getOrderRMARequests,
  createRMARequest,
  formatCents,
} from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const RMA_STATUS_LABELS: Record<string, string> = {
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  processing: "Processing",
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?redirect=/account/orders/${params.id}`);

  const order = await getOrder(params.id, user.id);
  if (!order) {
    return (
      <main>
        <h1>Order Not Found</h1>
        <p>This order does not exist or does not belong to your account.</p>
        <Link href="/account/orders" className="btn secondary">Back to Orders</Link>
      </main>
    );
  }

  const rmaRequests = await getOrderRMARequests(order.id);
  const hasActiveRMA = rmaRequests.some(
    (r) => !["rejected", "cancelled"].includes(r.status)
  );
  const canRequestRMA = order.status === "delivered" && !hasActiveRMA;

  const submittedFlag = searchParams.submitted === "1";
  const errorMsg =
    typeof searchParams.error === "string"
      ? decodeURIComponent(searchParams.error)
      : null;

  async function submitRMA(formData: FormData): Promise<void> {
    "use server";
    const orderId = params.id;
    const userId = user?.id;
    if (!userId) {
      redirect(`/login?redirect=/account/orders/${orderId}`);
      return;
    }
    const reason = (formData.get("reason") as string | null) ?? "";
    const notes = (formData.get("notes") as string | null) || null;
    const disclaimer = formData.get("disclaimer");
    if (!reason || !disclaimer) {
      redirect(`/account/orders/${orderId}?error=Please+select+a+reason+and+acknowledge+the+disclaimer.`);
      return;
    }
    const result = await createRMARequest(orderId, userId, reason, notes);
    if (result.success) {
      redirect(`/account/orders/${orderId}?submitted=1`);
    } else {
      redirect(
        `/account/orders/${orderId}?error=${encodeURIComponent(result.error ?? "Request failed. Please try again.")}`
      );
    }
  }

  return (
    <main>
      <p>
        <Link href="/account/orders" className="muted">← Back to Orders</Link>
      </p>

      <h1>Order #{order.id.slice(0, 8).toUpperCase()}</h1>
      <p>Placed {order.created_at.slice(0, 10)}</p>

      <div className="card">
        <p>
          <strong>Status:</strong>{" "}
          {STATUS_LABELS[order.status] ?? order.status}
        </p>
        <p>
          <strong>Order total:</strong> {formatCents(order.total_cents)}
        </p>
      </div>

      {order.items && order.items.length > 0 && (
        <>
          <h2>Items</h2>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="muted">{item.sku}</td>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCents(item.unit_price_cents)}</td>
                  <td>{formatCents(item.quantity * item.unit_price_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Returns &amp; RMA Requests</h2>

      {submittedFlag && (
        <div className="card">
          <strong>RMA request submitted.</strong> Our team will review your
          request and follow up within 2–3 business days.
        </div>
      )}

      {errorMsg && (
        <div className="card">
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {rmaRequests.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Submitted</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rmaRequests.map((rma) => (
              <tr key={rma.id}>
                <td>{rma.created_at.slice(0, 10)}</td>
                <td>{rma.reason.replace(/_/g, " ")}</td>
                <td>{RMA_STATUS_LABELS[rma.status] ?? rma.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {hasActiveRMA && (
        <div className="card">
          <p>An RMA request is already open for this order. Our team will be in touch.</p>
        </div>
      )}

      {!canRequestRMA && !hasActiveRMA && order.status !== "delivered" && (
        <div className="empty">
          <p className="muted">
            Return requests can be submitted once your order has been delivered.
          </p>
        </div>
      )}

      {canRequestRMA && (
        <>
          <h2>Request a Return (RMA)</h2>
          <form action={submitRMA}>
            <div>
              <label htmlFor="reason">Reason for return</label>
              <select id="reason" name="reason" required>
                <option value="">Select a reason…</option>
                <option value="defective">Defective / not working as expected</option>
                <option value="wrong_product">Wrong product received</option>
                <option value="damaged_shipping">Damaged during shipping</option>
                <option value="warranty">Warranty claim</option>
                <option value="changed_mind">Changed mind / no longer needed</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="notes">Additional details (optional)</label>
              <textarea id="notes" name="notes" rows={4} />
            </div>

            <div className="card">
              <strong>IP65 Weatherproof Limitation Disclosure</strong>
              <p>
                Brightworks outdoor lighting products carry an IP65 ingress
                protection rating — dust-tight and protected against low-pressure
                water jets from any direction. IP65 does{" "}
                <strong>not</strong> protect against:
              </p>
              <ul>
                <li>Immersion or pooling water</li>
                <li>High-pressure washdowns</li>
                <li>Salt spray or highly corrosive environments</li>
                <li>Freeze–thaw cycling damage to seals over multiple seasons</li>
              </ul>
              <p>
                Warranty claims involving water ingress are evaluated against
                correct installation and usage per the product guide. Damage from
                conditions exceeding the IP65 specification is not covered under
                the standard warranty.
              </p>
              <label>
                <input
                  type="checkbox"
                  name="disclaimer"
                  value="acknowledged"
                  required
                />
                {" "}I have read and understand the IP65 weatherproof limitation
                disclosure above.
              </label>
            </div>

            <button type="submit">Submit RMA Request</button>
          </form>
        </>
      )}
    </main>
  );
}
