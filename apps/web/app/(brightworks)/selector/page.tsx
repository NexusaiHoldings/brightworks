"use client";

import { useState, type FormEvent, type JSX } from "react";
import {
  getSelectorRecommendation,
  INSTALL_LOCATION_OPTIONS,
  FAILURE_MODE_OPTIONS,
  type InstallLocation,
  type FailureMode,
  type SelectorRecommendation,
} from "@/lib/brightworks/selector-logic";

export default function SelectorPage(): JSX.Element {
  const [footprint, setFootprint] = useState<string>("");
  const [location, setLocation] = useState<InstallLocation | "">("");
  const [failureMode, setFailureMode] = useState<FailureMode | "">("");
  const [recommendation, setRecommendation] =
    useState<SelectorRecommendation | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setValidationError(null);

    const parsed = parseFloat(footprint);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setValidationError(
        "Enter a valid home footprint in square feet (e.g. 800).",
      );
      return;
    }
    if (!location) {
      setValidationError("Select where you plan to install the lighting.");
      return;
    }
    if (!failureMode) {
      setValidationError("Select what caused your previous system to fail.");
      return;
    }

    setRecommendation(
      getSelectorRecommendation({
        footprintSqFt: parsed,
        installLocation: location,
        failureMode,
      }),
    );
  }

  function handleStartOver(): void {
    setFootprint("");
    setLocation("");
    setFailureMode("");
    setRecommendation(null);
    setValidationError(null);
  }

  if (recommendation) {
    return (
      <RecommendationView rec={recommendation} onStartOver={handleStartOver} />
    );
  }

  return (
    <main>
      <h1>Find Your Brightworks Kit</h1>
      <p>
        Answer three questions and we&rsquo;ll match you to the right lighting
        kit for your home — no guesswork, no overbuying.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2>Step 1 — Home Footprint</h2>
          <p className="muted">
            Approximate square footage of your home&rsquo;s exterior area to be
            lit.
          </p>
          <label htmlFor="footprint">Square footage</label>
          <input
            id="footprint"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 1200"
            value={footprint}
            onChange={(e) => setFootprint(e.target.value)}
            required
          />
        </div>

        <div className="card">
          <h2>Step 2 — Install Location</h2>
          <p className="muted">Where will the lights be installed?</p>
          <label htmlFor="location">Location type</label>
          <select
            id="location"
            value={location}
            onChange={(e) =>
              setLocation(e.target.value as InstallLocation | "")
            }
            required
          >
            <option value="">— Select a location —</option>
            {INSTALL_LOCATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} — {opt.helper}
              </option>
            ))}
          </select>
        </div>

        <div className="card">
          <h2>Step 3 — Prior Failure Mode</h2>
          <p className="muted">
            What caused your previous outdoor lighting system to fail?
          </p>
          <label htmlFor="failureMode">Failure type</label>
          <select
            id="failureMode"
            value={failureMode}
            onChange={(e) =>
              setFailureMode(e.target.value as FailureMode | "")
            }
            required
          >
            <option value="">— Select a failure mode —</option>
            {FAILURE_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} — {opt.helper}
              </option>
            ))}
          </select>
        </div>

        {validationError && (
          <p role="alert" style={{ color: "var(--color-destructive, #dc2626)" }}>
            {validationError}
          </p>
        )}

        <button type="submit">Find My Kit →</button>
      </form>
    </main>
  );
}

interface RecommendationViewProps {
  readonly rec: SelectorRecommendation;
  readonly onStartOver: () => void;
}

function RecommendationView({
  rec,
  onStartOver,
}: RecommendationViewProps): JSX.Element {
  const cartUrl = `/checkout?sku=${encodeURIComponent(rec.sku)}`;

  return (
    <main>
      <h1>Your Brightworks Recommendation</h1>
      <p>
        Based on your answers, here&rsquo;s the kit engineered for your home
        and failure history.
      </p>

      <div className="card">
        <h2>{rec.title}</h2>
        <p>{rec.description}</p>
        <p className="muted">
          Coverage: up to {rec.coverageSqFt.toLocaleString()} sq&nbsp;ft
          &nbsp;·&nbsp; SKU: <strong>{rec.sku}</strong>
        </p>

        <h3>What&rsquo;s included</h3>
        <ul>
          {rec.bundleItems.map((item) => (
            <li key={item.sku}>
              <strong>{item.name}</strong>{" "}
              <span className="muted">({item.sku})</span>
              <br />
              {item.description}
            </li>
          ))}
        </ul>

        <h3>Why this kit?</h3>
        <p className="muted">{rec.rationale}</p>

        <div
          style={{
            marginTop: "1.5rem",
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <a href={cartUrl} className="btn">
            Add to Cart
          </a>
          <button
            type="button"
            className="btn secondary"
            onClick={onStartOver}
          >
            Start Over
          </button>
        </div>
      </div>
    </main>
  );
}
