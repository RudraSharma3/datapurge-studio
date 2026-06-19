import React from "react";

export default function ExportStep({ stats, onRestart }) {
  const totalOriginal = stats?.totalOriginal || 0;
  const totalRemoved = stats?.totalRemoved || 0;
  const totalKept = stats?.totalKept || 0;
  
  const pct = totalOriginal ? Math.round((totalRemoved / totalOriginal) * 100) : 0;
  const hasRemovedRows = totalRemoved > 0;

  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const handleDownload = (format, isAudit = false) => {
    const cacheBuster = new Date().getTime();
    window.open(`${BASE_URL}/api/download?format=${format}${isAudit ? "&audit=true" : ""}&t=${cacheBuster}`, "_blank");
  };

  return (
    <div className="export-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>
      <div className="export-success" style={{ fontSize: "54px", marginBottom: "8px", color: "var(--accent)" }}>✨</div>
      <div className="export-title">Data Cleaned Successfully</div>
      <div className="export-sub" style={{ marginBottom: "32px", textAlign: "center", maxWidth: "500px", marginLeft: "auto", marginRight: "auto" }}>
        Your dataset has been processed via Pandas. Download your clean files below.
      </div>

      <div className="export-cards" style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "32px", width: "100%" }}>
        <div className="export-card">
          <div className="ec-val">{totalOriginal.toLocaleString()}</div>
          <div className="ec-key">Original rows</div>
        </div>
        <div className="export-card" style={{ borderColor: "rgba(0, 229, 160, 0.3)" }}>
          <div className="ec-val">{totalKept.toLocaleString()}</div>
          <div className="ec-key">Rows retained</div>
        </div>
        <div className="export-card" style={{ borderColor: "rgba(255, 92, 92, 0.3)" }}>
          <div className="ec-val" style={{ color: "var(--danger)" }}>{totalRemoved.toLocaleString()}</div>
          <div className="ec-key">Rows removed ({pct}%)</div>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: "480px", marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)", marginBottom: 6 }}>
          <span>Data retained</span>
          <span>{100 - pct}%</span>
        </div>
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${100 - pct}%` }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", alignItems: "center", marginBottom: "40px" }}>
        <div style={{ width: "100%", maxWidth: "480px", background: "rgba(0, 229, 160, 0.04)", border: "1px solid rgba(0, 229, 160, 0.15)", borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 4, letterSpacing: "0.03em", textTransform: "uppercase", textAlign: "left" }}>🛡️ Cleaned Data</div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14, textAlign: "left" }}>{totalKept.toLocaleString()} rows ready for download</div>
          <div className="export-btns" style={{ display: "flex", gap: "12px" }}>
            <button className="btn btn-primary" onClick={() => handleDownload("csv", false)}>📄 Download as CSV</button>
            <button className="btn btn-secondary" onClick={() => handleDownload("xlsx", false)}>📊 Download as Excel (.xlsx)</button>
          </div>
        </div>

        {hasRemovedRows && (
          <div style={{ width: "100%", maxWidth: "480px", background: "rgba(255, 92, 92, 0.04)", border: "1px solid rgba(255, 92, 92, 0.15)", borderRadius: 10, padding: "20px 24px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)", marginBottom: 4, letterSpacing: "0.03em", textTransform: "uppercase", textAlign: "left" }}>🗑️ Removed Rows — for Review</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14, textAlign: "left" }}>{totalRemoved.toLocaleString()} rows flagged during processing — download to audit records. Includes a <em>Removal Reason</em> tracker.</div>
            <div className="export-btns" style={{ display: "flex", gap: "12px" }}>
              <button className="btn btn-secondary" onClick={() => handleDownload("csv", true)} style={{ borderColor: "rgba(255,92,92,0.4)", color: "var(--danger)" }}>📄 Download Removed as CSV</button>
              <button className="btn btn-secondary" onClick={() => handleDownload("xlsx", true)} style={{ borderColor: "rgba(255,92,92,0.4)", color: "var(--danger)" }}>📊 Download Removed as Excel</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24, width: "100%", maxWidth: "480px", display: "flex", justifyContent: "center" }}>
        <button className="btn btn-secondary" onClick={onRestart}>🔄 Start Over</button>
      </div>
    </div>
  );
}