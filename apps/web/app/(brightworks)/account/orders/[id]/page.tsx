import type { JSX } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getOrderById,
  getOrderItems,
  getRmasByOrder,
  createRmaRequest,
} from "@/lib/brightworks/orders";
import type { Order, OrderItem, RmaRequest } from "@/lib/brightworks/orders";

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

interface PageProps {
  params: { id: string };
  searchParams: { rma?: string };
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

  const [items, rmas] = await Promise.all([
    getOrderItems(order.id),
    getRmasByOrder(order.id),
  ]);

  async function submitRma(formData: FormData): Promise<void> {
    "use server";
    const reason = (formData.get("reason") as string | null)?.trim() ?? "";
    if (!reason) return;
    const sessionUser = await getSessionUser();
    if (!sessionUser) return;
    await createRmaRequest({
      orderId: params.id,
      userId: sessionUser.id,
      reason,
    });
    redirect(`/account/orders/${params.id}?rma=submitted`);
  }

  const hasActiveRma = rmas.some(
    (r: RmaRequest) => r.status === "pending" || r.status === "approved",
  );
  const canRequestRma = order.status === "delivered" && !hasActiveRma;
  const rmaJustSubmitted = searchParams.rma === "submitted";

  return (
    <main>
      <Link href="/account/orders" className="muted">
        ← Back to orders
      </Link>

      <h1>Order Details</h1>
      <p>Placed on {formatDate(order.created_at)}</p>

      <div className="card">
        <h2>Summary</h2>
        <table>
          <tbody>
            <tr>
              <th>Order ID</th>
              <td>
                <code>{order.id}</code>
              </td>
            </tr>
            <tr>
              <th>Status</th>
              <td>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</td>
            </tr>
            <tr>
              <th>Total</th>
              <td>{formatCents(order.total_cents, order.currency)}</td>
            </tr>
            {order.tracking_number && (
              <tr>
                <th>Tracking</th>
                <td>{order.tracking_number}</td>
              </tr>
            )}
            {order.shipping_address && (
              <tr>
                <th>Ship to</th>
                <td>{order.shipping_address}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Items</h2>
        {items.length === 0 ? (
          <p className="muted">No line items on record.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: OrderItem) => (
                <tr key={item.id}>
                  <td>
                    <code>{item.sku}</code>
                  </td>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCents(item.unit_price_cents, order.currency)}</td>
                  <td>
                    {formatCents(
                      item.unit_price_cents * item.quantity,
                      order.currency,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Safety Notice</h2>
        <p className="muted">
          Brightworks outdoor lighting products carry an IP65 weather-resistance
          rating. IP65 means the fixture is protected against low-pressure water
          jets from any direction — it is <strong>not waterproof</strong> and
          must never be submerged or exposed to sustained water ingress. All
          installations must be performed by a licensed electrician in
          compliance with local electrical codes. By placing your order you
          acknowledged this limitation at checkout. Returns of installed or
          modified fixtures are subject to inspection.
        </p>
      </div>

      <div className="card">
        <h2>Return / Exchange (RMA)</h2>

        {rmaJustSubmitted && (
          <p>
            <strong>Your RMA request has been submitted.</strong> Our team will
            review it within 2–3 business days and contact you via email.
          </p>
        )}

        {rmas.length > 0 && (
          <div>
            <h3>Existing requests</h3>
            <ul>
              {rmas.map((rma: RmaRequest) => (
                <li key={rma.id}>
                  <strong>
                    {rma.status.charAt(0).toUpperCase() + rma.status.slice(1)}
                  </strong>{" "}
                  — {rma.reason}
                  <span className="muted">
                    {" "}
                    (submitted {formatDate(rma.created_at)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canRequestRma && !rmaJustSubmitted && (
          <form action={submitRma}>
            <label htmlFor="reason">Reason for return or exchange</label>
            <textarea
              id="reason"
              name="reason"
              rows={4}
              required
              placeholder="Describe the issue — e.g. wrong item received, damaged on arrival, product defect…"
            />
            <p className="muted">
              By submitting this request you confirm that the product has not
              been submerged or installed contrary to the IP65 weatherproof
              limitation disclosed at checkout. Our returns team will contact
              you within 2–3 business days with next steps.
            </p>
            <button type="submit">Submit RMA Request</button>
          </form>
        )}

        {!canRequestRma && !rmaJustSubmitted && order.status !== "delivered" && (
          <p className="muted">
            RMA requests are available for delivered orders only. Current
            status: <strong>{order.status}</strong>.
          </p>
        )}

        {!canRequestRma && !rmaJustSubmitted && order.status === "delivered" && hasActiveRma && (
          <p className="muted">
            An RMA request for this order is already under review. Our team
            will reach out to you shortly.
          </p>
        )}
      </div>
    </main>
  );
}
