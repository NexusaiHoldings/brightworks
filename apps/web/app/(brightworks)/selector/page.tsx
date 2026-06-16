"use client";

import { useState } from "react";
import type { JSX } from "react";
import {
  SELECTOR_QUESTIONS,
  getRecommendation,
  type SelectorAnswers,
  type SkuRecommendation,
  type FootprintSize,
  type InstallLocation,
  type FailureMode,
} from "@/lib/brightworks/selector-logic";

type PartialAnswers = Partial<SelectorAnswers>;

function ProgressBar({ step, total }: { step: number; total: number }): JSX.Element {
  const pct = Math.round((step / total) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={step}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Step ${step} of ${total}`}
      style={{ background: "var(--substrate-border, #e5e7eb)", borderRadius: 4, height: 6, marginBottom: 24 }}
    >
      <div
        style={{
          width: `${pct}%`,
          background: "var(--substrate-accent, #111)",
          height: "100%",
          borderRadius: 4,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function QuestionStep({
  questionIndex,
  answers,
  onAnswer,
  onBack,
}: {
  questionIndex: number;
  answers: PartialAnswers;
  onAnswer: (value: string) => void;
  onBack: () => void;
}): JSX.Element {
  const question = SELECTOR_QUESTIONS[questionIndex];
  const currentValue = answers[question.id];

  return (
    <div>
      <ProgressBar step={questionIndex + 1} total={SELECTOR_QUESTIONS.length} />
      <p className="muted" style={{ marginBottom: 4, fontSize: "0.875rem" }}>
        Question {questionIndex + 1} of {SELECTOR_QUESTIONS.length}
      </p>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>{question.prompt}</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 24 }}>
        {question.subPrompt}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {question.options.map((opt) => {
          const selected = currentValue === opt.value;
          return (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => onAnswer(opt.value)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "16px 20px",
                  border: selected
                    ? "2px solid var(--substrate-accent, #111)"
                    : "2px solid var(--substrate-border, #e5e7eb)",
                  borderRadius: "var(--substrate-radius, 8px)",
                  background: selected ? "var(--substrate-accent-muted, #f5f5f5)" : "transparent",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                aria-pressed={selected}
              >
                <strong style={{ display: "block", marginBottom: 4 }}>{opt.label}</strong>
                <span className="muted" style={{ fontSize: "0.875rem" }}>{opt.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {questionIndex > 0 && (
        <button
          type="button"
          onClick={onBack}
          className="btn secondary"
          style={{ marginTop: 24 }}
        >
          ← Back
        </button>
      )}
    </div>
  );
}

function RecommendationCard({
  rec,
  onRestart,
}: {
  rec: SkuRecommendation;
  onRestart: () => void;
}): JSX.Element {
  return (
    <div>
      <ProgressBar step={SELECTOR_QUESTIONS.length} total={SELECTOR_QUESTIONS.length} />
      <p className="muted" style={{ marginBottom: 4, fontSize: "0.875rem" }}>
        Your recommendation
      </p>
      <h2 style={{ marginTop: 0, marginBottom: 24 }}>We found the right kit for you.</h2>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div>
            {rec.badge && (
              <span
                style={{
                  display: "inline-block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  padding: "2px 10px",
                  border: "1px solid var(--substrate-accent, #111)",
                  borderRadius: 20,
                  marginBottom: 10,
                }}
              >
                {rec.badge}
              </span>
            )}
            <h3 style={{ margin: "0 0 4px" }}>{rec.name}</h3>
            <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.875rem" }}>
              SKU: <code>{rec.sku}</code>
            </p>
            <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
              {rec.coverageNote}
            </p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontSize: "1.75rem", fontWeight: 700 }}>{rec.price}</span>
          </div>
        </div>

        <p style={{ marginTop: 16, marginBottom: 0 }}>{rec.description}</p>

        <div style={{ marginTop: 20 }}>
          <a href={rec.cartUrl} className="btn" style={{ display: "inline-block", textDecoration: "none" }}>
            Add to Cart
          </a>
        </div>
      </div>

      {rec.addOns.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 12 }}>Recommended add-ons</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {rec.addOns.map((addon) => (
              <li key={addon.sku} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <strong>{addon.name}</strong>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                    SKU: <code>{addon.sku}</code>
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <span style={{ fontWeight: 600 }}>{addon.price}</span>
                  <a
                    href={`/cart?sku=${addon.sku}`}
                    className="btn secondary"
                    style={{ textDecoration: "none", fontSize: "0.875rem", padding: "6px 14px" }}
                  >
                    Add
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <button type="button" onClick={onRestart} className="btn secondary">
          Start over
        </button>
      </div>
    </div>
  );
}

export default function SelectorPage(): JSX.Element {
  const [step, setStep] = useState<number>(0);
  const [answers, setAnswers] = useState<PartialAnswers>({});

  const totalQuestions = SELECTOR_QUESTIONS.length;
  const isComplete = step >= totalQuestions;

  function handleAnswer(value: string): void {
    const question = SELECTOR_QUESTIONS[step];
    const updated: PartialAnswers = { ...answers, [question.id]: value };
    setAnswers(updated);
    setStep((s) => s + 1);
  }

  function handleBack(): void {
    setStep((s) => Math.max(0, s - 1));
  }

  function handleRestart(): void {
    setAnswers({});
    setStep(0);
  }

  let content: JSX.Element;

  if (isComplete) {
    const completeAnswers: SelectorAnswers = {
      footprint: answers.footprint as FootprintSize,
      location: answers.location as InstallLocation,
      failureMode: answers.failureMode as FailureMode,
    };
    const rec: SkuRecommendation = getRecommendation(completeAnswers);
    content = <RecommendationCard rec={rec} onRestart={handleRestart} />;
  } else {
    content = (
      <QuestionStep
        questionIndex={step}
        answers={answers}
        onAnswer={handleAnswer}
        onBack={handleBack}
      />
    );
  }

  return (
    <main>
      <h1>Find Your Replacement Lights</h1>
      <p>
        Answer three quick questions and we'll match you to the exact Brightworks
        kit that fixes the failure you experienced — no guesswork, no oversized
        bundles.
      </p>

      <div style={{ maxWidth: 600, marginTop: 32 }}>
        {content}
      </div>
    </main>
  );
}
