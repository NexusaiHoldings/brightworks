"use client";

import { useState, type JSX } from "react";
import {
  getRecommendation,
  formatPrice,
  type FailureMode,
  type HomeFootprint,
  type InstallLocation,
  type SelectorInputs,
  type SelectorRecommendation,
} from "@/lib/brightworks/selector-logic";

type Step = "footprint" | "location" | "failure" | "result";

interface StepState {
  homeFootprint: HomeFootprint | null;
  installLocation: InstallLocation | null;
  failureMode: FailureMode | null;
}

function ProgressBar({ current, total }: { current: number; total: number }): JSX.Element {
  const pct = Math.round((current / total) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Step ${current} of ${total}`}
      style={{
        height: 6,
        background: "rgba(0,0,0,0.08)",
        borderRadius: 3,
        marginBottom: "1.5rem",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "var(--accent, #16a34a)",
          borderRadius: 3,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function OptionCard({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "1rem 1.25rem",
        marginBottom: "0.75rem",
        borderRadius: 8,
        border: selected ? "2px solid var(--accent, #16a34a)" : "2px solid rgba(0,0,0,0.12)",
        background: selected ? "rgba(22,163,74,0.06)" : "#fff",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
      aria-pressed={selected}
    >
      <strong style={{ display: "block", marginBottom: 2 }}>{label}</strong>
      <span className="muted" style={{ fontSize: "0.875rem" }}>
        {description}
      </span>
    </button>
  );
}

function FootprintStep({
  value,
  onChange,
  onNext,
}: {
  value: HomeFootprint | null;
  onChange: (v: HomeFootprint) => void;
  onNext: () => void;
}): JSX.Element {
  return (
    <>
      <h2>What is your home&apos;s approximate size?</h2>
      <p className="muted">We&apos;ll match you to the right strand length and coverage.</p>
      <OptionCard
        label="Small — under 1,200 sq ft"
        description="Townhome, condo, or cottage with a compact roofline or a few shrubs."
        selected={value === "small"}
        onClick={() => onChange("small")}
      />
      <OptionCard
        label="Medium — 1,200–2,400 sq ft"
        description="Typical single-family home with standard yard."
        selected={value === "medium"}
        onClick={() => onChange("medium")}
      />
      <OptionCard
        label="Large — over 2,400 sq ft"
        description="Large home, estate lot, or property with extensive landscaping."
        selected={value === "large"}
        onClick={() => onChange("large")}
      />
      <button
        type="button"
        className="btn"
        disabled={value === null}
        onClick={onNext}
        style={{ marginTop: "0.5rem" }}
      >
        Next →
      </button>
    </>
  );
}

function LocationStep({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: InstallLocation | null;
  onChange: (v: InstallLocation) => void;
  onNext: () => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <>
      <h2>Where are you installing the lights?</h2>
      <p className="muted">Select your primary install surface.</p>
      <OptionCard
        label="Roofline"
        description="C9 or C7 strands along gutters, fascia, or ridge line."
        selected={value === "roofline"}
        onClick={() => onChange("roofline")}
      />
      <OptionCard
        label="Shrubs &amp; Bushes"
        description="Wrap nets or icicle strands draped over foundation plantings."
        selected={value === "shrub"}
        onClick={() => onChange("shrub")}
      />
      <OptionCard
        label="Trees"
        description="Micro-lights or C6 strands wrapped around trunk and branches."
        selected={value === "tree"}
        onClick={() => onChange("tree")}
      />
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button type="button" className="btn secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="btn"
          disabled={value === null}
          onClick={onNext}
        >
          Next →
        </button>
      </div>
    </>
  );
}

function FailureStep({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: FailureMode | null;
  onChange: (v: FailureMode) => void;
  onNext: () => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <>
      <h2>What went wrong with your last set of lights?</h2>
      <p className="muted">
        This helps us point you to the kit that fixes the exact failure point.
      </p>
      <OptionCard
        label="Timer stopped working"
        description="The built-in or plug-in timer failed — lights stayed on or never turned on."
        selected={value === "timer"}
        onClick={() => onChange("timer")}
      />
      <OptionCard
        label="Connector burned out"
        description="A plug or junction melted, sparked, or caused a tripped breaker."
        selected={value === "connector"}
        onClick={() => onChange("connector")}
      />
      <OptionCard
        label="No prior failure — first install"
        description="I&apos;m setting up lights for the first time or upgrading by choice."
        selected={value === "none"}
        onClick={() => onChange("none")}
      />
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button type="button" className="btn secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="btn"
          disabled={value === null}
          onClick={onNext}
        >
          See my recommendation →
        </button>
      </div>
    </>
  );
}

function ResultStep({
  recommendation,
  onRestart,
}: {
  recommendation: SelectorRecommendation;
  onRestart: () => void;
}): JSX.Element {
  const { primary, addOns, rationale } = recommendation;
  const bundleTotal =
    primary.price + addOns.reduce((sum, item) => sum + item.price, 0);

  return (
    <>
      <h2>Your Recommended Kit</h2>
      <p className="muted">{rationale}</p>

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div>
            <strong style={{ fontSize: "1.1rem" }}>{primary.name}</strong>
            <p className="muted" style={{ margin: "0.35rem 0 0.75rem" }}>
              {primary.description}
            </p>
            <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>
              {formatPrice(primary.price)}
            </span>
          </div>
          <a
            href={primary.cartUrl}
            className="btn"
            style={{ whiteSpace: "nowrap", alignSelf: "flex-end" }}
          >
            Add to Cart
          </a>
        </div>
        <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.75rem", marginBottom: 0 }}>
          SKU: {primary.sku}
        </p>
      </div>

      {addOns.length > 0 && (
        <>
          <h3 style={{ marginTop: "1.5rem" }}>Recommended Add-ons</h3>
          <p className="muted">Pair these with your kit to address your specific failure point.</p>
          {addOns.map((item) => (
            <div
              key={item.sku}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{item.name}</strong>
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                  {item.description}
                </p>
                <span style={{ fontWeight: 600 }}>{formatPrice(item.price)}</span>
              </div>
              <a
                href={item.cartUrl}
                className="btn secondary"
                style={{ whiteSpace: "nowrap" }}
              >
                Add to Cart
              </a>
            </div>
          ))}

          <div
            style={{
              borderTop: "1px solid rgba(0,0,0,0.1)",
              paddingTop: "0.75rem",
              marginTop: "0.5rem",
              textAlign: "right",
            }}
          >
            <span className="muted">Bundle total: </span>
            <strong style={{ fontSize: "1.1rem" }}>{formatPrice(bundleTotal)}</strong>
          </div>
        </>
      )}

      <div style={{ marginTop: "2rem" }}>
        <button
          type="button"
          className="btn secondary"
          onClick={onRestart}
        >
          Start Over
        </button>
      </div>
    </>
  );
}

export default function SelectorPage(): JSX.Element {
  const [step, setStep] = useState<Step>("footprint");
  const [inputs, setInputs] = useState<StepState>({
    homeFootprint: null,
    installLocation: null,
    failureMode: null,
  });
  const [recommendation, setRecommendation] = useState<SelectorRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepNumber: Record<Step, number> = {
    footprint: 1,
    location: 2,
    failure: 3,
    result: 4,
  };

  function handleFootprintNext(): void {
    setStep("location");
  }

  function handleLocationNext(): void {
    setStep("failure");
  }

  function handleFailureNext(): void {
    if (!inputs.homeFootprint || !inputs.installLocation || !inputs.failureMode) {
      setError("Please complete all steps before continuing.");
      return;
    }
    try {
      const rec = getRecommendation(inputs as SelectorInputs);
      setRecommendation(rec);
      setError(null);
      setStep("result");
    } catch (err) {
      setError(`Could not generate recommendation: ${String(err)}`);
    }
  }

  function handleRestart(): void {
    setStep("footprint");
    setInputs({ homeFootprint: null, installLocation: null, failureMode: null });
    setRecommendation(null);
    setError(null);
  }

  return (
    <main>
      <h1>Find Your Perfect Brightworks Kit</h1>
      <p>
        Answer three quick questions and we&apos;ll match you to the exact SKU that fits your
        home — and fixes the failure mode you experienced.
      </p>

      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <ProgressBar current={stepNumber[step]} total={4} />

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.25)",
              borderRadius: 6,
              color: "#b91c1c",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        {step === "footprint" && (
          <FootprintStep
            value={inputs.homeFootprint}
            onChange={(v) => setInputs((prev) => ({ ...prev, homeFootprint: v }))}
            onNext={handleFootprintNext}
          />
        )}

        {step === "location" && (
          <LocationStep
            value={inputs.installLocation}
            onChange={(v) => setInputs((prev) => ({ ...prev, installLocation: v }))}
            onNext={handleLocationNext}
            onBack={() => setStep("footprint")}
          />
        )}

        {step === "failure" && (
          <FailureStep
            value={inputs.failureMode}
            onChange={(v) => setInputs((prev) => ({ ...prev, failureMode: v }))}
            onNext={handleFailureNext}
            onBack={() => setStep("location")}
          />
        )}

        {step === "result" && recommendation && (
          <ResultStep recommendation={recommendation} onRestart={handleRestart} />
        )}
      </div>
    </main>
  );
}
