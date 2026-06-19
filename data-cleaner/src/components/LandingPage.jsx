import React, { useState } from "react";

const FEATURE_DATA = [
  {
    id: "style",
    icon: "🎨",
    title: "Style Retention Framework",
    short: "Traditional scripts strip cell backgrounds. DataPurge keeps formatting intact.",
    before: "⚠️ neha_sales.xlsx ➜ Wipes all your red, yellow, & green row highlights.",
    after: "✅ clean_sales.xlsx ➜ Drops the broken rows. Keeps 100% of your color designs.",
  },
  {
    id: "sheets",
    icon: "📊",
    title: "Simultaneous Multi-Sheet Sweeps",
    short: "Process workbooks with 10+ tabs at the exact same time without crashes.",
    before: "⚠️ Pandas ➜ Throws schema matching errors if sheet formats vary slightly.",
    after: "✅ DataPurge ➜ Isolates and parses separate tabular structures in parallel.",
  },
  {
    id: "edit",
    icon: "📝",
    title: "Interactive In-Grid Editing",
    short: "Fix minor typos right on your review screen to instantly re-verify records.",
    before: "⚠️ Traditional ➜ Download file, manually edit in Excel, re-upload to start over.",
    after: "✅ DataPurge ➜ Double-click cell inline ➜ Backend updates & re-scores live.",
  },
  {
    id: "mask",
    icon: "🛡️",
    title: "Enterprise Data Hashing",
    short: "Secure personal data fields with corporate-grade cryptographic masks.",
    before: "⚠️ Raw Data ➜ Phone numbers and emails are fully exposed in plain text.",
    after: "✅ Anonymized ➜ '9876543212' secure-hashed into encrypted string 'e3b0c44298fc'.",
  },
];

export default function LandingPage({ onStart, isLoggedIn }) {
  const [activeFeat, setActiveFeat] = useState(FEATURE_DATA[0]);

  // Dynamic Contact Form State Hooks
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  // Dynamic Submission Handler talking directly to your backend Server
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionError("");

    try {
      const response = await fetch(`${BASE_URL}/api/inquiries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: contactName,
          email: contactEmail,
          message: contactMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Database server rejected the transaction.");
      }

      setFormSubmitted(true);
      setContactName("");
      setContactEmail("");
      setContactMessage("");
    } catch (err) {
      console.error("Pipeline Connection Error:", err);
      setSubmissionError(err.message || "Could not reach the backend server. If running locally, make sure your backend is active.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="landing-container">
      {/* ── HERO BANNER HUB SECTION ── */}
      <section id="home" className="hero-section">
        <div className="badge-promo">✨ Next-Generation Tabular Processing</div>
        <h1 className="hero-title">
          Clean Multi-Sheet Spreadsheets <br />
          <span className="gradient-text">With Style &amp; Formatting Retention</span>
        </h1>
        <p className="hero-subtitle">
          Stop letting basic programming scripts ruin your custom layouts. DataPurge Studio evaluates business files cell-by-cell, clusters errors visually, and gives you direct in-browser interactive line updates.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" onClick={onStart} style={{ boxShadow: "0 0 24px var(--glow-green)" }}>
            {isLoggedIn ? "Open Studio Dashboard ➜" : "Launch App — Sign Up Free ➜"}
          </button>
          <a href="#features" className="btn btn-secondary btn-lg">Explore Interactive Engine</a>
        </div>
      </section>

      {/* ── HOVER INTERACTIVE FEATURES WORKSPACE ── */}
      <section id="features" className="matrix-section">
        <div className="section-heading-block">
          <div className="badge-promo" style={{ background: "rgba(0, 140, 255, 0.05)", color: "#33a0ff" }}>⚙️ Core Capabilities</div>
          <h2>Inside the DataPurge Studio Workspace</h2>
          <p style={{ color: "var(--text2)", fontSize: "14px" }}>Hover over any feature card to see the direct production behavior and data outputs.</p>
        </div>

        <div className="interactive-feature-split">
          <div className="feature-cards-deck">
            {FEATURE_DATA.map((feat) => (
              <div 
                key={feat.id} 
                className={`interactive-feat-card ${activeFeat.id === feat.id ? "active" : ""}`}
                onMouseEnter={() => setActiveFeat(feat)}
              >
                <div className="feat-card-header-row">
                  <span className="feat-card-avatar">{feat.icon}</span>
                  <h4>{feat.title}</h4>
                </div>
                <p>{feat.short}</p>
              </div>
            ))}
          </div>

          <div className="feature-live-monitor">
            <div className="mockup-inner" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <div className="mockup-header">
                <div className="dot"></div><div className="dot yellow"></div><div className="dot green"></div>
                <div style={{ fontSize: "10px", color: "var(--text3)", marginLeft: "12px", fontFamily: "monospace" }}>ENGINE_SIMULATOR_LOG // {activeFeat.title.toUpperCase()}</div>
              </div>
              <div className="mockup-body" style={{ flex: 1, justifyContent: "center", gap: "20px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--danger)", textTransform: "uppercase", fontWeight: 700, marginBottom: "6px", fontFamily: "monospace" }}>⚠️ Before Processing:</div>
                  <div style={{ background: "rgba(255,95,86,0.04)", border: "1px solid rgba(255,95,86,0.15)", padding: "12px", borderRadius: "6px", fontSize: "13px", color: "#ff807a", fontFamily: "monospace" }}>
                    {activeFeat.before}
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: "11px", color: "var(--accent)", textTransform: "uppercase", fontWeight: 700, marginBottom: "6px", fontFamily: "monospace" }}>✨ DataPurge Core Output:</div>
                  <div style={{ background: "rgba(0,229,160,0.04)", border: "1px solid rgba(0,229,160,0.25)", padding: "12px", borderRadius: "6px", fontSize: "13px", color: "var(--accent)", fontWeight: 500, fontFamily: "monospace" }}>
                    {activeFeat.after}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HIGH-TRUST WORKFLOW VELOCITY COMPARISON ── */}
      <section id="calculator" className="calculator-section">
        <div className="calc-title-area">
          <h3><span>⚡</span> Operational Velocity &amp; Efficiency</h3>
          <p>See how DataPurge Studio transforms slow, manual spreadsheet sorting into an automated pipeline.</p>
        </div>
        
        <div className="velocity-split-grid">
          <div className="velocity-card card-friction">
            <div className="velocity-card-header">
              <span className="velocity-badge badge-friction">⚠️ Legacy Manual Process</span>
              <h4>The Hidden Operational Bottleneck</h4>
            </div>
            <ul className="velocity-list">
              <li>
                <strong>Hours of Manual Line Auditing</strong>
                <p>Teams spend entire mornings scrolling through thousands of rows looking for minor typos, corrupted structures, or duplicate records by hand.</p>
              </li>
              <li>
                <strong>Destructive Formatting Loss</strong>
                <p>Using standard scripts or sorting tools accidentally strips away custom fonts, borders, and crucial row-highlighting colors used by stakeholders.</p>
              </li>
              <li>
                <strong>Fragile Sheet-by-Sheet Workflows</strong>
                <p>Multi-sheet books with mixed schemas have to be split apart, processed individually, and manually reassembled, risking severe data drift.</p>
              </li>
              <li>
                <strong>No Compliance Safety Net</strong>
                <p>Manually masking or hashing personal client identifiers (PII) before distribution requires writing complex calculations or exposed equations.</p>
              </li>
            </ul>
          </div>
          
          <div className="velocity-card card-optimized">
            <div className="velocity-card-header">
              <span className="velocity-badge badge-optimized">✨ Optimized with DataPurge</span>
              <h4>Automated Precision in 60 Seconds</h4>
            </div>
            <ul className="velocity-list">
              <li>
                <strong>Instant Diagnostic Clustering</strong>
                <p>The system evaluates entire files in milliseconds, highlighting structural error groups instantly and allowing double-click inline corrections.</p>
              </li>
              <li>
                <strong>Surgical Style Retention</strong>
                <p>Our underlying XML manipulation engine drops corrupted or duplicate rows directly from the sheet layer while keeping 100% of your visual design intact.</p>
              </li>
              <li>
                <strong>Concurrent Multi-Sheet Processing</strong>
                <p>Drop massive workbooks with 10+ tabs at once. The system maps and isolates separate tabular indices concurrently without ever crashing.</p>
              </li>
              <li>
                <strong>One-Click Hash Anonymization</strong>
                <p>Toggle advanced, enterprise-grade cryptographic masks to secure sensitive text or numeric blocks (GDPR compliant) instantly before export.</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── COMPETITIVE DIFFERENTIATION MATRIX ── */}
      <section id="matrix" className="matrix-section">
        <div className="section-heading-block">
          <div className="badge-promo" style={{ background: "rgba(0, 229, 160, 0.05)" }}>⚔️ Feature Matrix Comparison</div>
          <h2>Why DataPurge Outperforms Traditional Methods</h2>
        </div>

        <div className="matrix-table-wrap-premium">
          <table className="matrix-table-premium">
            <thead>
              <tr>
                <th>Capability Metric</th>
                <th>Manual Excel Adjusting</th>
                <th>Standard Python Scripts</th>
                <th className="highlight-column-header">DataPurge Studio</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="metric-title">🎨 Preserves Layout Fills &amp; Styling</td>
                <td>✅ Yes (But Slow)</td>
                <td className="no-style">❌ Wiped Clean by Pandas</td>
                <td className="highlight-column-header text-green">✨ Complete XML Preservation</td>
              </tr>
              <tr>
                <td className="metric-title">📊 Multi-Sheet Sheet Sweeps</td>
                <td className="no-style">❌ No (One Sheet at a Time)</td>
                <td className="no-style">❌ Crashes on Schema Mismatch</td>
                <td className="highlight-column-header">✅ Concurrent Background Sweep</td>
              </tr>
              <tr>
                <td className="metric-title">📝 In-Browser Live Grid Edits</td>
                <td>✅ Yes</td>
                <td className="no-style">❌ No Graphical UI</td>
                <td className="highlight-column-header text-green">✨ Double-Click Inline Patch</td>
              </tr>
              <tr>
                <td className="metric-title">💾 Cloud Configuration Profiles</td>
                <td className="no-style">❌ No</td>
                <td className="no-style">❌ Requires Code Adjustments</td>
                <td className="highlight-column-header">✅ Persistent Database Presets</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── ABOUT SECTION ── */}
      <section id="about" className="about-grid-premium">
        <div className="about-sticky-intro">
          <div className="badge-promo" style={{ background: "rgba(0, 140, 255, 0.05)", color: "#33a0ff" }}>📦 Behind the Architecture</div>
          <h2>Engineered for Modern Data Operations</h2>
          <p style={{ color: "var(--text2)", fontSize: "14px", lineHeight: "1.6", marginTop: "12px" }}>
            DataPurge Studio was built because standard backend engineering tools shouldn't force businesses to sacrifice their presentation styling, corporate branding, or row highlights just to sanitize records.
          </p>
        </div>
        <div className="about-cards-stack">
          <div className="about-mini-card">
            <h4>🔒 Zero-Retention Storage</h4>
            <p>Your business files stream entirely in localized memory buffers and auto-delete completely within 60 minutes of extraction.</p>
          </div>
          <div className="about-mini-card">
            <h4>⚡ Hybrid Parsing Engine</h4>
            <p>Combines fast Python data processing arrays with standard spreadsheet frameworks to run deep layout audits smoothly.</p>
          </div>
        </div>
      </section>

      {/* ── DYNAMIC CONTACT SECTION ── */}
      <section id="contact" className="matrix-section">
        <div className="section-heading-block">
          <h2>Get in Touch with DataPurge</h2>
          <p style={{ color: "var(--text2)", fontSize: "14px" }}>Have custom architectural requests, scalability questions, or integration needs? Reach out to our operations desk.</p>
        </div>

        <div className="contact-premium-wrapper">
          <div className="contact-perks-shelf">
            <div className="perk-pill">
              <span className="perk-dot-glow"></span>
              <div>
                <h5>Direct Engineer Responses</h5>
                <p>Skip the support ticket queues. Chat directly with the developers building the pipeline core.</p>
              </div>
            </div>
            <div className="perk-pill">
              <span className="perk-dot-glow blue"></span>
              <div>
                <h5>Custom Schema Tailoring</h5>
                <p>Need custom rules for specialized data? We design specialized evaluation blocks for enterprise accounts.</p>
              </div>
            </div>
          </div>

          <div className="premium-contact-card card" style={{ padding: "28px" }}>
            {formSubmitted ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>✨</div>
                <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--accent)" }}>Message Transmitted Successfully</div>
                <div style={{ fontSize: "13px", color: "var(--text3)", marginTop: "8px", lineHeight: "1.5" }}>
                  Your submission has been captured directly in our operations pipeline database instance.
                </div>
                <button 
                  className="btn btn-secondary" 
                  style={{ marginTop: "20px", padding: "6px 12px", fontSize: "12px" }}
                  onClick={() => setFormSubmitted(false)}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="contact-form-premium">
                <div className="input-flex-row">
                  <div className="field-block" style={{ flex: 1 }}>
                    <label>Your Name</label>
                    <input 
                      type="text" 
                      placeholder="FULL NAME" 
                      required 
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="field-block" style={{ flex: 1 }}>
                    <label>Business Email</label>
                    <input 
                      type="email" 
                      placeholder="name@company.com" 
                      required 
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="field-block" style={{ marginTop: "16px" }}>
                  <label>Message Content</label>
                  <textarea 
                    placeholder="Tell us about your pipeline workflows..." 
                    rows={4} 
                    required
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    disabled={isSubmitting}
                  ></textarea>
                </div>

                {submissionError && (
                  <div style={{ color: "var(--danger)", fontSize: "12px", marginTop: "12px" }}>
                    ⚠️ {submissionError}
                  </div>
                )}

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ marginTop: "20px", width: "100%", padding: "12px", justifyContent: "center" }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Transmitting Submission..." : "Send Inquiry ➜"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}