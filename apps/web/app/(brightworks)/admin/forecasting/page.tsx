/**
 * /admin/forecasting — Seasonal Demand Forecasting Dashboard (Brightworks).
 *
 * Surfaces forecast vs. current inventory levels and flags SKUs at risk of
 * stockout before the October sell-in deadline.  Admin-only; redirects to
 * /login for unauthenticated users.
 */

import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";
import { buildDb } from "@/lib/db";
import {
  ensureTablesExist,
  loadForecastsWithRisk,
  getForecastSummary,
  type ForecastWithSku,
  type StockoutRisk,
} from "@/lib/brightworks/demand-forecast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function riskLabel(risk: StockoutRisk): string {
  const labels: Record<StockoutRisk, string> = {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  };
  return labels[risk];
}

function riskStyle(risk: StockoutRisk): string {
  const styles: Record<StockoutRisk, string> = {
    critical: "color:white;background:#b91c1c;padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.8rem",
    high: "color:white;background:#c2410c;padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.8rem",
    medium: "color:#92400e;background:#fef3c7;padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.8rem",
    low: "color:#166534;background:#dcfce7;padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.8rem",
  };
  return styles[risk];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return dateStr;
  }
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

// ---------------------------------------------------------------------------
// Sub-components (server)
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}): JSX.Element {
  const accentStyle = accent ? `border-left:4px solid ${accent}` : "";
  return (
    <div className="card" style={accentStyle}>
      <div className="muted" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function ForecastTable({ rows }: { rows: ForecastWithSku[] }): JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="empty">
        <p>No forecasts available yet.</p>
        <p className="muted">
          Run the demand-forecast cron manually at{" "}
          <code>/api/cron/demand-forecast</code> or wait for the next scheduled
          execution.
        </p>
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>SKU Code</th>
          <th>Name</th>
          <th>Category</th>
          <th>Current Stock</th>
          <th>Weekly Forecast</th>
          <th>Days of Stock</th>
          <th>Units to Order</th>
          <th>Confidence</th>
          <th>Risk</th>
          <th>Forecast Date</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <code>{row.sku_code}</code>
            </td>
            <td>{row.sku_name}</td>
            <td style={{ textTransform: "capitalize" }}>{row.category}</td>
            <td style={{ textAlign: "right" }}>{row.current_inventory.toLocaleString()}</td>
            <td style={{ textAlign: "right" }}>{row.forecasted_units.toLocaleString()}</td>
            <td
              style={{
                textAlign: "right",
                fontWeight: row.days_of_stock_remaining < row.lead_time_days ? 700 : 400,
                color: row.days_of_stock_remaining < row.lead_time_days ? "#b91c1c" : "inherit",
              }}
            >
              {row.days_of_stock_remaining === 999 ? "∞" : row.days_of_stock_remaining}
            </td>
            <td style={{ textAlign: "right" }}>
              {row.units_to_order > 0 ? (
                <strong>{row.units_to_order.toLocaleString()}</strong>
              ) : (
                <span className="muted">—</span>
              )}
            </td>
            <td style={{ textAlign: "right" }}>{pct(row.confidence)}</td>
            <td>
              <span style={riskStyle(row.stockout_risk)}>{riskLabel(row.stockout_risk)}</span>
            </td>
            <td className="muted" style={{ fontSize: "0.85rem" }}>
              {row.forecast_date}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AtRiskPanel({ rows }: { rows: ForecastWithSku[] }): JSX.Element {
  const atRisk = rows.filter(
    (r) => r.stockout_risk === "critical" || r.stockout_risk === "high",
  );

  if (atRisk.length === 0) {
    return (
      <div className="card" style={{ borderLeft: "4px solid #16a34a" }}>
        <p style={{ margin: 0, color: "#166534", fontWeight: 600 }}>
          All SKUs have adequate inventory levels.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>At-Risk SKUs — Action Required</h2>
      <p className="muted">
        The following SKUs are projected to stock out before replenishment can arrive.
        Place purchase orders immediately.
      </p>
      {atRisk.map((row) => (
        <div
          key={row.id}
          className="card"
          style={{
            borderLeft: `4px solid ${row.stockout_risk === "critical" ? "#b91c1c" : "#c2410c"}`,
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{row.sku_name}</strong>{" "}
              <code className="muted" style={{ fontSize: "0.8rem" }}>{row.sku_code}</code>
            </div>
            <span style={riskStyle(row.stockout_risk)}>{riskLabel(row.stockout_risk)}</span>
          </div>
          <div style={{ marginTop: "8px", display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <span>
              <span className="muted">In stock: </span>
              <strong>{row.current_inventory.toLocaleString()} units</strong>
            </span>
            <span>
              <span className="muted">Weekly demand: </span>
              <strong>{row.forecasted_units.toLocaleString()} units</strong>
            </span>
            <span>
              <span className="muted">Days remaining: </span>
              <strong style={{ color: "#b91c1c" }}>
                {row.days_of_stock_remaining === 999 ? "∞" : row.days_of_stock_remaining}
              </strong>
            </span>
            <span>
              <span className="muted">Order qty: </span>
              <strong>{row.units_to_order.toLocaleString()} units</strong>
            </span>
            <span>
              <span className="muted">Lead time: </span>
              <strong>{row.lead_time_days} days</strong>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ForecastingPage(): Promise<JSX.Element> {
  const admin = await getAdminUser();
  if (!admin) redirect("/login");

  const db = buildDb();

  // Ensure tables exist so the page doesn't crash before the first cron run.
  try {
    await ensureTablesExist(db);
  } catch {
    // Database may not be reachable in preview environments; render gracefully.
  }

  const [forecasts, summary] = await Promise.all([
    loadForecastsWithRisk(db),
    getForecastSummary(db),
  ]);

  // Sort: critical first, then high, medium, low; stable within each tier.
  const riskOrder: Record<StockoutRisk, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedForecasts = [...forecasts].sort(
    (a, b) => riskOrder[a.stockout_risk] - riskOrder[b.stockout_risk],
  );

  const hasCritical = summary.critical_skus > 0;
  const hasHighRisk = summary.high_risk_skus > 0;

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h1>Seasonal Demand Forecasting</h1>
          <p>
            Per-SKU inventory replenishment recommendations based on Google Trends holiday
            search volume and regional weather-onset data. October sell-in deadline tracker.
          </p>
        </div>
        <Link href="/admin" className="btn secondary">← Admin</Link>
      </div>

      {/* Alert banner for critical situations */}
      {(hasCritical || hasHighRisk) && (
        <div
          className="card"
          style={{
            borderLeft: `4px solid ${hasCritical ? "#b91c1c" : "#c2410c"}`,
            background: hasCritical ? "#fef2f2" : "#fff7ed",
          }}
        >
          <strong style={{ color: hasCritical ? "#991b1b" : "#9a3412" }}>
            {hasCritical
              ? `⚠ ${summary.critical_skus} SKU${summary.critical_skus !== 1 ? "s" : ""} at CRITICAL stockout risk`
              : `⚠ ${summary.high_risk_skus} SKU${summary.high_risk_skus !== 1 ? "s" : ""} at HIGH stockout risk`}
          </strong>
          <span className="muted" style={{ marginLeft: "12px" }}>
            Immediate purchase orders required to meet the October sell-in deadline.
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "12px", margin: "16px 0" }}>
        <SummaryCard label="Total SKUs" value={summary.total_skus} />
        <SummaryCard label="Critical Risk" value={summary.critical_skus} accent="#b91c1c" />
        <SummaryCard label="High Risk" value={summary.high_risk_skus} accent="#c2410c" />
        <SummaryCard label="Medium Risk" value={summary.medium_risk_skus} accent="#d97706" />
        <SummaryCard
          label="Last Forecast Run"
          value={summary.last_run_at ? formatDate(summary.last_run_at) : "Not run yet"}
        />
      </div>

      {/* At-risk panel */}
      <AtRiskPanel rows={sortedForecasts} />

      {/* Full SKU table */}
      <h2>All SKUs — Forecast vs. Inventory</h2>
      <p className="muted">
        Forecasts are generated weekly by the demand-forecast cron job. Confidence reflects
        the agreement between trend and weather signals.
      </p>
      <ForecastTable rows={sortedForecasts} />

      {/* Footer notes */}
      <div className="card" style={{ marginTop: "24px" }}>
        <h3 style={{ marginTop: 0 }}>Methodology</h3>
        <ul>
          <li>
            <strong>Trend score</strong> — Google Trends holiday search-volume index (0–100) for the
            SKU category. Higher scores indicate elevated consumer intent near major shopping events.
          </li>
          <li>
            <strong>Weather index</strong> — Regional weather-onset index (0–1) normalised to US
            seasonal patterns. Rises when transitioning to colder weather that drives demand for
            lighting and outdoor seasonal goods.
          </li>
          <li>
            <strong>Weekly forecast</strong> — Combined signal: 50 % trend weight + 50 % weather
            weight applied to the SKU&apos;s historical base sales rate.
          </li>
          <li>
            <strong>Units to order</strong> — Quantity needed to reach 8 weeks of forward stock plus
            a safety buffer equal to 2× lead time demand.
          </li>
          <li>
            <strong>Risk levels</strong> — Critical: &lt; 0.5× lead-time days of stock. High: &lt; 1×.
            Medium: &lt; 1.5×. Low: ≥ 1.5×.
          </li>
        </ul>
      </div>
    </main>
  );
}
