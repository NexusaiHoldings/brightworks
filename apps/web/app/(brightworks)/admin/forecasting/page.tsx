/**
 * /admin/forecasting — Seasonal Demand Forecasting Dashboard (F1-006).
 *
 * Surfaces per-SKU forecast vs. current inventory and flags SKUs at risk of
 * stockout before the October sell-in deadline. Data is populated by the
 * /api/cron/demand-forecast Vercel cron. Runs on the first visit if the DB
 * tables are empty (bootstraps demo data).
 */

import type { JSX } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin-auth";
import {
  ensureTablesExist,
  seedDemoSkus,
  getLatestForecasts,
  getRecentSnapshots,
  type DemandForecast,
  type ForecastSnapshot,
} from "@/lib/brightworks/demand-forecast";
import {
  daysUntilDeadline,
  SELL_IN_DEADLINE,
  buildReplenishmentOrders,
  type ReplenishmentOrder,
} from "@/lib/brightworks/pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function riskBadge(risk: "high" | "medium" | "low"): JSX.Element {
  const styles: Record<string, string> = {
    high:   "background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.8rem",
    medium: "background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.8rem",
    low:    "background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.8rem",
  };
  return <span style={{ ...parseStyle(styles[risk]) }}>{risk.toUpperCase()}</span>;
}

function urgencyBadge(urgency: ReplenishmentOrder["urgency"]): JSX.Element {
  const styles: Record<string, string> = {
    critical: "background:#fca5a5;color:#7f1d1d;padding:2px 8px;border-radius:4px;font-weight:700;font-size:0.8rem",
    high:     "background:#fcd34d;color:#78350f;padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.8rem",
    medium:   "background:#a7f3d0;color:#064e3b;padding:2px 8px;border-radius:4px;font-size:0.8rem",
    low:      "background:#e5e7eb;color:#374151;padding:2px 8px;border-radius:4px;font-size:0.8rem",
  };
  return <span style={{ ...parseStyle(styles[urgency]) }}>{urgency.toUpperCase()}</span>;
}

/** Convert a CSS string like "background:#fff;color:red" → style object. */
function parseStyle(css: string): Record<string, string> {
  return Object.fromEntries(
    css.split(";").filter(Boolean).map((pair) => {
      const [k, ...v] = pair.split(":");
      return [k.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v.join(":").trim()];
    })
  );
}

function pct(a: number, b: number): string {
  if (b === 0) return "—";
  return `${Math.round((a / b) * 100)}%`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ForecastingPage(): Promise<JSX.Element> {
  const admin = await getAdminUser();
  if (!admin) redirect("/login");

  // Bootstrap on first visit (no-op if tables already exist)
  await ensureTablesExist();
  await seedDemoSkus();

  const [forecasts, snapshots] = await Promise.all([
    getLatestForecasts(),
    getRecentSnapshots(3),
  ]);

  const atRisk = forecasts.filter((f) => f.stockout_risk === "high");
  const orders = forecasts.length > 0 ? buildReplenishmentOrders(forecasts) : [];
  const criticalOrders = orders.filter((o) => o.urgency === "critical");
  const deadline = daysUntilDeadline();
  const deadlineStr = SELL_IN_DEADLINE.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const latestSnapshot: ForecastSnapshot | undefined = snapshots[0];

  return (
    <main>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h1>Seasonal Demand Forecasting</h1>
          <p>
            Per-SKU inventory replenishment recommendations driven by Google Trends
            holiday search volume and regional weather-onset signals. October sell-in
            deadline: <strong>{deadlineStr}</strong> ({deadline} days away).
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href="/admin" className="btn secondary">← Admin</Link>
          <a href="/api/cron/demand-forecast" className="btn secondary" style={{ fontSize: "0.85rem" }}>
            Run Forecast Now
          </a>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <div className="card">
          <p className="muted" style={{ marginBottom: "4px", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>SKUs Tracked</p>
          <p style={{ fontSize: "2rem", fontWeight: "700", margin: "0" }}>{forecasts.length}</p>
        </div>
        <div className="card" style={{ borderColor: atRisk.length > 0 ? "#fca5a5" : undefined }}>
          <p className="muted" style={{ marginBottom: "4px", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>At-Risk SKUs</p>
          <p style={{ fontSize: "2rem", fontWeight: "700", margin: "0", color: atRisk.length > 0 ? "#dc2626" : "inherit" }}>
            {atRisk.length}
          </p>
        </div>
        <div className="card" style={{ borderColor: criticalOrders.length > 0 ? "#f97316" : undefined }}>
          <p className="muted" style={{ marginBottom: "4px", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Critical Orders</p>
          <p style={{ fontSize: "2rem", fontWeight: "700", margin: "0", color: criticalOrders.length > 0 ? "#ea580c" : "inherit" }}>
            {criticalOrders.length}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ marginBottom: "4px", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Trends Score</p>
          <p style={{ fontSize: "2rem", fontWeight: "700", margin: "0" }}>
            {latestSnapshot ? `${latestSnapshot.trends_score}/100` : "—"}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ marginBottom: "4px", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Weather Multiplier</p>
          <p style={{ fontSize: "2rem", fontWeight: "700", margin: "0" }}>
            {latestSnapshot ? `${latestSnapshot.weather_multiplier.toFixed(2)}×` : "—"}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ marginBottom: "4px", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Days to Deadline</p>
          <p style={{ fontSize: "2rem", fontWeight: "700", margin: "0", color: deadline <= 30 ? "#dc2626" : deadline <= 60 ? "#d97706" : "inherit" }}>
            {deadline}
          </p>
        </div>
      </div>

      {/* No data empty state */}
      {forecasts.length === 0 && (
        <div className="empty">
          <strong>No forecast data yet.</strong>
          <p>
            Trigger the first forecast run by visiting{" "}
            <a href="/api/cron/demand-forecast">/api/cron/demand-forecast</a> or
            waiting for the scheduled Vercel cron to fire.
          </p>
        </div>
      )}

      {/* At-risk alert */}
      {atRisk.length > 0 && (
        <div className="card" style={{ borderColor: "#fca5a5", background: "#fff5f5", marginBottom: "20px" }}>
          <strong style={{ color: "#991b1b" }}>
            ⚠ {atRisk.length} SKU{atRisk.length !== 1 ? "s" : ""} at high stockout risk before October deadline
          </strong>
          <p className="muted" style={{ marginTop: "4px" }}>
            These SKUs have ≤21 days of inventory remaining at forecasted demand rates.
            Place replenishment orders immediately.
          </p>
        </div>
      )}

      {/* Per-SKU forecast table */}
      {forecasts.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "8px" }}>
            Forecast vs. Inventory
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>On Hand</th>
                  <th style={{ textAlign: "right" }}>90-Day Forecast</th>
                  <th style={{ textAlign: "right" }}>Coverage</th>
                  <th style={{ textAlign: "right" }}>Days Left</th>
                  <th style={{ textAlign: "right" }}>Reorder Qty</th>
                  <th style={{ textAlign: "right" }}>Confidence</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((fc: DemandForecast) => (
                  <tr key={fc.sku_id} style={fc.stockout_risk === "high" ? { background: "#fff5f5" } : undefined}>
                    <td><code style={{ fontSize: "0.8rem" }}>{fc.sku_code}</code></td>
                    <td>{fc.name}</td>
                    <td className="muted">{fc.category}</td>
                    <td style={{ textAlign: "right" }}>{fmt(fc.current_inventory)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(fc.forecast_demand_units)}</td>
                    <td style={{ textAlign: "right" }}>{pct(fc.current_inventory, fc.forecast_demand_units)}</td>
                    <td style={{ textAlign: "right", color: fc.days_to_stockout <= 21 ? "#dc2626" : fc.days_to_stockout <= 45 ? "#d97706" : "inherit", fontWeight: fc.days_to_stockout <= 21 ? "700" : undefined }}>
                      {fc.days_to_stockout >= 999 ? "∞" : fc.days_to_stockout}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: fc.recommended_reorder_qty > 0 ? "600" : undefined }}>
                      {fc.recommended_reorder_qty > 0 ? fmt(fc.recommended_reorder_qty) : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>{fc.confidence_score.toFixed(0)}%</td>
                    <td>{riskBadge(fc.stockout_risk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Replenishment orders */}
      {orders.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "600", margin: "28px 0 8px" }}>
            Replenishment Orders
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th style={{ textAlign: "right" }}>On Hand</th>
                  <th style={{ textAlign: "right" }}>Forecast Demand</th>
                  <th style={{ textAlign: "right" }}>Units to Order</th>
                  <th>Order By</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: ReplenishmentOrder) => (
                  <tr key={order.sku_id} style={order.urgency === "critical" ? { background: "#fff5f5" } : undefined}>
                    <td><code style={{ fontSize: "0.8rem" }}>{order.sku_code}</code></td>
                    <td>{order.name}</td>
                    <td style={{ textAlign: "right" }}>{fmt(order.current_inventory)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(order.forecast_demand)}</td>
                    <td style={{ textAlign: "right", fontWeight: "700" }}>{fmt(order.units_to_order)}</td>
                    <td>{order.order_by_date}</td>
                    <td>{urgencyBadge(order.urgency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Recent forecast runs */}
      {snapshots.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "600", margin: "28px 0 8px" }}>
            Recent Forecast Runs
          </h2>
          <table>
            <thead>
              <tr>
                <th>Run At</th>
                <th style={{ textAlign: "right" }}>SKUs</th>
                <th style={{ textAlign: "right" }}>At Risk</th>
                <th style={{ textAlign: "right" }}>Trends Score</th>
                <th style={{ textAlign: "right" }}>Weather Mult.</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap: ForecastSnapshot) => (
                <tr key={snap.id}>
                  <td>{new Date(snap.run_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td style={{ textAlign: "right" }}>{snap.sku_count}</td>
                  <td style={{ textAlign: "right", color: snap.at_risk_count > 0 ? "#dc2626" : "inherit" }}>
                    {snap.at_risk_count}
                  </td>
                  <td style={{ textAlign: "right" }}>{snap.trends_score}/100</td>
                  <td style={{ textAlign: "right" }}>{Number(snap.weather_multiplier).toFixed(2)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="muted" style={{ marginTop: "32px", fontSize: "0.8rem" }}>
        Forecast powered by Google Trends holiday search volume + Open-Meteo regional
        weather-onset data. Runs daily at 06:00 UTC via Vercel cron.
        Last snapshot: {latestSnapshot ? new Date(latestSnapshot.run_at).toLocaleString() : "none yet"}.
      </p>
    </main>
  );
}
