import React from 'react';
import { getLatestForecasts, getRecentRuns, type SkuForecast, type ForecastRun } from '@/lib/brightworks/demand-forecast';

export const dynamic = 'force-dynamic';

function RiskBadge({ risk }: { risk: SkuForecast['stockout_risk'] }): React.ReactElement {
  if (risk === 'high') return <span className="danger" style={{ fontWeight: 600 }}>High Risk</span>;
  if (risk === 'medium') return <span className="muted" style={{ fontWeight: 600 }}>Medium</span>;
  return <span className="success">Low</span>;
}

export default async function ForecastingDashboard(): Promise<React.ReactElement> {
  let forecasts: SkuForecast[] = [];
  let recentRuns: ForecastRun[] = [];
  let loadError: string | null = null;

  try {
    [forecasts, recentRuns] = await Promise.all([getLatestForecasts(), getRecentRuns(5)]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load forecast data';
  }

  const highRiskCount = forecasts.filter((f) => f.stockout_risk === 'high').length;
  const mediumRiskCount = forecasts.filter((f) => f.stockout_risk === 'medium').length;
  const octoberCount = forecasts.filter((f) => f.october_deadline).length;

  return (
    <main>
      <h1>Seasonal Demand Forecasting</h1>
      <p>
        Per-SKU inventory replenishment recommendations based on Google Trends holiday search volume
        and regional weather-onset data. Monitors stockout risk against the October sell-in deadline.
      </p>

      {loadError && (
        <div className="card">
          <p className="danger">{loadError}</p>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>High Stockout Risk</p>
          <p className="danger" style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
            {highRiskCount}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>SKUs require immediate reorder</p>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Medium Risk</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
            {mediumRiskCount}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>SKUs approaching threshold</p>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>October Deadline Flags</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0 0', color: 'var(--substrate-accent)' }}>
            {octoberCount}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Must reorder before sell-in</p>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Total SKUs Tracked</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
            {forecasts.length}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Products in seasonal catalog</p>
        </div>
      </div>

      <h2>SKU Forecast vs. Inventory</h2>

      {forecasts.length === 0 ? (
        <div className="empty">
          <p>No forecast data yet. Trigger the demand forecast cron to generate predictions.</p>
          <p className="muted">
            POST to <code>/api/cron/demand-forecast</code> or wait for the next scheduled run.
          </p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU Name</th>
              <th style={{ textAlign: 'right' }}>Current Inventory</th>
              <th style={{ textAlign: 'right' }}>Forecast Demand/mo</th>
              <th style={{ textAlign: 'right' }}>Trend Score</th>
              <th style={{ textAlign: 'right' }}>Weather Score</th>
              <th style={{ textAlign: 'right' }}>Days to Stockout</th>
              <th>Risk Level</th>
              <th>Oct. Deadline</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((forecast) => (
              <tr key={forecast.sku_id}>
                <td>{forecast.sku_name}</td>
                <td style={{ textAlign: 'right' }}>{forecast.current_inventory.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{forecast.forecasted_demand.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{(forecast.trend_score * 100).toFixed(0)}%</td>
                <td style={{ textAlign: 'right' }}>{(forecast.weather_score * 100).toFixed(0)}%</td>
                <td style={{ textAlign: 'right' }}>
                  {forecast.days_until_stockout !== null ? forecast.days_until_stockout : '—'}
                </td>
                <td>
                  <RiskBadge risk={forecast.stockout_risk} />
                </td>
                <td>
                  {forecast.october_deadline ? (
                    <span className="danger">Reorder needed</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {recentRuns.length > 0 && (
        <>
          <h2>Recent Forecast Runs</h2>
          <table>
            <thead>
              <tr>
                <th>Run Time (UTC)</th>
                <th style={{ textAlign: 'right' }}>SKUs Analyzed</th>
                <th style={{ textAlign: 'right' }}>High Risk Count</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr key={run.id}>
                  <td>{new Date(run.run_at).toLocaleString('en-US', { timeZone: 'UTC' })}</td>
                  <td style={{ textAlign: 'right' }}>{run.skus_analyzed}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={run.high_risk_count > 0 ? 'danger' : 'success'}>
                      {run.high_risk_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="muted" style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>
        Forecast data refreshes daily via Vercel cron at <code>/api/cron/demand-forecast</code>.
        Signals ingested: Google Trends holiday search volume + regional weather-onset indices.
        October sell-in deadline is the primary replenishment gate for this single-season catalog.
      </p>
    </main>
  );
}
