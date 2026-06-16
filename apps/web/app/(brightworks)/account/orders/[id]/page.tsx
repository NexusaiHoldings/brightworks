import type { JSX } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getOrderWithItems,
  createRmaRequest,
  formatCurrency,
  formatOrderStatus,
  formatRmaStatus,
  isRmaEligible,
} from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RMA_REASONS = [
  "Defective product",
  "Wrong item received",
  "Item not as described",
  "Weatherproofing failure (non-IP65 condition)",
  "Installation damage",
  "Other",
];

interface PageProps {
  params: { id: string };
  searchParams: { success?: string; error?: string };
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    return (
      <main>
        <p>
          Please{" "}
          <Link href="/login" className="btn secondary">
            log in
          </Link>{" "}
          to view your order.
        </p>
      </main>
    );
  }

  const order = await getOrderWithItems(params.id, user.id);
  if (!order) {
    notFound();
  }

  const orderId = params.id;
  const userId = user.id;

  async function submitRmaRequest(formData: FormData): Promise<void> {
    "use server";
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.id !== userId) {
      redirect("/login");
    }
    const reason = formData.get("reason");
    const disclaimer = formData.get("disclaimer");
    if (!reason || typeof reason !== "string" || !disclaimer) {
      redirect(`/account/orders/${orderId}?error=missing`);
    }
    await createRmaRequest(orderId, sessionUser.id, reason);
    redirect(`/account/orders/${orderId}?success=1`);
  }

  const eligible = isRmaEligible(order);
  const hasRma = order.rma_request !== null;

  return (
    <main>
      <p className="muted">
        <Link href="/account/orders">← Back to Orders</Link>
      </p>
      <h1>Order #{order.id.slice(0, 8).toUpperCase()}</h1>
      <p>Placed {new Date(order.created_at).toLocaleDateString()}</p>

      {searchParams.success && (
        <div className="card">
          <p>
            <strong>Return request submitted.</strong> Our operations team will
            review it and contact you within 2–3 business days.
          </p>
        </div>
      )}
      {searchParams.error === "missing" && (
        <div className="card">
          <p>Please select a reason and acknowledge the disclaimer.</p>
        </div>
      )}

      <div className="card">
        <h2>Order Details</h2>
        <p>
          Status: <strong>{formatOrderStatus(order.status)}</strong>
        </p>
        {order.tracking_number && (
          <p>
            Tracking:{" "}
            <span className="muted">{order.tracking_number}</span>
          </p>
        )}
        <p>
          Ship to: <span className="muted">{order.shipping_address}</span>
        </p>
      </div>

      <div className="card">
        <h2>Items</h2>
        {order.items.length === 0 ? (
          <p className="muted">No items found for this order.</p>
        ) : (
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
                  <td>{formatCurrency(item.unit_price_cents)}</td>
                  <td>{formatCurrency(item.subtotal_cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>
                  <strong>Order Total</strong>
                </td>
                <td>
                  <strong>
                    {formatCurrency(order.total_cents, order.currency)}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {hasRma ? (
        <div className="card">
          <h2>Return Request</h2>
          <p>
            Status:{" "}
            <strong>{formatRmaStatus(order.rma_request!.status)}</strong>
          </p>
          <p className="muted">Reason: {order.rma_request!.reason}</p>
          <p className="muted">
            Submitted{" "}
            {new Date(order.rma_request!.created_at).toLocaleDateString()}
          </p>
        </div>
      ) : eligible ? (
        <div className="card">
          <h2>Request a Return (RMA)</h2>
          <p className="muted">
            Initiate a return merchandise authorization. Our team will review
            your request and contact you within 2–3 business days with
            reverse-logistics instructions.
          </p>
          <form action={submitRmaRequest}>
            <div>
              <label htmlFor="rma-reason">Reason for return</label>
              <select id="rma-reason" name="reason" required>
                <option value="">Select a reason…</option>
                {RMA_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend>IP65 / Weatherproof Limitation Disclaimer</legend>
              <p className="muted">
                <strong>Notice:</strong> Brightworks outdoor lighting products
                carry an IP65 rating (dust-tight; protected against water jets
                from any direction). This rating does <em>not</em> cover
                submersion, sustained flooding, or high-pressure wash-down.
                Products must be installed per the enclosed installation guide.
                Water damage arising from improper installation or use outside
                rated conditions is excluded from warranty and is not eligible
                for return under this RMA programme.
              </p>
              <label>
                <input
                  type="checkbox"
                  name="disclaimer"
                  value="acknowledged"
                  required
                />{" "}
                I have read and understood the IP65/weatherproof limitation
                notice above.
              </label>
            </fieldset>

            <button type="submit">Submit Return Request</button>
          </form>
        </div>
      ) : (
        <div className="card">
          <h2>Returns</h2>
          <p className="muted">
            Returns are available for shipped or delivered orders. If you have
            a question about this order, please{" "}
            <Link href="/help">contact support</Link>.
          </p>
        </div>
      )}
    </main>
  );
}
