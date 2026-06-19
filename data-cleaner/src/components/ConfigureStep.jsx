import React, { useState, useEffect } from "react";

const PHONE_COUNTRIES = [
  { value: "US", label: "🇺🇸 United States  +1  (NXX) NXX-XXXX" },
  { value: "IN", label: "🇮🇳 India  +91  XXXXX XXXXX" },
  { value: "UK", label: "🇬🇧 United Kingdom  +44  XXXX XXXXXX" },
  { value: "AU", label: "🇦🇺 Australia  +61  XXX XXX XXX" },
];

function ColPicker({ headers, selected, onChange, label }) {
  const toggle = (h) => onChange(selected.includes(h) ? selected.filter((x) => x !== h) : [...selected, h]);
  return (
    <div className="config-extra">
      <label>{label}</label>
      <div className="col-chips">
        {headers.map((h) => (
          <span key={h} className={`col-chip ${selected.includes(h) ? "sel" : ""}`} onClick={() => toggle(h)}>{h}</span>
        ))}
      </div>
    </div>
  );
}

function Section({ icon, title, badge, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="config-section">
      <div className="config-section-header" onClick={() => setOpen(!open)}>
        <span className="config-section-icon">{icon}</span>
        <span className="config-section-title">{title}</span>
        {badge && <span className="config-section-badge">{badge}</span>}
        <span style={{ color: "var(--text3)", transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "none" }}>▶</span>
      </div>
      {open && <div className="config-section-body">{children}</div>}
    </div>
  );
}

function Toggle({ checked, onChange, label, desc, children }) {
  return (
    <div className={`config-row ${checked ? "enabled" : ""}`}>
      <input type="checkbox" className="config-check" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="config-text">
        <div className="config-label">{label}</div>
        <div className="config-desc">{desc}</div>
        {checked && children}
      </div>
    </div>
  );
}

export default function ConfigureStep({ fileMeta, onBack, onComplete }) {
  const sheetNames = Object.keys(fileMeta.sheets);
  const [activeSheet, setActiveSheet] = useState(sheetNames[0]);
  
  const currentSheet = fileMeta.sheets[activeSheet] || { headers: [], colTypes: {} };
  const headers = currentSheet.headers || [];
  const colTypes = currentSheet.colTypes || {};

  const emailCols = headers.filter((h) => colTypes[h] === "email");
  const phoneCols = headers.filter((h) => colTypes[h] === "phone");
  const numberCols = headers.filter((h) => colTypes[h] === "number");
  const dateCols = headers.filter((h) => colTypes[h] === "date" || /date|time/i.test(h));
  const nameLike = headers.filter((h) => /name|first|last|fname|lname/i.test(h));

  const [profiles, setProfiles] = useState({});
  const [newProfileName, setNewProfileName] = useState("");

  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const [cfg, setCfg] = useState({
    trimWhitespace: true,
    removeSalutations: nameLike.length > 0, salutationCols: nameLike,
    standardiseEmail: emailCols.length > 0, emailCols,
    standardisePhone: phoneCols.length > 0, phoneCols, phoneCountry: "IN",
    standardiseDates: dateCols.length > 0, dateCols,
    fixDataTypes: numberCols.length > 0, numberCols,
    colTypeOverrides: {},
    removeRepetitiveWords: false, repetitiveCols: [],
    removeNulls: true, 
    nullMode: "rows",               
    nullColumnThreshold: 20.0,      
    nullCols: headers.slice(0, Math.min(3, headers.length)),
    removeDuplicates: true, dupCols: headers.slice(0, Math.min(3, headers.length)), dupStrategy: "merge",
    removeFuzzyDups: false, fuzzyCols: nameLike.length > 0 ? nameLike : headers.slice(0, 1), fuzzyThreshold: 80.0,
    anonymizeCols: false, anonymizeFields: []
  });

  // ── STRATEGIC AUTOMATED STATE SAFETY RESET LIFECYCLE ──
  useEffect(() => {
    setCfg((prev) => ({
      ...prev,
      salutationCols: nameLike,
      emailCols,
      phoneCols,
      dateCols,
      numberCols,
      nullCols: headers.slice(0, Math.min(3, headers.length)),
      dupCols: headers.slice(0, Math.min(3, headers.length)),
      fuzzyCols: nameLike.length > 0 ? nameLike : headers.slice(0, 1),
      anonymizeFields: []
    }));

    async function fetchLocalProfiles() {
      try {
        const response = await fetch(`${BASE_URL}/api/profiles/load`);
        if (response.ok) {
          const data = await response.json();
          setProfiles(data);
        }
      } catch (err) {
        console.error("Failed to load local templates configuration profiles:", err);
      }
    }
    fetchLocalProfiles();
  }, [activeSheet]);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const toggleTypeOverride = (col) => {
    const next = { ...cfg.colTypeOverrides };
    if (next[col] === "text") delete next[col]; else next[col] = "text";
    set("colTypeOverrides", next);
  };

  const handleSaveProfile = async () => {
    if (!newProfileName.trim()) return alert("Please specify a valid profile identity label.");
    const pName = newProfileName.trim();

    try {
      const response = await fetch(`${BASE_URL}/api/profiles/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileName: pName, config: cfg })
      });

      if (response.ok) {
        setProfiles(prev => ({ ...prev, [pName]: cfg }));
        alert(`Local Profile Template Blueprint [${pName}] stored successfully!`);
        setNewProfileName("");
      } else {
        alert("Failed to preserve configuration snapshot.");
      }
    } catch (err) {
      alert("Error transmitting configuration backup packages.");
    }
  };

  const handleLoadProfile = (name) => {
    if (profiles[name]) {
      setCfg(profiles[name]);
      alert(`Loaded profile templates layout: "${name}"`);
    }
  };

  return (
    <div className="config-wrap">
      <div className="card" style={{ padding: "16px 20px", background: "rgba(0, 140, 255, 0.03)", borderColor: "rgba(0, 140, 255, 0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div className="card-title" style={{ fontSize: "14px", color: "var(--text)" }}>⚙️ Persistent Profile Presets Templates</div>
            <div style={{ fontSize: "12px", color: "var(--text3)" }}>Blueprints are evaluated and preserved locally on your server workspace.</div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "auto" }}>
            {Object.keys(profiles).length > 0 && (
              <select onChange={(e) => handleLoadProfile(e.target.value)} defaultValue="" style={{ padding: "6px 12px", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "12px", borderRadius: "4px" }}>
                <option value="" disabled>📁 Load Saved Template...</option>
                {Object.keys(profiles).map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
            <input type="text" placeholder="Blueprint label (e.g. Sales Log)" value={newProfileName} onChange={e => setNewProfileName(e.target.value)} style={{ padding: "6px 12px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "12px", borderRadius: "4px", width: "180px" }} />
            <button className="btn btn-secondary" onClick={handleSaveProfile} style={{ padding: "6px 12px", fontSize: "12px", borderColor: "var(--accent)", color: "var(--accent)" }}>💾 Save Blueprint Layout</button>
          </div>
        </div>
      </div>

      {sheetNames.length > 1 && (
        <div className="card" style={{ padding: "12px 20px", marginBottom: "-4px" }}>
          <div className="section-label" style={{ marginBottom: "8px" }}>Select Worksheet to Adjust Settings:</div>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: "none" }}>
            {sheetNames.map(name => (
              <div key={name} className={`tab ${activeSheet === name ? "active" : ""}`} onClick={() => setActiveSheet(name)} style={{ padding: "6px 14px" }}>📄 {name}</div>
            ))}
          </div>
        </div>
      )}

      {numberCols.length > 0 && (
        <Section icon="🔢" title="Column Type Overrides" badge={Object.keys(cfg.colTypeOverrides).length > 0 ? "overridden" : "optional"}>
          <div className="col-chips">
            {numberCols.map((h) => {
              const isText = cfg.colTypeOverrides[h] === "text";
              return (
                <span key={h} className={`col-chip ${!isText ? "sel" : ""}`} onClick={() => toggleTypeOverride(h)}>
                  {h}<span style={{ opacity: 0.65, fontSize: 10 }}> · {isText ? "string" : "number"}</span>
                </span>
              );
            })}
          </div>
        </Section>
      )}

      <Section icon="🔧" title="Standardisation Engine Rules" badge="non-destructive">
        <Toggle checked={cfg.trimWhitespace} onChange={(v) => set("trimWhitespace", v)} label="Trim Whitespace" desc="Remove leading/trailing spaces from all cells globally" />
        <Toggle checked={cfg.removeSalutations} onChange={(v) => set("removeSalutations", v)} label="Remove Salutations" desc="Strip prefixes like Mr. or Dr. from string metrics"><ColPicker headers={headers} selected={cfg.salutationCols} onChange={(v) => set("salutationCols", v)} label="Apply to columns:" /></Toggle>
        <Toggle checked={cfg.removeRepetitiveWords} onChange={(v) => set("removeRepetitiveWords", v)} label="Remove Repetitive Words" desc="Deduplicate repeated data fields inside cells"><ColPicker headers={headers} selected={cfg.repetitiveCols} onChange={(v) => set("repetitiveCols", v)} label="Apply to columns:" /></Toggle>
      </Section>

      <Section icon="📋" title="Format Standardisation" badge="non-destructive">
        <Toggle checked={cfg.standardiseEmail} onChange={(v) => set("standardiseEmail", v)} label="Standardise Email Format" desc="Lowercase all email addresses and trim spaces"><ColPicker headers={headers} selected={cfg.emailCols} onChange={(v) => set("emailCols", v)} label="Email columns:" /></Toggle>
        <Toggle checked={cfg.standardisePhone} onChange={(v) => set("standardisePhone", v)} label="Standardise Phone Format" desc="Reformat phone numbers to a country-specific standard">
          <ColPicker headers={headers} selected={cfg.phoneCols} onChange={(v) => set("phoneCols", v)} label="Phone columns:" />
          {cfg.standardisePhone && <div className="config-extra"><select value={cfg.phoneCountry} onChange={(e) => set("phoneCountry", e.target.value)}>{PHONE_COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>}
        </Toggle>
        <Toggle checked={cfg.standardiseDates} onChange={(v) => set("standardiseDates", v)} label="Smart Date Normalization Engine" desc="Auto-repair and transform mixed inputs into standardized global format (YYYY-MM-DD)">
          <ColPicker headers={headers} selected={cfg.dateCols} onChange={(v) => set("dateCols", v)} label="Detected Date Columns:" />
        </Toggle>
      </Section>

      <Section icon="🛡️" title="Data Privacy & Field Masking" badge="enterprise hash encryption">
        <Toggle checked={cfg.anonymizeCols} onChange={(v) => set("anonymizeCols", v)} label="Anonymize Column Contents" desc="Securely apply one-way SHA-256 cryptographic masking blocks to personal data fields (GDPR Compliant)">
          <ColPicker headers={headers} selected={cfg.anonymizeFields} onChange={(v) => set("anonymizeFields", v)} label="Columns to Mask / Encrypt securely:" />
        </Toggle>
      </Section>

      <Section icon="🗑️" title="Record Removal Operations" badge="destructive rules">
        <Toggle checked={cfg.removeNulls} onChange={(v) => set("removeNulls", v)} label="Remove Null / Empty Records" desc="Handle records and columns with missing or blank strings">
          <div className="config-extra">
            <label>What to remove:</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {[
                { val: "rows", icon: "🔴", label: "Rows — flag records where required fields are empty" },
                { val: "columns", icon: "📊", label: `Columns — drop columns where ≥${cfg.nullColumnThreshold}% of values are null` },
                { val: "both", icon: "🔴📊", label: "Both rows and columns" }
              ].map(({ val, icon, label }) => (
                <label key={val} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 13, color: "var(--text)" }}>
                  <input type="radio" name="nullMode" value={val} checked={cfg.nullMode === val} onChange={() => set("nullMode", val)} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
                  <span>{icon}&nbsp;{label}</span>
                </label>
              ))}
            </div>
          </div>
          {(cfg.nullMode === "rows" || cfg.nullMode === "both") && (
            <ColPicker headers={headers} selected={cfg.nullCols} onChange={(v) => set("nullCols", v)} label="Required matching validation columns:" />
          )}
        </Toggle>
        
        <Toggle checked={cfg.removeDuplicates} onChange={(v) => set("removeDuplicates", v)} label="Smart Survivorship Deduplication" desc="Intelligently combine sparse rows or select primary entries over repeating identity keys">
          <ColPicker headers={headers} selected={cfg.dupCols} onChange={(v) => set("dupCols", v)} label="Identity Key Columns (e.g., Email or ID):" />
          {cfg.removeDuplicates && (
            <div className="config-extra" style={{ marginTop: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>🏆 Survivorship Resolution Strategy:</label>
              <select value={cfg.dupStrategy} onChange={(e) => set("dupStrategy", e.target.value)} style={{ padding: "6px 12px", background: "var(--surface3)", border: "1px solid var(--border2)", color: "var(--text)", width: "100%", maxWidth: "340px" }}>
                <option value="merge">🧬 Golden Record Merge — Blend missing rows attributes together</option>
                <option value="density">📊 Density First — Retain the record containing the highest field completeness</option>
                <option value="recent">⏱️ Recency First — Keep the entry with the newest timestamp column</option>
              </select>
            </div>
          )}
        </Toggle>
      </Section>

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" onClick={() => onComplete(cfg)}>Preview Changes →</button>
      </div>
    </div>
  );
}