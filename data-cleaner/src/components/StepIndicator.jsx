import React from "react";

export default function StepIndicator({ steps, current }) {
  return (
    <div className="step-bar">
      {steps.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center" }}>
          <div className={`step-item ${i === current ? "active" : i < current ? "done" : ""}`}>
            <div className="step-num">{i < current ? "✓" : i + 1}</div>
            <span className="step-label">{s}</span>
          </div>
          {i < steps.length - 1 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
}