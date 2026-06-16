/**
 * /account/orders/[id] — order detail + RMA request form (brightworks DTC).
 *
 * Server component with inline server action for RMA submission.
 * Unauthenticated visitors are redirected to /login.
 * Orders belonging to a different user return a 404-style redirect.
 */
import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getOrderWithItems,
  getRmaRequestsByOrder,
  createRmaRequest,
} from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RMA_ELIGIBLE_STATUSES = new Set(["delivered"]);

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}

function rmaStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    completed: "Completed",
  };
  return labels[status] ?? status;
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { rma?: string };
}): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const orderId = params.id;
  const result = await getOrderWithItems(orderId, user.id);
  if (!result) redirect("/account/orders");

  const { order, items } = result;
  const rmaRequests = await getRmaRequestsByOrder(orderId);
  const rmaSuccess = searchParams?.rma === "success";
  const canRequestRma =
    RMA_ELIGIBLE_STATUSES.has(order.status) &&
    !rmaRequests.some((r) => r.status === "pending" || r.status === "approved");

  async function handleRmaSubmit(formData: FormData): Promise<void> {
    "use server";
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) return;
    const selectedItems = formData.getAll("items").map(String).filter(Boolean);
    await createRmaRequest(orderId, user!.id, reason, selectedItems);
    redirect(`/account/orders/${encodeURIComponent(orderId)}?rma=success`);
  }

  return (
    <main>
      <p className="muted">
        <Link href="/account/orders">← Back to orders</Link>
      </p>
      <h1>Order {order.order_number}</h1>
      <p>
        Placed {new Date(order.created_at).toLocaleDateString("en-US")} ·{" "}
        {statusLabel(order.status)} ·{" "}
        {formatCents(order.total_cents, order.currency)}
      </p>

      <section>
        <h2>Items</h2>
        {items.length === 0 ? (
          <p className="muted">No items on record.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="muted">{item.sku}</td>
                  <td>{item.product_name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCents(item.unit_price_cents, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {rmaRequests.length > 0 && (
        <section>
          <h2>Return Requests</h2>
          {rmaRequests.map((rma) => (
            <div key={rma.id} className="card">
              <p>
                <strong>Status:</strong> {rmaStatusLabel(rma.status)}
              </p>
              <p>
                <strong>Reason:</strong> {rma.reason}
              </p>
              <p className="muted">
                Submitted {new Date(rma.created_at).toLocaleDateString("en-US")}
              </p>
              {rma.ops_notes && (
                <p>
                  <strong>Notes from our team:</strong> {rma.ops_notes}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {rmaSuccess && (
        <div className="card">
          <p>
            <strong>Return request submitted.</strong> Our team will review it
            and contact you within 2–3 business days.
          </p>
        </div>
      )}

      {canRequestRma && (
        <section>
          <h2>Request a Return</h2>
          <div className="card">
            <p className="muted">
              <strong>IP65 / Weatherproof disclaimer:</strong> Brightworks
              fixtures are rated IP65 (dust-tight, jet-proof) but are not
              submersible. Damage from flooding, standing water, or improper
              installation voids the return eligibility. By submitting this
              form you confirm the return reason does not include user-caused
              water damage.
            </p>
          </div>
          <form action={handleRmaSubmit}>
            <div>
              <label htmlFor="reason">Reason for return</label>
              <select id="reason" name="reason" required>
                <option value="">Select a reason…</option>
                <option value="Defective / not working on arrival">
                  Defective / not working on arrival
                </option>
                <option value="Wrong item received">Wrong item received</option>
                <option value="Item damaged in shipping">
                  Item damaged in shipping
                </option>
                <option value="Changed mind / no longer needed">
                  Changed mind / no longer needed
                </option>
                <option value="Other">Other</option>
              </select>
            </div>
            {items.length > 0 && (
              <fieldset>
                <legend>Which items are you returning?</legend>
                {items.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      name="items"
                      value={`${item.sku} — ${item.product_name}`}
                    />
                    {" "}
                    {item.product_name} (×{item.quantity})
                  </label>
                ))}
              </fieldset>
            )}
            <button type="submit">Submit return request</button>
          </form>
        </section>
      )}

      {!canRequestRma && !rmaSuccess && order.status !== "cancelled" && (
        <p className="muted">
          Returns can be requested once your order has been delivered.
        </p>
      )}
    </main>
  );
}
