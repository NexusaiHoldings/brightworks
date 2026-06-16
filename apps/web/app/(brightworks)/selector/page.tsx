"use client";

import { useState, type JSX } from "react";
import {
  type HomeFootprint,
  type InstallLocation,
  type FailureMode,
  getRecommendation,
  getFootprintLabel,
  getLocationLabel,
  getFailureModeLabel,
} from "@/lib/brightworks/selector-logic";

type Step = "footprint" | "location" | "failure" | "result";

export default function SelectorPage(): JSX.Element {
  const [step, setStep] = useState<Step>("footprint");
  const [footprint, setFootprint] = useState<HomeFootprint | null>(null);
  const [location, setLocation] = useState<InstallLocation | null>(null);
  const [failureMode, setFailureMode] = useState<FailureMode | null>(null);

  const handleFootprint = (value: HomeFootprint): void => {
    setFootprint(value);
    setStep("location");
  };

  const handleLocation = (value: InstallLocation): void => {
    setLocation(value);
    setStep("failure");
  };

  const handleFailure = (value: FailureMode): void => {
    setFailureMode(value);
    setStep("result");
  };

  const handleReset = (): void => {
    setStep("footprint");
    setFootprint(null);
    setLocation(null);
    setFailureMode(null);
  };

  const recommendation =
    step === "result" && footprint && location && failureMode
      ? getRecommendation({ footprint, location, failureMode })
      : null;

  return (
    <main>
      <h1>Find Your Perfect Holiday Lighting Fix</h1>
      <p>
        Answer three quick questions and we&apos;ll match you to the right
        replacement part or bundle.
      </p>

      {step !== "result" && <StepIndicator current={step} />}

      {step === "footprint" && (
        <section>
          <h2>What is your home&apos;s footprint?</h2>
          <p className="muted">
            Helps us size the right timer or connector count for your display.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
            {(["small", "medium", "large"] as HomeFootprint[]).map((v) => (
              <button key={v} onClick={() => handleFootprint(v)}>
                {getFootprintLabel(v)}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "location" && (
        <section>
          <h2>Where do you primarily install lights?</h2>
          <p className="muted">
            Installation surface affects which connector grade you need.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
            {(["roofline", "shrub", "tree"] as InstallLocation[]).map((v) => (
              <button key={v} onClick={() => handleLocation(v)}>
                {getLocationLabel(v)}
              </button>
            ))}
          </div>
          <button
            className="btn secondary"
            style={{ marginTop: "1.5rem" }}
            onClick={() => setStep("footprint")}
          >
            ← Back
          </button>
        </section>
      )}

      {step === "failure" && (
        <section>
          <h2>What failed last season?</h2>
          <p className="muted">
            Pinpoints whether you need a timer replacement or a connector kit.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
            {(["timer", "connector"] as FailureMode[]).map((v) => (
              <button key={v} onClick={() => handleFailure(v)}>
                {getFailureModeLabel(v)}
              </button>
            ))}
          </div>
          <button
            className="btn secondary"
            style={{ marginTop: "1.5rem" }}
            onClick={() => setStep("location")}
          >
            ← Back
          </button>
        </section>
      )}

      {step === "result" && recommendation && footprint && location && failureMode && (
        <section>
          <div className="card">
            {recommendation.isBestValue && (
              <p className="muted" style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem" }}>
                ★ Best Value
              </p>
            )}
            <h2>{recommendation.name}</h2>
            <p className="muted">{recommendation.tagline}</p>
            <p>{recommendation.description}</p>
            <ul>
              {recommendation.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
            <p style={{ fontSize: "1.75rem", fontWeight: 700, margin: "1rem 0 1.25rem" }}>
              {recommendation.price}
            </p>
            <a href={recommendation.cartUrl} className="btn">
              Add to Cart — {recommendation.sku}
            </a>
          </div>

          <div className="card" style={{ marginTop: "1.5rem" }}>
            <h3>Your Selections</h3>
            <ul>
              <li>
                <strong>Home size:</strong> {getFootprintLabel(footprint)}
              </li>
              <li>
                <strong>Install location:</strong> {getLocationLabel(location)}
              </li>
              <li>
                <strong>Previous failure:</strong>{" "}
                {getFailureModeLabel(failureMode)}
              </li>
            </ul>
          </div>

          <button
            className="btn secondary"
            style={{ marginTop: "1.5rem" }}
            onClick={handleReset}
          >
            Start Over
          </button>
        </section>
      )}
    </main>
  );
}

function StepIndicator({ current }: { current: Step }): JSX.Element {
  const steps: { key: Step; label: string }[] = [
    { key: "footprint", label: "Home Size" },
    { key: "location", label: "Install Spot" },
    { key: "failure", label: "Failure Mode" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === current);

  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        margin: "0.75rem 0 1.5rem",
        fontSize: "0.85rem",
      }}
    >
      {steps.map((s, i) => (
        <span
          key={s.key}
          className={i === activeIndex ? undefined : "muted"}
          style={{ fontWeight: i === activeIndex ? 600 : 400 }}
        >
          {i + 1}. {s.label}
          {i < steps.length - 1 ? " →" : ""}
        </span>
      ))}
    </div>
  );
}
