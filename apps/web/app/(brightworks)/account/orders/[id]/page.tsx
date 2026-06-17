import type { JSX } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getOrderById,
  getRmaRequests,
  createRmaRequest,
} from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RMA_REASONS = [
  "Defective product",
  "Wrong item received",
  "Item not as described",
  "Changed my mind",
  "Damaged in shipping",
  "Missing parts or accessories",
];

const RMA_ELIGIBLE_STATUSES = ["delivered", "confirmed", "shipped"];

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface PageProps {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const order = await getOrderById(params.id, user.id);
  if (!order) {
    notFound();
  }

  // Capture non-null values so server action closures can use them without
  // TypeScript complaining about possible null (narrowing doesn't flow into closures).
  const orderId = order.id;
  const userId = user.id;

  const rmaRequests = await getRmaRequests(params.id, userId);
  const rmaRaw = searchParams?.rma;
  const rmaParam = Array.isArray(rmaRaw) ? rmaRaw[0] : rmaRaw;
  const rmaSubmitted = rmaParam === "submitted";
  const rmaError = rmaParam === "error";
  const canRequestRma =
    RMA_ELIGIBLE_STATUSES.includes(order.status) &&
    rmaRequests.length === 0 &&
    !rmaSubmitted;

  async function submitRma(formData: FormData): Promise<void> {
    "use server";
    const reason = ((formData.get("reason") as string | null) ?? "").trim();
    const notesRaw = ((formData.get("notes") as string | null) ?? "").trim();
    const notes = notesRaw.length > 0 ? notesRaw : null;
    const disclaimerAcknowledged =
      formData.get("disclaimer_acknowledged") === "on";

    if (!reason || !disclaimerAcknowledged) {
      redirect(`/account/orders/${orderId}?rma=error`);
    }

    let success = false;
    try {
      await createRmaRequest({
        order_id: orderId,
        user_id: userId,
        reason,
        notes,
        disclaimer_acknowledged: true,
      });
      success = true;
    } catch (err) {
      console.error("[rma] createRmaRequest failed:", err);
    }

    redirect(
      success
        ? `/account/orders/${orderId}?rma=submitted`
        : `/account/orders/${orderId}?rma=error`,
    );
  }

  return (
    <main>
      <Link href="/account/orders" className="muted">
        &larr; Back to Orders
      </Link>

      <h1>Order Details</h1>
      <p>
        Placed on {formatDate(order.created_at)} &mdash; Status:{" "}
        <strong style={{ textTransform: "capitalize" }}>{order.status}</strong>
      </p>

      <section>
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
                  <td>
                    <span className="muted">{item.product_sku ?? "—"}</span>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatCents(item.unit_price_cents, order.currency)}</td>
                  <td>{formatCents(item.subtotal_cents, order.currency)}</td>
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
                    {formatCents(order.total_cents, order.currency)}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {order.shipping_city && (
        <section>
          <h2>Shipping Address</h2>
          <div className="card">
            {order.shipping_address_line1 && (
              <p>{order.shipping_address_line1}</p>
            )}
            {order.shipping_address_line2 && (
              <p>{order.shipping_address_line2}</p>
            )}
            <p>
              {order.shipping_city}
              {order.shipping_state ? `, ${order.shipping_state}` : ""}{" "}
              {order.shipping_zip ?? ""}
            </p>
            {order.shipping_country && <p>{order.shipping_country}</p>}
            {order.tracking_number && (
              <p>
                <span className="muted">Tracking number:</span>{" "}
                {order.tracking_number}
              </p>
            )}
          </div>
        </section>
      )}

      {rmaRequests.length > 0 && (
        <section>
          <h2>Return Requests</h2>
          {rmaRequests.map((rma) => (
            <div key={rma.id} className="card">
              <p>
                <strong>Reason:</strong> {rma.reason}
              </p>
              {rma.notes && (
                <p>
                  <strong>Notes:</strong> {rma.notes}
                </p>
              )}
              <p>
                <strong>Status:</strong>{" "}
                <span style={{ textTransform: "capitalize" }}>
                  {rma.status}
                </span>
              </p>
              <p className="muted">Submitted {formatDate(rma.created_at)}</p>
            </div>
          ))}
        </section>
      )}

      {rmaSubmitted && (
        <div className="card">
          <p>
            <strong>Return request submitted.</strong> Our team will review
            your request and contact you within 2&ndash;3 business days with
            return instructions.
          </p>
        </div>
      )}

      {rmaError && (
        <div className="card">
          <p>
            There was a problem submitting your return request. Please check
            that all fields are filled in and try again, or{" "}
            <Link href="/support">contact support</Link> for help.
          </p>
        </div>
      )}

      {canRequestRma && (
        <section>
          <h2>Request a Return (RMA)</h2>
          <p>
            Our returns team will review your request and send return
            instructions within 2&ndash;3 business days. No 3PL integration
            required — a human ops agent processes each request.
          </p>
          <form action={submitRma}>
            <div>
              <label htmlFor="rma-reason">Reason for Return</label>
              <select id="rma-reason" name="reason" required>
                <option value="">Select a reason&hellip;</option>
                {RMA_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rma-notes">Additional Details (optional)</label>
              <textarea
                id="rma-notes"
                name="notes"
                rows={4}
                placeholder="Describe the issue in more detail&hellip;"
              />
            </div>

            <div className="card">
              <h3>IP65 / Weatherproof Limitation Disclaimer</h3>
              <p>
                Brightworks products are rated IP65 (dust-tight and
                water-jet protected) under IEC&nbsp;60529. This rating does
                not guarantee protection against prolonged immersion,
                high-pressure washing, condensation in confined spaces, or
                exposure beyond the rated operating conditions. Warranty
                coverage does not extend to damage resulting from use outside
                the specified IP65 parameters, physical misuse, improper
                installation, or unauthorized modification. Returns or
                warranty claims arising from conditions not covered by the
                IP65 rating will be assessed on a case-by-case basis by our
                returns team.
              </p>
              <label>
                <input
                  type="checkbox"
                  name="disclaimer_acknowledged"
                  required
                />{" "}
                I have read and understood the IP65/weatherproof limitation
                disclaimer, and confirm that my return request is valid under
                the stated warranty terms.
              </label>
            </div>

            <button type="submit">Submit Return Request</button>
          </form>
        </section>
      )}

      {!canRequestRma && rmaRequests.length === 0 && !rmaSubmitted && (
        <div className="empty">
          <p>
            Returns can be requested for orders with status: delivered,
            confirmed, or shipped. If you need help with this order,{" "}
            <Link href="/support">contact support</Link>.
          </p>
        </div>
      )}
    </main>
  );
}
