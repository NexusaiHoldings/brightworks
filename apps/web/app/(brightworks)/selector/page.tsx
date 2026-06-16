"use client";

import { useState, type JSX } from "react";
import {
  getRecommendation,
  type FailureMode,
  type HomeFootprint,
  type InstallLocation,
  type SelectorInputs,
  type SelectorRecommendation,
} from "@/lib/brightworks/selector-logic";

type Step = 0 | 1 | 2 | 3;

interface Answers {
  homeFootprint: HomeFootprint | null;
  installLocation: InstallLocation | null;
  failureMode: FailureMode | null;
}

function ProgressBar({ step }: { step: Step }): JSX.Element {
  const totalSteps = 3;
  const filledSteps = Math.min(step, totalSteps);
  return (
    <div
      aria-label={`Step ${filledSteps} of ${totalSteps}`}
      style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}
    >
      {Array.from({ length: totalSteps }).map((_, idx) => (
        <div
          key={idx}
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: idx < filledSteps ? "var(--color-primary, #2563eb)" : "rgba(0,0,0,0.12)",
          }}
        />
      ))}
    </div>
  );
}

function StepFootprint({
  onSelect,
}: {
  onSelect: (value: HomeFootprint) => void;
}): JSX.Element {
  return (
    <>
      <h2>What size is your home?</h2>
      <p className="muted">
        This helps us match the right quantity of lights and power capacity for your property.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
        <button type="button" onClick={() => onSelect("small")}>
          Small — up to 1,500 sq ft
        </button>
        <button type="button" className="secondary" onClick={() => onSelect("medium")}>
          Medium — 1,500–3,000 sq ft
        </button>
        <button type="button" className="secondary" onClick={() => onSelect("large")}>
          Large — over 3,000 sq ft
        </button>
      </div>
    </>
  );
}

function StepLocation({
  onSelect,
  onBack,
}: {
  onSelect: (value: InstallLocation) => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <>
      <h2>Where are you installing the lights?</h2>
      <p className="muted">
        Different surfaces need different mounting systems, wire gauges, and light types.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
        <button type="button" onClick={() => onSelect("roofline")}>
          Roofline — gutters, eaves, or peaks
        </button>
        <button type="button" className="secondary" onClick={() => onSelect("shrub")}>
          Shrubs — foundation plantings or hedges
        </button>
        <button type="button" className="secondary" onClick={() => onSelect("tree")}>
          Trees — ornamental or mature shade trees
        </button>
      </div>
      <button
        type="button"
        className="secondary"
        onClick={onBack}
        style={{ marginTop: "1.25rem", width: "auto" }}
      >
        ← Back
      </button>
    </>
  );
}

function StepFailureMode({
  onSelect,
  onBack,
}: {
  onSelect: (value: FailureMode) => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <>
      <h2>What failed on your previous setup?</h2>
      <p className="muted">
        Knowing your failure mode lets us include the right upgrade so the same problem
        doesn't repeat.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
        <button type="button" onClick={() => onSelect("timer")}>
          Timer failure — lights wouldn't turn on/off on schedule
        </button>
        <button type="button" className="secondary" onClick={() => onSelect("connector")}>
          Connector burnout — melted or corroded plugs and sockets
        </button>
      </div>
      <button
        type="button"
        className="secondary"
        onClick={onBack}
        style={{ marginTop: "1.25rem", width: "auto" }}
      >
        ← Back
      </button>
    </>
  );
}

function StepResult({
  recommendation,
  onRestart,
}: {
  recommendation: SelectorRecommendation;
  onRestart: () => void;
}): JSX.Element {
  const { primary, addOns, reasoning } = recommendation;
  const bundleTotal = primary.price + addOns.reduce((sum, p) => sum + p.price, 0);
  const bundleParams = [primary.sku, ...addOns.map((p) => p.sku)]
    .map((s) => `sku=${encodeURIComponent(s)}`)
    .join("&");

  return (
    <>
      <h2>Your Recommendation</h2>
      <p className="muted">{reasoning}</p>

      <div className="card" style={{ marginTop: "1.25rem" }}>
        <p className="muted" style={{ fontSize: "0.75rem", marginBottom: "0.25rem" }}>
          SKU: {primary.sku}
        </p>
        <h3 style={{ margin: "0 0 0.5rem" }}>{primary.name}</h3>
        <p style={{ margin: "0 0 0.75rem" }}>{primary.description}</p>
        <p style={{ fontWeight: 600, fontSize: "1.1rem", margin: "0 0 1rem" }}>
          ${primary.price.toFixed(2)}
        </p>
        <a href={primary.cartUrl} className="btn">
          Add to Cart
        </a>
      </div>

      {addOns.map((addOn) => (
        <div className="card" key={addOn.sku} style={{ marginTop: "1rem" }}>
          <p className="muted" style={{ fontSize: "0.75rem", marginBottom: "0.25rem" }}>
            Recommended Add-on · SKU: {addOn.sku}
          </p>
          <h3 style={{ margin: "0 0 0.5rem" }}>{addOn.name}</h3>
          <p style={{ margin: "0 0 0.75rem" }}>{addOn.description}</p>
          <p style={{ fontWeight: 600, fontSize: "1.1rem", margin: "0 0 1rem" }}>
            ${addOn.price.toFixed(2)}
          </p>
          <a href={addOn.cartUrl} className="btn secondary">
            Add to Cart
          </a>
        </div>
      ))}

      <div
        className="card"
        style={{ marginTop: "1rem", background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.2)" }}
      >
        <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>
          Bundle Everything &amp; Save
        </p>
        <p className="muted" style={{ margin: "0 0 0.75rem" }}>
          {primary.name} + {addOns.map((p) => p.name).join(" + ")}
        </p>
        <p style={{ fontWeight: 700, fontSize: "1.2rem", margin: "0 0 1rem" }}>
          ${bundleTotal.toFixed(2)}
        </p>
        <a href={`/cart?${bundleParams}`} className="btn">
          Add Bundle to Cart
        </a>
      </div>

      <button
        type="button"
        className="secondary"
        onClick={onRestart}
        style={{ marginTop: "1.5rem", width: "auto" }}
      >
        Start Over
      </button>
    </>
  );
}

export default function SelectorPage(): JSX.Element {
  const [step, setStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<Answers>({
    homeFootprint: null,
    installLocation: null,
    failureMode: null,
  });
  const [recommendation, setRecommendation] = useState<SelectorRecommendation | null>(null);

  const handleFootprint = (value: HomeFootprint): void => {
    setAnswers((prev) => ({ ...prev, homeFootprint: value }));
    setStep(1);
  };

  const handleLocation = (value: InstallLocation): void => {
    setAnswers((prev) => ({ ...prev, installLocation: value }));
    setStep(2);
  };

  const handleFailureMode = (value: FailureMode): void => {
    const updated: Answers = { ...answers, failureMode: value };
    setAnswers(updated);
    if (updated.homeFootprint && updated.installLocation) {
      const inputs: SelectorInputs = {
        homeFootprint: updated.homeFootprint,
        installLocation: updated.installLocation,
        failureMode: value,
      };
      setRecommendation(getRecommendation(inputs));
    }
    setStep(3);
  };

  const handleRestart = (): void => {
    setAnswers({ homeFootprint: null, installLocation: null, failureMode: null });
    setRecommendation(null);
    setStep(0);
  };

  return (
    <main>
      <h1>Find the Right Holiday Lights</h1>
      <p>
        Answer three quick questions and we'll match you to the exact kit and accessories
        that fit your home — and fix the failure mode that let you down last season.
      </p>

      {step < 3 && <ProgressBar step={step} />}

      {step === 0 && <StepFootprint onSelect={handleFootprint} />}

      {step === 1 && (
        <StepLocation
          onSelect={handleLocation}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <StepFailureMode
          onSelect={handleFailureMode}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && recommendation && (
        <StepResult recommendation={recommendation} onRestart={handleRestart} />
      )}
    </main>
  );
}
