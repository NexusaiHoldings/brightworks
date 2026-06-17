'use client';

import { useState, type JSX } from 'react';
import {
  getRecommendation,
  formatPrice,
  type HomeFootprint,
  type InstallLocation,
  type FailureMode,
  type SelectorResult,
} from '@/lib/brightworks/selector-logic';

type Step = 'footprint' | 'location' | 'failure' | 'result';

interface Answers {
  homeFootprint: HomeFootprint | null;
  installLocation: InstallLocation | null;
  failureMode: FailureMode | null;
}

interface OptionCardProps {
  label: string;
  description: string;
  onSelect: () => void;
}

function OptionCard({ label, description, onSelect }: OptionCardProps): JSX.Element {
  return (
    <div className="card" style={{ cursor: 'pointer', marginBottom: '0.75rem' }}>
      <button
        type="button"
        onClick={onSelect}
        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <strong>{label}</strong>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>{description}</p>
      </button>
    </div>
  );
}

const STEP_LABELS: Record<Step, string> = {
  footprint: 'Home Size',
  location: 'Install Location',
  failure: 'Previous Failure',
  result: 'Your Match',
};

const ORDERED_STEPS: Step[] = ['footprint', 'location', 'failure', 'result'];

export default function SelectorPage(): JSX.Element {
  const [step, setStep] = useState<Step>('footprint');
  const [answers, setAnswers] = useState<Answers>({
    homeFootprint: null,
    installLocation: null,
    failureMode: null,
  });
  const [result, setResult] = useState<SelectorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectFootprint(footprint: HomeFootprint): void {
    setAnswers((prev) => ({ ...prev, homeFootprint: footprint }));
    setStep('location');
  }

  function selectLocation(location: InstallLocation): void {
    setAnswers((prev) => ({ ...prev, installLocation: location }));
    setStep('failure');
  }

  function selectFailureMode(mode: FailureMode): void {
    const updated: Answers = { ...answers, failureMode: mode };
    setAnswers(updated);
    if (!updated.homeFootprint || !updated.installLocation) {
      setError('Incomplete questionnaire — please start over.');
      setStep('result');
      return;
    }
    try {
      const recommendation = getRecommendation({
        homeFootprint: updated.homeFootprint,
        installLocation: updated.installLocation,
        failureMode: mode,
      });
      setResult(recommendation);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
    setStep('result');
  }

  function restart(): void {
    setStep('footprint');
    setAnswers({ homeFootprint: null, installLocation: null, failureMode: null });
    setResult(null);
    setError(null);
  }

  const stepIndex = ORDERED_STEPS.indexOf(step);
  const isQuestionStep = step !== 'result';

  return (
    <main>
      <h1>Find Your Perfect Outdoor Lighting</h1>
      <p>Answer three quick questions and we'll match you to the right Brightworks kit — built to avoid the exact failure you experienced.</p>

      {isQuestionStep && (
        <div className="muted" style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Step {stepIndex + 1} of 3 &mdash; {STEP_LABELS[step]}
        </div>
      )}

      {step === 'footprint' && (
        <section aria-label="Step 1: Home size">
          <h2>How large is your home?</h2>
          <OptionCard
            label="Small — under 1,500 sq ft"
            description="Townhouse, condo, or compact single-story home."
            onSelect={() => selectFootprint('small')}
          />
          <OptionCard
            label="Medium — 1,500 to 3,000 sq ft"
            description="Typical two-story or ranch-style home."
            onSelect={() => selectFootprint('medium')}
          />
          <OptionCard
            label="Large — over 3,000 sq ft"
            description="Large two-story, estate, or corner-lot home."
            onSelect={() => selectFootprint('large')}
          />
        </section>
      )}

      {step === 'location' && (
        <section aria-label="Step 2: Install location">
          <h2>Where will the lights go?</h2>
          <OptionCard
            label="Roofline"
            description="Along gutters, eaves, or fascia boards."
            onSelect={() => selectLocation('roofline')}
          />
          <OptionCard
            label="Shrubs &amp; Hedges"
            description="Foundation plantings, bushes, or low hedges."
            onSelect={() => selectLocation('shrub')}
          />
          <OptionCard
            label="Trees"
            description="Wrapping trunks and branches of accent or specimen trees."
            onSelect={() => selectLocation('tree')}
          />
        </section>
      )}

      {step === 'failure' && (
        <section aria-label="Step 3: Previous failure mode">
          <h2>What caused your previous setup to fail?</h2>
          <OptionCard
            label="Timer failure"
            description="The timer stopped working, ran on the wrong schedule, or burned out from overuse."
            onSelect={() => selectFailureMode('timer')}
          />
          <OptionCard
            label="Connector burnout"
            description="The plug or inline connectors arced, melted, or shorted out."
            onSelect={() => selectFailureMode('connector')}
          />
        </section>
      )}

      {step === 'result' && error && (
        <div role="alert" className="card">
          <p style={{ color: '#b91c1c' }}>Could not generate a recommendation: {error}</p>
          <button type="button" onClick={restart}>Start over</button>
        </div>
      )}

      {step === 'result' && result && !error && (
        <section aria-label="Your product recommendation">
          <h2>Your Match</h2>

          <div className="card">
            <p className="muted" style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recommended SKU
            </p>
            <h3 style={{ margin: '0 0 0.25rem' }}>{result.product.name}</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              {result.product.sku} &middot; {formatPrice(result.product.priceCents)}
            </p>
            <p>{result.product.description}</p>
            <ul>
              {result.product.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <p className="muted" style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
              {result.reason}
            </p>
            <a
              href={result.product.addToCartPath}
              className="btn"
              style={{ display: 'inline-block', marginTop: '0.75rem' }}
            >
              Add to Cart &mdash; {formatPrice(result.product.priceCents)}
            </a>
          </div>

          {result.upsell && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Recommended Add-On
              </p>
              <h3 style={{ margin: '0 0 0.25rem' }}>{result.upsell.name}</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {result.upsell.sku} &middot; {formatPrice(result.upsell.priceCents)}
              </p>
              <p>{result.upsell.description}</p>
              <ul>
                {result.upsell.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <a
                href={result.upsell.addToCartPath}
                className="btn secondary"
                style={{ display: 'inline-block', marginTop: '0.75rem' }}
              >
                Add to Cart &mdash; {formatPrice(result.upsell.priceCents)}
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={restart}
            className="btn secondary"
            style={{ marginTop: '1.5rem', display: 'inline-block' }}
          >
            Start over
          </button>
        </section>
      )}
    </main>
  );
}
