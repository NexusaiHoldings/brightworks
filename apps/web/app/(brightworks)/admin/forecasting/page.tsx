/**
 * /admin/forecasting — Seasonal Demand Forecasting Dashboard.
 *
 * Server component. Reads the latest demand-forecast run from Postgres and
 * surfaces forecast vs. current inventory levels, flagging SKUs at risk of
 * stockout before the October sell-in deadline.
 */

import type { JSX, CSSProperties } from "react";
import { getLatestForecastRun } from "@/lib/brightworks/demand-forecast";
import type { ForecastEntry, StockoutRisk } from "@/lib/brightworks/demand-forecast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Helpers ──────────────────────────────────────────────────────────────────

function riskBadge(risk: StockoutRisk, octRisk: boolean): string {
  if (risk === "high" || octRisk) return "🔴 High";
  if (risk === "medium") return "🟡 Medium";
  return "🟢 Low";
}

function riskStyle(risk: StockoutRisk, octRisk: boolean): CSSProperties {
  if (risk === "high" || octRisk) return { color: "#b91c1c", fontWeight: 600 };
  if (risk === "medium") return { color: "#92400e", fontWeight: 600 };
  return { color: "#065f46", fontWeight: 600 };
}

function daysUntilOctober(): number {
  const now = new Date();
  const yr = now.getFullYear();
  let deadline = new Date(yr, 9, 1);
  if (deadline <= now) deadline = new Date(yr + 1, 9, 1);
  return Math.floor((deadline.getTime() - now.getTime()) / 86_400_000);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ForecastingPage(): Promise<JSX.Element> {
  let run = null;
  let fetchError: string | null = null;

  try {
    run = await getLatestForecastRun();
  } catch (err) {
    fetchError = String((err as Error).message);
  }

  const octDays = daysUntilOctober();
  const highRisk: ForecastEntry[] = run
    ? run.entries.filter((e) => e.stockout_risk === "high" || e.october_sellout_risk)
    : [];

  return (
    <main>
      <h1>Seasonal Demand Forecasting</h1>
      <p>
        Per-SKU inventory replenishment recommendations based on Google Trends
        holiday search volume and regional weather-onset data. Flags SKUs at
        risk of stockout before the{" "}
        <strong>October sell-in deadline ({octDays} days away)</strong>.
      </p>

      {fetchError && (
        <div className="card" role="alert" style={{ borderColor: "#fca5a5", background: "#fff1f1" }}>
          <strong>Error loading forecast:</strong> {fetchError}
          <p className="muted">
            Trigger the cron manually at{" "}
            <code>/api/cron/demand-forecast</code> to generate the first run.
          </p>
        </div>
      )}

      {/* Summary strip */}
      {run && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          <div className="card" style={{ flex: "1 1 180px" }}>
            <div className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}>Last Run</div>
            <div style={{ fontWeight: 600 }}>{formatDate(run.ran_at)}</div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              Trend date: {run.trend_data_date}
            </div>
          </div>
          <div className="card" style={{ flex: "1 1 140px" }}>
            <div className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}>Total SKUs</div>
            <div style={{ fontWeight: 700, fontSize: "1.5rem" }}>{run.total_skus}</div>
          </div>
          <div className="card" style={{ flex: "1 1 140px", borderColor: run.skus_at_risk > 0 ? "#fca5a5" : undefined }}>
            <div className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}>SKUs at Risk</div>
            <div style={{ fontWeight: 700, fontSize: "1.5rem", color: run.skus_at_risk > 0 ? "#b91c1c" : undefined }}>
              {run.skus_at_risk}
            </div>
          </div>
          <div className="card" style={{ flex: "1 1 160px" }}>
            <div className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}>Oct Sell-In</div>
            <div style={{ fontWeight: 700, fontSize: "1.5rem", color: octDays < 45 ? "#92400e" : undefined }}>
              {octDays}d
            </div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>until deadline</div>
          </div>
        </div>
      )}

      {/* High-risk alert strip */}
      {run && highRisk.length > 0 && (
        <div className="card" style={{ borderColor: "#fca5a5", background: "#fff1f1", marginBottom: "1.5rem" }}>
          <strong style={{ color: "#b91c1c" }}>
            ⚠ {highRisk.length} SKU{highRisk.length !== 1 ? "s" : ""} require immediate attention
          </strong>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
            {highRisk.map((e) => (
              <li key={e.sku_id} style={{ marginBottom: "0.25rem" }}>
                <strong>{e.sku_name}</strong> — {e.recommended_action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!run && !fetchError && (
        <div className="empty">
          <p>No forecast data yet.</p>
          <p className="muted">
            Trigger the cron at <code>/api/cron/demand-forecast</code> to
            generate the first run, or wait for the daily scheduled job.
          </p>
        </div>
      )}

      {/* Full SKU table */}
      {run && run.entries.length > 0 && (
        <>
          <h2>SKU Inventory vs. Forecast</h2>
          <table>
            <thead>
              <tr>
                <th>SKU Name</th>
                <th>Category</th>
                <th style={{ textAlign: "right" }}>On Hand</th>
                <th style={{ textAlign: "right" }}>Forecasted</th>
                <th style={{ textAlign: "right" }}>Replenish</th>
                <th style={{ textAlign: "right" }}>Trend</th>
                <th style={{ textAlign: "right" }}>Weather</th>
                <th style={{ textAlign: "right" }}>Days Left</th>
                <th>Risk</th>
                <th>Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {run.entries.map((e) => (
                <tr key={e.sku_id}>
                  <td>{e.sku_name}</td>
                  <td className="muted">{e.sku_id.slice(0, 8)}</td>
                  <td style={{ textAlign: "right" }}>{e.current_inventory.toLocaleString()}</td>
                  <td style={{ textAlign: "right" }}>{e.forecasted_demand.toLocaleString()}</td>
                  <td style={{ textAlign: "right", fontWeight: e.replenishment_qty > 0 ? 600 : undefined }}>
                    {e.replenishment_qty > 0 ? `+${e.replenishment_qty.toLocaleString()}` : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>{pct(e.trend_score)}</td>
                  <td style={{ textAlign: "right" }}>{pct(e.weather_score)}</td>
                  <td style={{ textAlign: "right" }}>
                    {e.days_until_stockout >= 999 ? "∞" : e.days_until_stockout}
                  </td>
                  <td style={riskStyle(e.stockout_risk, e.october_sellout_risk)}>
                    {riskBadge(e.stockout_risk, e.october_sellout_risk)}
                    {e.october_sellout_risk && (
                      <span className="muted" style={{ fontSize: "0.7rem", display: "block" }}>
                        Oct deadline risk
                      </span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: "0.85rem" }}>
                    {e.recommended_action}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Methodology note */}
      <details style={{ marginTop: "2rem" }}>
        <summary className="muted" style={{ cursor: "pointer" }}>
          Forecast methodology
        </summary>
        <div className="card" style={{ marginTop: "0.5rem" }}>
          <p>
            <strong>Demand signal</strong> = 60% Google Trends score + 40%
            regional weather-onset score. Trend scores are normalized 0–100
            relative search interest for ski/snowboard keywords across five
            key US mountain-state markets (CO, VT, CA, UT, WA). Weather-onset
            scores reflect average snowfall and temperature at ski-resort
            elevations; high scores indicate early-season conditions that
            accelerate consumer purchasing.
          </p>
          <p>
            <strong>Forecasted demand</strong> = peak daily demand × combined
            signal × days remaining in the sell-in window (capped at 90 days).
            Peak daily demand is calibrated at 2× the SKU&apos;s reorder point
            per 30-day period.
          </p>
          <p>
            <strong>Risk classification:</strong> &ldquo;High&rdquo; — on-hand
            below reorder point with demand signal &gt;50%. &ldquo;Medium&rdquo;
            — on-hand below 1.5× reorder point with demand signal &gt;40%.
            &ldquo;October deadline risk&rdquo; is flagged independently when
            projected days-to-stockout is less than days remaining until the
            October sell-in deadline.
          </p>
          <p>
            <strong>Replenishment quantity</strong> is rounded up to the SKU&apos;s
            minimum order quantity (MOQ). The cron runs daily at 06:00 UTC.
          </p>
        </div>
      </details>
    </main>
  );
}
