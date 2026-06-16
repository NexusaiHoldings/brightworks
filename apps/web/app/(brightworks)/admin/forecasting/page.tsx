/**
 * Admin — Seasonal Demand Forecasting Dashboard
 *
 * Surfaces forecast vs. current inventory for each SKU and flags units
 * at risk of stockout before the October sell-in deadline.
 * Data is populated by the /api/cron/demand-forecast cron job.
 */

import { getForecastSummary } from '@/lib/brightworks/demand-forecast';
import type { DemandForecast } from '@/lib/brightworks/demand-forecast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function riskLabel(risk: number): string {
  if (risk >= 0.7) return 'Critical';
  if (risk >= 0.5) return 'High';
  if (risk >= 0.3) return 'Medium';
  return 'Low';
}

function riskColor(risk: number): string {
  if (risk >= 0.7) return '#dc2626';
  if (risk >= 0.5) return '#ea580c';
  if (risk >= 0.3) return '#b45309';
  return '#16a34a';
}

function ForecastRow({ f }: { f: DemandForecast }) {
  const risk = Number(f.stockout_risk);
  const isAlert = risk >= 0.5;
  return (
    <tr style={{ background: risk >= 0.5 ? 'rgba(220,38,38,0.06)' : risk >= 0.3 ? 'rgba(251,191,36,0.06)' : undefined }}>
      <td><code>{f.sku_code}</code></td>
      <td>{f.sku_name}</td>
      <td style={{ textAlign: 'right' }}>{f.current_stock}</td>
      <td style={{ textAlign: 'right' }}>{f.predicted_demand}</td>
      <td style={{ textAlign: 'right' }}>
        {f.recommended_reorder_qty > 0
          ? <strong>{f.recommended_reorder_qty}</strong>
          : <span className="muted">—</span>}
      </td>
      <td style={{ textAlign: 'right' }}>{Number(f.trends_index).toFixed(1)}</td>
      <td style={{ textAlign: 'right' }}>{Number(f.weather_factor).toFixed(2)}×</td>
      <td style={{ textAlign: 'right' }}>{Math.round(Number(f.confidence_score) * 100)}%</td>
      <td style={{ textAlign: 'right', fontWeight: isAlert ? 700 : undefined, color: riskColor(risk) }}>
        {riskLabel(risk)} ({Math.round(risk * 100)}%)
      </td>
    </tr>
  );
}

export default async function ForecastingPage() {
  let summary = { forecasts: [] as DemandForecast[], at_risk_count: 0, total_skus: 0, last_run_at: null as string | null };

  try {
    summary = await getForecastSummary();
  } catch {
    // Tables do not exist yet — cron has never run. Show empty state.
  }

  const { forecasts, at_risk_count, total_skus, last_run_at } = summary;
  const atRiskForecasts = forecasts.filter(f => Number(f.stockout_risk) >= 0.5);
  const safeForecasts = forecasts.filter(f => Number(f.stockout_risk) < 0.5);

  return (
    <main>
      <h1>Seasonal Demand Forecasting</h1>
      <p>
        Per-SKU replenishment recommendations driven by Google Trends holiday search
        volume and regional weather-onset data. Flags inventory at risk of stockout
        before the October sell-in deadline.
      </p>

      <div className="card">
        <h2>Forecast Overview</h2>
        <table>
          <tbody>
            <tr>
              <td><strong>SKUs tracked</strong></td>
              <td>{total_skus}</td>
            </tr>
            <tr>
              <td><strong>SKUs at risk of stockout</strong></td>
              <td style={{ color: at_risk_count > 0 ? '#dc2626' : '#16a34a', fontWeight: at_risk_count > 0 ? 700 : undefined }}>
                {at_risk_count}
              </td>
            </tr>
            <tr>
              <td><strong>Last forecast run</strong></td>
              <td>
                {last_run_at
                  ? new Date(last_run_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                  : <span className="muted">Never — trigger cron to populate</span>}
              </td>
            </tr>
            <tr>
              <td><strong>Forecast horizon</strong></td>
              <td>90 days (sell-in deadline: October)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {forecasts.length === 0 ? (
        <div className="empty">
          <p>No forecast data yet.</p>
          <p className="muted">
            Run the demand-forecast cron to populate replenishment recommendations.
            In production this runs automatically on a weekly schedule.
          </p>
          <a className="btn secondary" href="/api/cron/demand-forecast">
            Run Forecast Now
          </a>
        </div>
      ) : (
        <>
          {atRiskForecasts.length > 0 && (
            <>
              <h2 style={{ color: '#dc2626' }}>
                ⚠ At-Risk SKUs ({atRiskForecasts.length})
              </h2>
              <p className="muted">
                These SKUs are projected to stock out before the October sell-in
                deadline. Reorder immediately to account for lead times.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th style={{ textAlign: 'right' }}>On Hand</th>
                    <th style={{ textAlign: 'right' }}>Forecast Demand (90d)</th>
                    <th style={{ textAlign: 'right' }}>Reorder Qty</th>
                    <th style={{ textAlign: 'right' }}>Trends Index</th>
                    <th style={{ textAlign: 'right' }}>Weather ×</th>
                    <th style={{ textAlign: 'right' }}>Confidence</th>
                    <th style={{ textAlign: 'right' }}>Stockout Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskForecasts.map(f => <ForecastRow key={f.id} f={f} />)}
                </tbody>
              </table>
            </>
          )}

          <h2>All SKUs — Inventory vs. Forecast</h2>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th style={{ textAlign: 'right' }}>On Hand</th>
                <th style={{ textAlign: 'right' }}>Forecast Demand (90d)</th>
                <th style={{ textAlign: 'right' }}>Reorder Qty</th>
                <th style={{ textAlign: 'right' }}>Trends Index</th>
                <th style={{ textAlign: 'right' }}>Weather ×</th>
                <th style={{ textAlign: 'right' }}>Confidence</th>
                <th style={{ textAlign: 'right' }}>Stockout Risk</th>
              </tr>
            </thead>
            <tbody>
              {safeForecasts.map(f => <ForecastRow key={f.id} f={f} />)}
            </tbody>
          </table>

          <p className="muted" style={{ marginTop: '1rem' }}>
            Forecast horizon: 90 days · Data sources: Google Trends search volume +
            regional weather-onset index · Last run:{' '}
            {last_run_at
              ? new Date(last_run_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
              : 'unknown'}
          </p>
        </>
      )}
    </main>
  );
}
