"use client";

import { useState } from "react";
import {
  type FailureMode,
  type HomeFootprint,
  type InstallLocation,
  type SelectorInputs,
  FAILURE_OPTIONS,
  FOOTPRINT_OPTIONS,
  LOCATION_OPTIONS,
  formatPrice,
  getRecommendation,
  isBundle,
} from "@/lib/brightworks/selector-logic";

type Step = "location" | "footprint" | "failure" | "result";

const STEPS: Step[] = ["location", "footprint", "failure", "result"];

function ProgressBar({ current }: { current: number }) {
  const total = STEPS.length - 1;
  const pct = Math.round((current / total) * 100);
  return (
    <div
      style={{
        background: "var(--color-border, #e5e7eb)",
        borderRadius: "9999px",
        height: "6px",
        marginBottom: "2rem",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "var(--color-primary, #2563eb)",
          height: "100%",
          width: `${pct}%`,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function OptionCard<T extends string>({
  value,
  label,
  hint,
  selected,
  onSelect,
}: {
  value: T;
  label: string;
  hint: string;
  selected: boolean;
  onSelect: (v: T) => void;
}) {
  return (
    <div
      className="card"
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={() => onSelect(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(value);
        }
      }}
      style={{
        cursor: "pointer",
        outline: selected ? "2px solid var(--color-primary, #2563eb)" : "none",
        userSelect: "none",
      }}
    >
      <strong>{label}</strong>
      <p className="muted" style={{ margin: "0.25rem 0 0" }}>
        {hint}
      </p>
    </div>
  );
}

export default function SelectorPage() {
  const [step, setStep] = useState<Step>("location");
  const [installLocation, setInstallLocation] = useState<InstallLocation | null>(null);
  const [homeFootprint, setHomeFootprint] = useState<HomeFootprint | null>(null);
  const [failureMode, setFailureMode] = useState<FailureMode | null>(null);

  const stepIndex = STEPS.indexOf(step);

  function handleNext() {
    if (step === "location" && installLocation) setStep("footprint");
    else if (step === "footprint" && homeFootprint) setStep("failure");
    else if (step === "failure" && failureMode) setStep("result");
  }

  function handleBack() {
    if (step === "footprint") setStep("location");
    else if (step === "failure") setStep("footprint");
    else if (step === "result") setStep("failure");
  }

  function handleRestart() {
    setInstallLocation(null);
    setHomeFootprint(null);
    setFailureMode(null);
    setStep("location");
  }

  const canAdvance =
    (step === "location" && installLocation !== null) ||
    (step === "footprint" && homeFootprint !== null) ||
    (step === "failure" && failureMode !== null);

  let recommendation = null;
  if (step === "result" && installLocation && homeFootprint && failureMode) {
    try {
      recommendation = getRecommendation({
        installLocation,
        homeFootprint,
        failureMode,
      } satisfies SelectorInputs);
    } catch {
      recommendation = null;
    }
  }

  return (
    <main>
      <h1>Find Your Replacement Lights</h1>
      <p>
        Answer three quick questions and we&apos;ll match you to the right product for your home
        and your specific failure mode.
      </p>

      <ProgressBar current={stepIndex} />

      {step === "location" && (
        <section aria-label="Step 1: Install location">
          <h2>Where are your lights installed?</h2>
          <div
            role="radiogroup"
            aria-label="Install location"
            style={{ display: "grid", gap: "1rem", marginBottom: "1.5rem" }}
          >
            {LOCATION_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                value={opt.value}
                label={opt.label}
                hint={opt.hint}
                selected={installLocation === opt.value}
                onSelect={setInstallLocation}
              />
            ))}
          </div>
          <button onClick={handleNext} disabled={!canAdvance}>
            Next &rarr;
          </button>
        </section>
      )}

      {step === "footprint" && (
        <section aria-label="Step 2: Home footprint">
          <h2>What is your home&apos;s size?</h2>
          <div
            role="radiogroup"
            aria-label="Home footprint"
            style={{ display: "grid", gap: "1rem", marginBottom: "1.5rem" }}
          >
            {FOOTPRINT_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                value={opt.value}
                label={opt.label}
                hint={opt.hint}
                selected={homeFootprint === opt.value}
                onSelect={setHomeFootprint}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn secondary" onClick={handleBack}>
              &larr; Back
            </button>
            <button onClick={handleNext} disabled={!canAdvance}>
              Next &rarr;
            </button>
          </div>
        </section>
      )}

      {step === "failure" && (
        <section aria-label="Step 3: Prior failure mode">
          <h2>What failed last season?</h2>
          <div
            role="radiogroup"
            aria-label="Failure mode"
            style={{ display: "grid", gap: "1rem", marginBottom: "1.5rem" }}
          >
            {FAILURE_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                value={opt.value}
                label={opt.label}
                hint={opt.hint}
                selected={failureMode === opt.value}
                onSelect={setFailureMode}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn secondary" onClick={handleBack}>
              &larr; Back
            </button>
            <button onClick={handleNext} disabled={!canAdvance}>
              See My Recommendation &rarr;
            </button>
          </div>
        </section>
      )}

      {step === "result" && (
        <section aria-label="Recommendation">
          <h2>Your Recommended Product</h2>
          {recommendation ? (
            <div className="card">
              {recommendation.badge && (
                <span
                  style={{
                    display: "inline-block",
                    background: "var(--color-primary, #2563eb)",
                    color: "#fff",
                    borderRadius: "9999px",
                    padding: "0.2rem 0.75rem",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.75rem",
                  }}
                >
                  {recommendation.badge}
                </span>
              )}
              <h3 style={{ margin: "0 0 0.5rem" }}>{recommendation.name}</h3>
              <p>{recommendation.description}</p>
              {isBundle(recommendation) && recommendation.includes.length > 0 && (
                <>
                  <p className="muted">
                    <strong>Bundle includes:</strong>
                  </p>
                  <ul>
                    {recommendation.includes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
              <p>
                <strong style={{ fontSize: "1.4rem" }}>{formatPrice(recommendation.price)}</strong>
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
                <a
                  href={recommendation.addToCartUrl}
                  className="btn"
                  style={{ textDecoration: "none" }}
                >
                  Add to Cart
                </a>
                <button className="btn secondary" onClick={handleBack}>
                  &larr; Change Answers
                </button>
              </div>
            </div>
          ) : (
            <div className="empty">
              <p>We couldn&apos;t find a match for your selections. Please try again.</p>
              <button onClick={handleRestart}>Start Over</button>
            </div>
          )}
          <p style={{ marginTop: "1.5rem" }}>
            <button className="btn secondary" onClick={handleRestart}>
              Start Over
            </button>
          </p>
        </section>
      )}

      <hr style={{ margin: "2.5rem 0 1.5rem", borderColor: "var(--color-border, #e5e7eb)" }} />
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Not sure? Browse our full{" "}
        <a href="/products">product catalog</a> or{" "}
        <a href="/support">contact support</a> for personalized help.
      </p>
    </main>
  );
}
