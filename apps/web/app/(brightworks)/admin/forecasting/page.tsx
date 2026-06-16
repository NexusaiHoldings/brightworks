/**
 * /admin/forecasting — Seasonal Demand Forecasting Dashboard
 *
 * Surfaces forecast vs. current inventory levels per SKU and flags items at
 * risk of stockout before the October sell-in deadline. Data is produced by
 * the /api/cron/demand-forecast cron job (Google Trends + weather-onset).
 */

import { getLatestForecasts, type SkuForecast } from "@/lib/brightworks/demand-forecast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function RiskBadge({ risk }: { risk: SkuForecast["stockoutRisk"] }) {
  const styles: Record<SkuForecast["stockoutRisk"], string> = {
    high: "risk-high",
    medium: "risk-medium",
    low: "risk-low",
  };
  return <span className={`risk-badge ${styles[risk]}`}>{risk.toUpperCase()}</span>;
}

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card" style={{ minWidth: "140px", textAlign: "center" }}>
      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 700 }}>{value}</p>
      {sub && <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.75rem" }}>{sub}</p>}
    </div>
  );
}

export default async function ForecastingPage() {
  let forecasts: SkuForecast[] = [];
  let lastUpdated: Date | null = null;
  let daysToDeadline = 0;
  let loadError: string | null = null;

  try {
    const data = await getLatestForecasts();
    forecasts = data.forecasts;
    lastUpdated = data.lastUpdated;
    daysToDeadline = data.daysToDeadline;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load forecast data.";
  }

  const highRisk = forecasts.filter((f) => f.stockoutRisk === "high").length;
  const mediumRisk = forecasts.filter((f) => f.stockoutRisk === "medium").length;
  const lowRisk = forecasts.filter((f) => f.stockoutRisk === "low").length;
  const totalReplenishment = forecasts.reduce((sum, f) => sum + f.recommendedReplenishment, 0);
  const hasForecasts = forecasts.some((f) => f.forecastedDemand > 0);

  return (
    <main>
      <style>{`
        .risk-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
        .risk-high { background: #fee2e2; color: #991b1b; }
        .risk-medium { background: #fef3c7; color: #92400e; }
        .risk-low { background: #d1fae5; color: #065f46; }
        .summary-row { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
        .deadline-banner { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px 16px; margin: 12px 0; }
        .deadline-banner.urgent { background: #fee2e2; border-color: #ef4444; }
        .forecast-table th { text-align: left; white-space: nowrap; }
        .forecast-table td { vertical-align: middle; }
        .bar-bg { background: #e5e7eb; border-radius: 4px; height: 8px; width: 100%; }
        .bar-fill { height: 8px; border-radius: 4px; background: #3b82f6; }
        .bar-fill.over { background: #ef4444; }
      `}</style>

      <h1>Seasonal Demand Forecasting</h1>
      <p>
        Per-SKU inventory replenishment recommendations derived from Google Trends holiday
        search volume and regional weather-onset data. Flags SKUs at risk of stockout
        before the October sell-in deadline.
      </p>

      {loadError && (
        <div className="card">
          <p style={{ color: "#991b1b" }}>Error loading forecast data: {loadError}</p>
          <p className="muted">
            Run the cron job at <code>/api/cron/demand-forecast</code> to generate
            forecasts, or check your DATABASE_URL configuration.
          </p>
        </div>
      )}

      <div className={`deadline-banner${daysToDeadline < 30 ? " urgent" : ""}`}>
        <strong>October sell-in deadline:</strong>{" "}
        {daysToDeadline > 0
          ? `${daysToDeadline} days remaining`
          : "Deadline has passed — next cycle begins"}
        {daysToDeadline < 30 && daysToDeadline > 0 && (
          <span> — <strong>urgent replenishment review required</strong></span>
        )}
      </div>

      <div className="summary-row">
        <SummaryCard label="Total SKUs" value={forecasts.length} />
        <SummaryCard label="High Risk" value={highRisk} sub="stockout risk" />
        <SummaryCard label="Medium Risk" value={mediumRisk} sub="stockout risk" />
        <SummaryCard label="Low Risk" value={lowRisk} sub="on track" />
        <SummaryCard label="Units to Replenish" value={totalReplenishment.toLocaleString()} />
      </div>

      {lastUpdated && (
        <p className="muted" style={{ fontSize: "0.8rem" }}>
          Last forecast run:{" "}
          {new Date(lastUpdated).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}

      {!hasForecasts && !loadError ? (
        <div className="empty">
          <p>No forecast data yet.</p>
          <p className="muted">
            Trigger the cron job at <code>GET /api/cron/demand-forecast</code> to run the
            first forecast ingestion from Google Trends and weather-onset signals.
          </p>
        </div>
      ) : (
        !loadError && (
          <table className="forecast-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Current Inventory</th>
                <th>Forecasted Demand</th>
                <th>Coverage</th>
                <th>Replenish Units</th>
                <th>Trend Score</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((sku) => {
                const coveragePct =
                  sku.forecastedDemand > 0
                    ? Math.round((sku.currentInventory / sku.forecastedDemand) * 100)
                    : 100;
                const isOver = coveragePct >= 100;
                return (
                  <tr key={sku.skuId}>
                    <td>{sku.skuName}</td>
                    <td>{sku.currentInventory.toLocaleString()}</td>
                    <td>{sku.forecastedDemand.toLocaleString()}</td>
                    <td style={{ minWidth: "120px" }}>
                      <div className="bar-bg">
                        <div
                          className={`bar-fill${isOver ? " over" : ""}`}
                          style={{ width: `${Math.min(coveragePct, 100)}%` }}
                        />
                      </div>
                      <span className="muted" style={{ fontSize: "0.75rem" }}>
                        {coveragePct}%
                      </span>
                    </td>
                    <td>
                      {sku.recommendedReplenishment > 0 ? (
                        <strong>{sku.recommendedReplenishment.toLocaleString()}</strong>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{sku.trendScore > 0 ? sku.trendScore.toFixed(1) : "—"}</td>
                    <td>
                      <RiskBadge risk={sku.stockoutRisk} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}
    </main>
  );
}
