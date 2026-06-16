import {
  generateDemandForecast,
  getLatestForecast,
  storeForecastResults,
} from "@/lib/brightworks/demand-forecast";
import type { ForecastReport, SkuForecast } from "@/lib/brightworks/demand-forecast";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function RiskBadge({ risk }: { risk: "high" | "medium" | "low" }) {
  const label = risk.toUpperCase();
  if (risk === "high") {
    return (
      <span
        style={{
          backgroundColor: "#fee2e2",
          color: "#991b1b",
          padding: "2px 8px",
          borderRadius: "4px",
          fontWeight: 600,
          fontSize: "0.78rem",
        }}
      >
        {label}
      </span>
    );
  }
  if (risk === "medium") {
    return (
      <span
        style={{
          backgroundColor: "#fef3c7",
          color: "#92400e",
          padding: "2px 8px",
          borderRadius: "4px",
          fontWeight: 600,
          fontSize: "0.78rem",
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      style={{
        backgroundColor: "#dcfce7",
        color: "#166534",
        padding: "2px 8px",
        borderRadius: "4px",
        fontWeight: 600,
        fontSize: "0.78rem",
      }}
    >
      {label}
    </span>
  );
}

function MiniBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div
      style={{
        width: "72px",
        height: "8px",
        backgroundColor: "#e5e7eb",
        borderRadius: "4px",
        overflow: "hidden",
        display: "inline-block",
        verticalAlign: "middle",
      }}
    >
      <div
        style={{ width: `${pct}%`, height: "100%", backgroundColor: color }}
      />
    </div>
  );
}

function InventoryVsForecast({
  current,
  forecasted,
}: {
  current: number;
  forecasted: number;
}) {
  const maxVal = Math.max(current, forecasted, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <MiniBar value={current} max={maxVal} color="#3b82f6" />
        <span style={{ fontSize: "0.8rem" }}>{current}</span>
        <span className="muted" style={{ fontSize: "0.75rem" }}>
          current
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <MiniBar value={forecasted} max={maxVal} color="#f59e0b" />
        <span style={{ fontSize: "0.8rem" }}>{forecasted}</span>
        <span className="muted" style={{ fontSize: "0.75rem" }}>
          forecast
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="card" style={{ flex: "1", minWidth: "140px" }}>
      <p className="muted" style={{ margin: "0 0 4px" }}>
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "2rem",
          fontWeight: 700,
          color: danger ? "#dc2626" : undefined,
        }}
      >
        {value}
      </p>
    </div>
  );
}

export default async function ForecastingPage() {
  let forecast: ForecastReport | null = null;
  let loadError: string | null = null;

  try {
    forecast = await getLatestForecast();
    // Bootstrap on first visit: generate and persist a forecast immediately.
    if (!forecast) {
      const fresh = await generateDemandForecast();
      await storeForecastResults(fresh.skuForecasts);
      forecast = fresh;
    }
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Failed to load forecast data";
  }

  const now = new Date();
  const year = now.getFullYear();
  const sellIn = new Date(year, 9, 1); // October 1
  if (now > sellIn) sellIn.setFullYear(year + 1);
  const daysUntilDeadline = Math.max(
    0,
    Math.floor((sellIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  return (
    <main>
      <h1>Seasonal Demand Forecasting</h1>
      <p>
        Per-SKU inventory replenishment recommendations driven by Google Trends
        holiday search volume and regional weather-onset signals. SKUs at risk of
        stockout before the October sell-in deadline are flagged in red.
      </p>

      {loadError && (
        <div
          className="card"
          style={{ borderColor: "#fca5a5", backgroundColor: "#fef2f2" }}
        >
          <p style={{ color: "#dc2626", margin: 0 }}>Error: {loadError}</p>
        </div>
      )}

      {forecast && (
        <>
          <div
            style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              marginBottom: "24px",
            }}
          >
            <StatCard label="Total SKUs" value={forecast.totalSkus} />
            <StatCard
              label="High-Risk SKUs"
              value={forecast.highRiskCount}
              danger={forecast.highRiskCount > 0}
            />
            <StatCard
              label="Days to Sell-In"
              value={daysUntilDeadline}
              danger={daysUntilDeadline < 30}
            />
            <div className="card" style={{ flex: "1", minWidth: "140px" }}>
              <p className="muted" style={{ margin: "0 0 4px" }}>
                Last Updated
              </p>
              <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>
                {new Date(forecast.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="toolbar">
            <span style={{ fontWeight: 600 }}>
              Sell-In Deadline: October 1, {sellIn.getFullYear()}
            </span>
            <a href="/api/cron/demand-forecast" className="btn secondary">
              Refresh Forecast
            </a>
          </div>

          {forecast.skuForecasts.length === 0 ? (
            <div className="empty">
              <p>
                No SKU data available yet. The forecast will populate after
                the first cron run.
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Risk</th>
                  <th>Inventory vs Forecast</th>
                  <th>Replenishment Needed</th>
                  <th>Trends Score</th>
                  <th>Weather Score</th>
                  <th>Sell-In Deadline</th>
                </tr>
              </thead>
              <tbody>
                {forecast.skuForecasts.map((sku: SkuForecast) => (
                  <tr
                    key={sku.skuId}
                    style={
                      sku.stockoutRisk === "high"
                        ? { backgroundColor: "#fef2f2" }
                        : undefined
                    }
                  >
                    <td>
                      <strong>{sku.skuName}</strong>
                    </td>
                    <td>
                      <RiskBadge risk={sku.stockoutRisk} />
                    </td>
                    <td>
                      <InventoryVsForecast
                        current={sku.currentInventory}
                        forecasted={sku.forecastedDemand}
                      />
                    </td>
                    <td>
                      {sku.recommendedReplenishment > 0 ? (
                        <strong
                          style={{
                            color:
                              sku.stockoutRisk === "high"
                                ? "#dc2626"
                                : sku.stockoutRisk === "medium"
                                ? "#d97706"
                                : undefined,
                          }}
                        >
                          +{sku.recommendedReplenishment} units
                        </strong>
                      ) : (
                        <span className="muted">Sufficient</span>
                      )}
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <MiniBar
                          value={sku.trendsScore}
                          max={100}
                          color="#8b5cf6"
                        />
                        <span>{Math.round(sku.trendsScore)}</span>
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <MiniBar
                          value={sku.weatherScore}
                          max={100}
                          color="#06b6d4"
                        />
                        <span>{Math.round(sku.weatherScore)}</span>
                      </div>
                    </td>
                    <td className="muted">{sku.sellInDeadline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  );
}
