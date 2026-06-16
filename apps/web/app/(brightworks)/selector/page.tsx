'use client';

import { useState } from 'react';
import {
  type FailureMode,
  type HomeFootprint,
  type InstallLocation,
  type SelectorInputs,
  type SelectorResult,
  getAllFailureModeOptions,
  getAllFootprintOptions,
  getAllLocationOptions,
  getRecommendation,
} from '@/lib/brightworks/selector-logic';

type Step = 'footprint' | 'location' | 'failure' | 'result';

interface StepMeta {
  id: Step;
  title: string;
  subtitle: string;
}

const STEPS: StepMeta[] = [
  {
    id: 'footprint',
    title: 'What size is your home?',
    subtitle:
      'We use this to estimate the number of strands you need for complete coverage.',
  },
  {
    id: 'location',
    title: 'Where are you installing lights?',
    subtitle:
      'Each install location has different load, moisture, and flex requirements.',
  },
  {
    id: 'failure',
    title: 'What failed last time?',
    subtitle:
      'Our products are engineered around the two most common residential failure modes.',
  },
];

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div
      style={{
        height: '6px',
        background: 'var(--color-border, #e2e8f0)',
        borderRadius: '3px',
        marginBottom: '2rem',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: 'var(--color-primary, #2563eb)',
          borderRadius: '3px',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

function OptionCard<T extends string>({
  value,
  label,
  selected,
  onSelect,
}: {
  value: T;
  label: string;
  selected: boolean;
  onSelect: (v: T) => void;
}) {
  return (
    <div
      className="card"
      style={{
        cursor: 'pointer',
        borderColor: selected ? 'var(--color-primary, #2563eb)' : undefined,
        outline: selected ? '2px solid var(--color-primary, #2563eb)' : 'none',
        marginBottom: '0.75rem',
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(value);
        }
      }}
    >
      <strong>{label}</strong>
    </div>
  );
}

function FootprintStep({
  value,
  onChange,
}: {
  value: HomeFootprint | null;
  onChange: (v: HomeFootprint) => void;
}) {
  const options = getAllFootprintOptions();
  return (
    <>
      {options.map((opt) => (
        <OptionCard
          key={opt.value}
          value={opt.value}
          label={opt.label}
          selected={value === opt.value}
          onSelect={onChange}
        />
      ))}
    </>
  );
}

function LocationStep({
  value,
  onChange,
}: {
  value: InstallLocation | null;
  onChange: (v: InstallLocation) => void;
}) {
  const options = getAllLocationOptions();
  return (
    <>
      {options.map((opt) => (
        <OptionCard
          key={opt.value}
          value={opt.value}
          label={opt.label}
          selected={value === opt.value}
          onSelect={onChange}
        />
      ))}
    </>
  );
}

function FailureModeStep({
  value,
  onChange,
}: {
  value: FailureMode | null;
  onChange: (v: FailureMode) => void;
}) {
  const options = getAllFailureModeOptions();
  return (
    <>
      {options.map((opt) => (
        <OptionCard
          key={opt.value}
          value={opt.value}
          label={opt.label}
          selected={value === opt.value}
          onSelect={onChange}
        />
      ))}
    </>
  );
}

function ResultView({
  result,
  onRestart,
}: {
  result: SelectorResult;
  onRestart: () => void;
}) {
  const { primary, addOns, rationale, quantityRecommended, totalEstimatedUsd } = result;

  return (
    <>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p className="muted" style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
          Recommended product
        </p>
        <h2 style={{ marginTop: 0 }}>{primary.name}</h2>
        <p className="muted">{primary.tagline}</p>
        <p>{rationale}</p>
        <ul>
          {primary.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <table>
          <tbody>
            <tr>
              <td>SKU</td>
              <td>
                <strong>{primary.sku}</strong>
              </td>
            </tr>
            <tr>
              <td>Unit price</td>
              <td>${primary.priceUsd.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Recommended qty</td>
              <td>{quantityRecommended}</td>
            </tr>
            <tr>
              <td>Subtotal (lights)</td>
              <td>${(primary.priceUsd * quantityRecommended).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: '1.5rem' }}>
          <a
            className="btn"
            href={`${primary.cartUrl}&qty=${quantityRecommended}`}
          >
            Add {quantityRecommended} × {primary.name} to cart
          </a>
        </p>
      </div>

      {addOns.length > 0 && (
        <>
          <h3>Recommended add-ons</h3>
          {addOns.map((addon) => (
            <div className="card" key={addon.sku} style={{ marginBottom: '1rem' }}>
              <p className="muted" style={{ marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                Add-on · {addon.sku}
              </p>
              <strong>{addon.name}</strong>
              <p>{addon.tagline}</p>
              <ul>
                {addon.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p>
                <a className="btn secondary" href={addon.cartUrl}>
                  Add ${addon.priceUsd.toFixed(2)} add-on to cart
                </a>
              </p>
            </div>
          ))}
        </>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <strong>Estimated bundle total: ${totalEstimatedUsd.toFixed(2)}</strong>
        <p className="muted" style={{ marginTop: '0.25rem' }}>
          Includes {quantityRecommended} strand{quantityRecommended > 1 ? 's' : ''} + add-on.
          Final price confirmed at checkout.
        </p>
      </div>

      <p>
        <button className="btn secondary" onClick={onRestart}>
          Start over
        </button>
      </p>
    </>
  );
}

export default function SelectorPage() {
  const [step, setStep] = useState<Step>('footprint');
  const [footprint, setFootprint] = useState<HomeFootprint | null>(null);
  const [location, setLocation] = useState<InstallLocation | null>(null);
  const [failureMode, setFailureMode] = useState<FailureMode | null>(null);
  const [result, setResult] = useState<SelectorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);
  const totalQuestionSteps = STEPS.length;

  function handleNext() {
    setError(null);
    if (step === 'footprint') {
      if (!footprint) { setError('Please select a home size.'); return; }
      setStep('location');
    } else if (step === 'location') {
      if (!location) { setError('Please select an install location.'); return; }
      setStep('failure');
    } else if (step === 'failure') {
      if (!failureMode) { setError('Please select a failure mode.'); return; }
      const inputs: SelectorInputs = {
        homeFootprint: footprint!,
        installLocation: location!,
        priorFailureMode: failureMode,
      };
      try {
        const rec = getRecommendation(inputs);
        setResult(rec);
        setStep('result');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not generate recommendation.');
      }
    }
  }

  function handleBack() {
    setError(null);
    if (step === 'location') setStep('footprint');
    else if (step === 'failure') setStep('location');
  }

  function handleRestart() {
    setStep('footprint');
    setFootprint(null);
    setLocation(null);
    setFailureMode(null);
    setResult(null);
    setError(null);
  }

  const currentMeta = STEPS[currentStepIndex];

  return (
    <main>
      <h1>Find Your Perfect Holiday Lights</h1>
      <p>
        Answer three quick questions and we&apos;ll recommend the exact Brightworks product
        engineered for your home, your install, and the failure you experienced last season.
      </p>

      {step !== 'result' && (
        <ProgressBar current={currentStepIndex + 1} total={totalQuestionSteps} />
      )}

      {step === 'result' && result ? (
        <ResultView result={result} onRestart={handleRestart} />
      ) : (
        currentMeta && (
          <>
            <h2>{currentMeta.title}</h2>
            <p className="muted">{currentMeta.subtitle}</p>

            {step === 'footprint' && (
              <FootprintStep value={footprint} onChange={setFootprint} />
            )}
            {step === 'location' && (
              <LocationStep value={location} onChange={setLocation} />
            )}
            {step === 'failure' && (
              <FailureModeStep value={failureMode} onChange={setFailureMode} />
            )}

            {error && (
              <p style={{ color: 'var(--color-error, #dc2626)' }} role="alert">
                {error}
              </p>
            )}

            <p style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              {currentStepIndex > 0 && (
                <button className="btn secondary" onClick={handleBack}>
                  Back
                </button>
              )}
              <button className="btn" onClick={handleNext}>
                {step === 'failure' ? 'See my recommendation' : 'Next'}
              </button>
            </p>

            <p className="muted" style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
              Step {currentStepIndex + 1} of {totalQuestionSteps}
            </p>
          </>
        )
      )}
    </main>
  );
}
