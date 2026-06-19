import React from "react";

export default function PrivacyGate({ onAccept, onDecline }) {
  return (
    <div className="privacy-gate-overlay">
      <div className="privacy-gate-card">
        {/* Top Shield Emblem Header */}
        <div className="privacy-shield-icon">
          <span className="shield-emblem">🛡️</span>
        </div>

        <div className="privacy-header-text">
          <h3>Before you upload your file</h3>
          <p>Please take a moment to understand how your operational business datasets are processed securely within DataPurge Studio.</p>
        </div>

        {/* Core Trust Pillars Checklist */}
        <div className="privacy-pillars-list">
          <div className="privacy-pillar-item">
            <span className="pillar-check">✓</span>
            <div>
              <strong>Isolated Runtime Environment</strong>
              <p>Your uploaded data is held strictly in temporary execution memory slots. No raw files are ever stored on cloud storage hard drives.</p>
            </div>
          </div>

          <div className="privacy-pillar-item">
            <span className="pillar-check">✓</span>
            <div>
              <strong>GDPR &amp; Enterprise Compliance Protocols</strong>
              <p>No customer data structures are trained, tracked, transmitted, or shared with third-party networks or AI systems.</p>
            </div>
          </div>

          <div className="privacy-pillar-item">
            <span className="pillar-check">✓</span>
            <div>
              <strong>Zero-Retention Auto-Purge Loop</strong>
              <p>Closing your processing tab or completing an export automatically destroys the temporary runtime server variables instantly.</p>
            </div>
          </div>
        </div>

        <div className="privacy-terms-notice">
          By clicking <strong>"I agree &amp; continue"</strong>, you confirm you acknowledge our security guidelines and consent to process files under these compliance boundaries.
        </div>

        {/* Gate Actions Row */}
        <div className="privacy-gate-actions">
          <button className="btn btn-secondary" onClick={onDecline} style={{ padding: "12px 24px" }}>
            Decline
          </button>
          <button className="btn btn-primary" onClick={onAccept} style={{ padding: "12px 28px", fontWeight: 600 }}>
            I agree &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}