import type { JSX } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getOrderForUser,
  listRmaRequestsForOrder,
  createRmaRequest,
  formatCents,
  statusLabel,
  rmaStatusLabel,
  type OrderItem,
} from "@/lib/brightworks/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handleRmaSubmit(
  orderId: string,
  userId: string,
  formData: FormData,
): Promise<void> {
  "use server";

  const reason = ((formData.get("reason") as string | null) ?? "").trim();
  const disclaimerChecked = formData.get("safety_disclaimer") === "on";

  if (!reason) {
    redirect(`/account/orders/${orderId}?error=reason_required`);
  }

  if (!disclaimerChecked) {
    redirect(`/account/orders/${orderId}?error=disclaimer_required`);
  }

  let itemsToReturn: OrderItem[] = [];
  try {
    const order = await getOrderForUser(orderId, userId);
    if (!order) {
      redirect(`/account/orders?error=order_not_found`);
    }
    itemsToReturn = order.items;
  } catch {
    itemsToReturn = [];
  }

  try {
    await createRmaRequest(orderId, userId, reason, itemsToReturn, true);
  } catch (err) {
    console.error("[brightworks/rma] createRmaRequest failed:", err);
    redirect(`/account/orders/${orderId}?error=submit_failed`);
  }

  redirect(`/account/orders/${orderId}?rma_submitted=1`);
}

const RMA_ELIGIBLE_STATUSES = new Set(["delivered", "shipped"]);
const RMA_BLOCKING_STATUSES = new Set(["pending", "approved"]);

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const order = await getOrderForUser(params.id, user.id).catch(() => null);
  if (!order) {
    notFound();
  }

  let rmaRequests: Awaited<ReturnType<typeof listRmaRequestsForOrder>> = [];
  try {
    rmaRequests = await listRmaRequestsForOrder(order.id);
  } catch (err) {
    console.error("[brightworks/rma] listRmaRequestsForOrder failed:", err);
  }

  const rmaAction = handleRmaSubmit.bind(null, order.id, user.id);
  const canRequestRma =
    RMA_ELIGIBLE_STATUSES.has(order.status) &&
    !rmaRequests.some((r) => RMA_BLOCKING_STATUSES.has(r.status));

  const errorParam = typeof searchParams.error === "string" ? searchParams.error : null;
  const rmaSubmitted = searchParams.rma_submitted === "1";

  return (
    <main>
      <nav>
        <Link href="/account/orders" className="muted">
          ← Back to Orders
        </Link>
      </nav>

      <h1>Order {order.order_number}</h1>
      <p>
        Placed on{" "}
        {new Date(order.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}{" "}
        · Status: <strong>{statusLabel(order.status)}</strong>
      </p>

      <section>
        <h2>Items Ordered</h2>
        {order.items.length === 0 ? (
          <p className="muted">No item details available.</p>
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
              {order.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.name}</td>
                  <td>
                    <span className="muted">{item.sku}</span>
                  </td>
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
        )}
      </section>

      {order.shipping_address && (
        <section>
          <h2>Shipping Address</h2>
          <div className="card">
            <p>
              {order.shipping_address.name}
              <br />
              {order.shipping_address.line1}
              {order.shipping_address.line2
                ? `, ${order.shipping_address.line2}`
                : ""}
              <br />
              {order.shipping_address.city}, {order.shipping_address.state}{" "}
              {order.shipping_address.zip}
              <br />
              <span className="muted">{order.shipping_address.country}</span>
            </p>
          </div>
        </section>
      )}

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
                Submitted{" "}
                {new Date(rma.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          ))}
        </section>
      )}

      {canRequestRma && (
        <section>
          <h2>Request a Return (RMA)</h2>

          {rmaSubmitted && (
            <div className="card" role="status">
              <p>
                <strong>Return request submitted.</strong> Our team will review
                your request and contact you within 2–3 business days with
                return instructions.
              </p>
            </div>
          )}

          {errorParam === "reason_required" && (
            <div role="alert" className="card">
              <p>Please describe the reason for your return before submitting.</p>
            </div>
          )}

          {errorParam === "disclaimer_required" && (
            <div role="alert" className="card">
              <p>
                You must acknowledge the IP65 product limitation disclosure
                before submitting a return request.
              </p>
            </div>
          )}

          {errorParam === "submit_failed" && (
            <div role="alert" className="card">
              <p>
                We could not submit your return request. Please try again or
                contact <Link href="/support">support</Link>.
              </p>
            </div>
          )}

          {!rmaSubmitted && (
            <form action={rmaAction}>
              {/* IP65 / Weatherproof Limitation Disclosure — required by liability_assessor */}
              <fieldset>
                <legend>
                  <strong>Product Limitation Disclosure (Required)</strong>
                </legend>
                <p>
                  <strong>IP65 / Weatherproof Rating Notice:</strong> Brightworks
                  outdoor lighting products carry an IP65 ingress-protection
                  rating, providing full dust-tight protection and resistance to
                  low-pressure water jets from any direction. This rating does{" "}
                  <strong>not</strong> cover submersion, high-pressure washing,
                  ponding water, or prolonged exposure to standing moisture.
                  Damage arising from installation or use beyond these limits is
                  not covered under the product warranty. By requesting a return,
                  you confirm you have reviewed your installation environment
                  against these specifications.
                </p>
                <label>
                  <input type="checkbox" name="safety_disclaimer" required />
                  {" "}I have read and understood the IP65 weatherproof
                  limitation disclosure above and confirm it is relevant to my
                  return.
                </label>
              </fieldset>

              <label>
                Reason for Return
                <textarea
                  name="reason"
                  rows={5}
                  required
                  placeholder="Please describe the issue or reason you would like to return this order…"
                />
              </label>

              <p className="muted">
                Our reverse logistics team will review your request and provide
                a prepaid return label within 2–3 business days.
              </p>

              <button type="submit">Submit Return Request</button>
            </form>
          )}
        </section>
      )}

      {!canRequestRma && rmaRequests.length === 0 && (
        <p className="muted">
          Return requests are available for delivered orders. If you need help
          with this order, please contact{" "}
          <Link href="/support">our support team</Link>.
        </p>
      )}
    </main>
  );
}
