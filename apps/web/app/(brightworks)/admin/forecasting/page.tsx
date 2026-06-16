import React from 'react';
import {
  getSkuForecasts,
  getForecastSummary,
  type SkuForecast,
  type ForecastSummary,
} from '@/lib/brightworks/demand-forecast';

const RISK_STYLES: Record<SkuForecast['stockoutRiskLevel'], React.CSSProperties> = {
  critical: {
    background: '#dc2626',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  high: {
    background: '#ea580c',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  medium: {
    background: '#ca8a04',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  low: {
    background: '#16a34a',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};

function coveragePct(inventory: number, demand: number): string {
  if (demand <= 0) return 'N/A';
  return `${Math.round((inventory / demand) * 100)}%`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function loadDashboardData(): Promise<{
  forecasts: SkuForecast[];
  summary: ForecastSummary;
}> {
  try {
    const [forecasts, summary] = await Promise.all([
      getSkuForecasts(),
      getForecastSummary(),
    ]);
    return { forecasts, summary };
  } catch {
    return {
      forecasts: [],
      summary: {
        totalSkus: 0,
        criticalCount: 0,
        highRiskCount: 0,
        totalReorderUnits: 0,
        lastRunAt: null,
      },
    };
  }
}

export default async function ForecastingPage() {
  const { forecasts, summary } = await loadDashboardData();
  const thisYear = new Date().getFullYear();
  const sellInDeadline = new Date(thisYear, 9, 1);

  return (
    <main>
      <h1>Seasonal Demand Forecasting</h1>
      <p>
        Per-SKU inventory replenishment recommendations based on Google Trends holiday
        search volume and regional weather-onset data. October sell-in deadline:{' '}
        <strong>{formatDate(sellInDeadline)}</strong>.
      </p>

      {summary.lastRunAt && (
        <p className="muted">
          Last forecast run:{' '}
          {summary.lastRunAt.toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          margin: '1.5rem 0',
        }}
      >
        <div className="card" style={{ flex: '1 1 160px', minWidth: '140px' }}>
          <p className="muted" style={{ margin: 0 }}>
            Total SKUs
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
            {summary.totalSkus}
          </p>
        </div>

        <div
          className="card"
          style={{
            flex: '1 1 160px',
            minWidth: '140px',
            borderColor: summary.criticalCount > 0 ? '#dc2626' : undefined,
          }}
        >
          <p className="muted" style={{ margin: 0 }}>
            Critical Risk
          </p>
          <p
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              margin: '0.25rem 0 0',
              color: summary.criticalCount > 0 ? '#dc2626' : undefined,
            }}
          >
            {summary.criticalCount}
          </p>
        </div>

        <div className="card" style={{ flex: '1 1 160px', minWidth: '140px' }}>
          <p className="muted" style={{ margin: 0 }}>
            High Risk SKUs
          </p>
          <p
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              margin: '0.25rem 0 0',
              color: summary.highRiskCount > 0 ? '#ea580c' : undefined,
            }}
          >
            {summary.highRiskCount}
          </p>
        </div>

        <div className="card" style={{ flex: '1 1 160px', minWidth: '140px' }}>
          <p className="muted" style={{ margin: 0 }}>
            Total Reorder Units
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
            {summary.totalReorderUnits.toLocaleString()}
          </p>
        </div>
      </div>

      {forecasts.length === 0 ? (
        <div className="empty">
          <p>No forecast data available yet.</p>
          <p className="muted">
            Trigger the demand-forecast cron at{' '}
            <code>/api/cron/demand-forecast</code> to generate the first forecast.
          </p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Current Inventory</th>
              <th style={{ textAlign: 'right' }}>Forecasted Demand</th>
              <th style={{ textAlign: 'right' }}>Coverage</th>
              <th style={{ textAlign: 'right' }}>Reorder Qty</th>
              <th style={{ textAlign: 'right' }}>Trend Score</th>
              <th>Stockout Risk</th>
              <th>Projected Stockout</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map(forecast => (
              <tr key={forecast.skuId}>
                <td>
                  <strong>{forecast.skuId}</strong>
                  <br />
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {forecast.skuName}
                  </span>
                </td>
                <td>{forecast.category}</td>
                <td style={{ textAlign: 'right' }}>
                  {forecast.currentInventory.toLocaleString()}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {forecast.forecastedDemand.toLocaleString()}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {coveragePct(forecast.currentInventory, forecast.forecastedDemand)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {forecast.recommendedReorder > 0 ? (
                    <strong>{forecast.recommendedReorder.toLocaleString()}</strong>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {forecast.trendScore.toFixed(1)}
                </td>
                <td>
                  <span style={RISK_STYLES[forecast.stockoutRiskLevel]}>
                    {forecast.stockoutRiskLevel.toUpperCase()}
                  </span>
                </td>
                <td>
                  {forecast.stockoutDate ? (
                    formatDate(forecast.stockoutDate)
                  ) : (
                    <span className="muted">Safe</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
