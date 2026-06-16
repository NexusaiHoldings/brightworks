import type { JSX, CSSProperties } from 'react';
import { getDashboardData, type DemandForecast } from '@/lib/brightworks/demand-forecast';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RISK_STYLES: Record<string, CSSProperties> = {
  high: { background: '#fee2e2', color: '#991b1b', padding: '2px 10px', borderRadius: '9999px', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', display: 'inline-block' },
  medium: { background: '#fef3c7', color: '#92400e', padding: '2px 10px', borderRadius: '9999px', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', display: 'inline-block' },
  low: { background: '#d1fae5', color: '#065f46', padding: '2px 10px', borderRadius: '9999px', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', display: 'inline-block' },
};

function coveragePct(inventory: number, demand: number): string {
  if (demand === 0) return '—';
  return `${Math.round((inventory / demand) * 100)}%`;
}

function coverageColor(inventory: number, demand: number): string {
  if (demand === 0) return 'inherit';
  if (inventory < demand) return '#dc2626';
  if (inventory < demand * 1.2) return '#d97706';
  return '#15803d';
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export default async function ForecastingPage(): Promise<JSX.Element> {
  let forecasts: DemandForecast[] = [];
  let fetchError: string | null = null;

  try {
    forecasts = await getDashboardData();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Failed to load forecast data';
  }

  const highRisk = forecasts.filter((f) => f.stockout_risk === 'high');
  const mediumRisk = forecasts.filter((f) => f.stockout_risk === 'medium');
  const totalReplenishment = forecasts.reduce((s, f) => s + f.replenishment_qty, 0);
  const daysToDeadline = forecasts[0]?.days_to_deadline ?? 107;
  const lastUpdated = forecasts.find((f) => f.last_updated)?.last_updated;

  const deadlineUrgent = daysToDeadline < 30;

  return (
    <main>
      <h1>Seasonal Demand Forecasting</h1>
      <p>
        Per-SKU inventory replenishment recommendations driven by Google Trends holiday search
        volume and regional weather-onset signals. SKUs at risk of stockout before the{' '}
        <strong>October sell-in deadline</strong> are surfaced for immediate action.
      </p>

      {fetchError && (
        <div className="card" style={{ borderColor: '#fca5a5', background: '#fef2f2', marginBottom: '1rem' }}>
          <p style={{ color: '#b91c1c', margin: 0 }}>
            <strong>Error loading forecast data:</strong> {fetchError}
          </p>
          <p className="muted" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            Trigger the demand forecast cron to initialize data: <code>GET /api/cron/demand-forecast</code>
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', margin: '1.5rem 0' }}>
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: '.75rem' }}>DAYS TO DEADLINE</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '.25rem 0', color: deadlineUrgent ? '#dc2626' : 'inherit' }}>
            {daysToDeadline}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: '.75rem' }}>Until Oct 1 sell-in</p>
        </div>

        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: '.75rem' }}>HIGH RISK SKUs</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '.25rem 0', color: highRisk.length > 0 ? '#dc2626' : '#15803d' }}>
            {highRisk.length}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: '.75rem' }}>of {forecasts.length} total</p>
        </div>

        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: '.75rem' }}>MEDIUM RISK SKUs</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '.25rem 0', color: mediumRisk.length > 0 ? '#d97706' : '#15803d' }}>
            {mediumRisk.length}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: '.75rem' }}>Monitor closely</p>
        </div>

        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: '.75rem' }}>UNITS TO ORDER</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '.25rem 0' }}>
            {fmt(totalReplenishment)}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: '.75rem' }}>Recommended replenishment</p>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: '1rem' }}>
        <p className="muted" style={{ margin: 0 }}>
          {lastUpdated
            ? `Last run: ${new Date(lastUpdated).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
            : 'No forecast run yet — trigger the cron to generate recommendations.'}
        </p>
        <a href="/api/cron/demand-forecast" className="btn secondary">
          Run Forecast Now
        </a>
      </div>

      {forecasts.length === 0 && !fetchError && (
        <div className="empty">
          <p>No inventory data found. Run the demand forecast cron to initialize SKU records.</p>
          <a href="/api/cron/demand-forecast" className="btn">Initialize Forecast Data</a>
        </div>
      )}

      {forecasts.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>In Stock</th>
              <th style={{ textAlign: 'right' }}>Forecasted</th>
              <th style={{ textAlign: 'right' }}>Coverage</th>
              <th style={{ textAlign: 'right' }}>Reorder Qty</th>
              <th style={{ textAlign: 'center' }}>Risk</th>
              <th style={{ textAlign: 'right' }}>Trend</th>
              <th style={{ textAlign: 'right' }}>Weather</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((forecast) => {
              const rowBg: CSSProperties =
                forecast.stockout_risk === 'high'
                  ? { background: '#fff7f7' }
                  : forecast.stockout_risk === 'medium'
                  ? { background: '#fffbeb' }
                  : {};

              return (
                <tr key={forecast.id} style={rowBg}>
                  <td>
                    <strong>{forecast.sku_name}</strong>
                    <br />
                    <span className="muted" style={{ fontSize: '.75rem' }}>{forecast.sku_code}</span>
                  </td>
                  <td>{forecast.category}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(forecast.current_inventory)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {forecast.forecasted_demand > 0
                      ? fmt(forecast.forecasted_demand)
                      : <span className="muted">—</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ color: coverageColor(forecast.current_inventory, forecast.forecasted_demand), fontWeight: 600 }}>
                      {coveragePct(forecast.current_inventory, forecast.forecasted_demand)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: forecast.replenishment_qty > 0 ? 700 : 400 }}>
                    {forecast.replenishment_qty > 0
                      ? fmt(forecast.replenishment_qty)
                      : <span className="muted">0</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={RISK_STYLES[forecast.stockout_risk] ?? RISK_STYLES.low}>
                      {forecast.stockout_risk}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {forecast.trend_score > 0 ? `${forecast.trend_score}/100` : <span className="muted">—</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {forecast.weather_score > 0 ? `${forecast.weather_score}/100` : <span className="muted">—</span>}
                  </td>
                  <td style={{ fontSize: '.78rem', color: '#475569', maxWidth: '280px' }}>
                    {forecast.recommendation_notes}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {forecasts.length > 0 && (
        <p className="muted" style={{ marginTop: '1rem', fontSize: '.8rem' }}>
          <strong>Coverage</strong> = in-stock ÷ forecasted demand &nbsp;·&nbsp;
          <span style={{ color: '#dc2626' }}>Red &lt;100%</span> &nbsp;·&nbsp;
          <span style={{ color: '#d97706' }}>Amber &lt;120%</span> &nbsp;·&nbsp;
          <span style={{ color: '#15803d' }}>Green ≥120%</span> &nbsp;·&nbsp;
          Model: Google Trends holiday signal + Open-Meteo cold-onset signal × category multiplier
        </p>
      )}
    </main>
  );
}
