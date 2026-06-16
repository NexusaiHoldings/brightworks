"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  getSelectorRecommendation,
  type InstallationLocation,
  type RecommendationInput,
  type RecommendationResult,
  type ReportedFailureMode,
  type RooflineFootprint,
} from "@/lib/brightworks/selector-logic";

type FormState = RecommendationInput;

const defaultState: FormState = {
  footprint: "standard",
  installLocation: "roofline",
  failureMode: "none",
};

export default function SelectorPage(): JSX.Element {
  const [formState, setFormState] = useState<FormState>(defaultState);
  const [result, setResult] = useState<RecommendationResult | null>(null);

  const cartHref = useMemo(() => {
    if (!result) {
      return "#";
    }
    const params = new URLSearchParams({
      sku: result.sku,
      source: "selector",
    });
    return `/direct/cart?${params.toString()}`;
  }, [result]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const recommendation = getSelectorRecommendation(formState);
    setResult(recommendation);
  };

  return (
    <main>
      <h1>Find the Right BrightWorks Lighting Kit</h1>
      <p>
        Answer three quick questions about your install so we can match you
        with the ideal lighting kit and accessories for a fast, frustration-free
        refresh.
      </p>

      <form onSubmit={handleSubmit} className="card">
        <h2>Installation Details</h2>
        <label htmlFor="footprint">Roofline footprint</label>
        <select
          id="footprint"
          name="footprint"
          value={formState.footprint}
          onChange={(event) =>
            setFormState((prev) => ({
              ...prev,
              footprint: event.target.value as RooflineFootprint,
            }))
          }
          required
        >
          <option value="compact">Under 75 ft — compact bungalow</option>
          <option value="standard">75-150 ft — standard single family</option>
          <option value="expansive">Over 150 ft — large or wraparound</option>
        </select>

        <label htmlFor="installLocation">Primary install location</label>
        <select
          id="installLocation"
          name="installLocation"
          value={formState.installLocation}
          onChange={(event) =>
            setFormState((prev) => ({
              ...prev,
              installLocation: event.target.value as InstallationLocation,
            }))
          }
          required
        >
          <option value="roofline">Roofline / eaves</option>
          <option value="shrub">Shrubs or hedges</option>
          <option value="tree">Tree canopies or trunks</option>
        </select>

        <label htmlFor="failureMode">What failed last season?</label>
        <select
          id="failureMode"
          name="failureMode"
          value={formState.failureMode}
          onChange={(event) =>
            setFormState((prev) => ({
              ...prev,
              failureMode: event.target.value as ReportedFailureMode,
            }))
          }
          required
        >
          <option value="none">Nothing failed — preventative refresh</option>
          <option value="timer">Timer stopped working or drifted</option>
          <option value="connector">Connectors burnt out or corroded</option>
        </select>

        <button type="submit">Show my recommended kit</button>
      </form>

      {result ? (
        <section className="card" aria-live="polite">
          <h2>Recommended Kit</h2>
          <h3>{result.name}</h3>
          <p>{result.summary}</p>
          <p className="muted">{result.rationale}</p>

          {result.bundle.length > 0 ? (
            <>
              <h4>Included add-ons</h4>
              <ul>
                {result.bundle.map((item) => (
                  <li key={item.sku}>
                    <strong>{item.name}</strong> — {item.description} (SKU:{" "}
                    {item.sku})
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <a className="btn" href={cartHref}>
            Add {result.sku} to cart
          </a>
        </section>
      ) : (
        <section className="empty">
          <p>Complete the questionnaire to see the kit we recommend.</p>
        </section>
      )}
    </main>
  );
}
