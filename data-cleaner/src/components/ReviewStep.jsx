import React, { useState, useEffect, useMemo } from "react";

const PAGE_SIZE = 15;

export default function ReviewStep({ fileMeta, config, onBack, onComplete }) {
  const [result, setResult] = useState(null);
  const [activeSheet, setActiveSheet] = useState(Object.keys(fileMeta.sheets)[0]);
  const [tab, setTab] = useState("removed");
  const [overrides, setOverrides] = useState(new Set());
  const [page, setPage] = useState(0);
  const [editingCell, setEditingCell] = useState(null);

  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  async function runEngine() {
    try {
      const response = await fetch(`${BASE_URL}/api/clean-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error("Processing suite exception.");
      const res = await response.json();
      setResult(res);
    } catch (err) {
      alert("Failed to communicate with the data processing core server.");
    }
  }

  useEffect(() => {
    runEngine();
  }, [config]);

  const targetSheetData = useMemo(() => {
    if (!result || !result.sheets[activeSheet]) return { rows: [], totalClean: 0, totalFlagged: 0 };
    const sheetSnapshot = result.sheets[activeSheet];
    return {
      rows: tab === "removed" ? sheetSnapshot.flaggedRows : sheetSnapshot.cleanRows,
      totalClean: sheetSnapshot.totalCleanRows,
      totalFlagged: sheetSnapshot.totalFlaggedRows
    };
  }, [result, activeSheet, tab]);

  const displayRows = useMemo(() => {
    return targetSheetData.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [targetSheetData, page]);

  const totalPages = Math.ceil(targetSheetData.rows.length / PAGE_SIZE);

  const handleCellSave = async (rowId, column, newValue) => {
    setEditingCell(null);
    try {
      const res = await fetch(`${BASE_URL}/api/update-cell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetName: activeSheet,
          rowId: rowId,
          column: column,
          newValue: newValue
        })
      });
      if (res.ok) {
        runEngine();
      } else {
        alert("Server rejected row value adjustments.");
      }
    } catch (e) {
      alert("Error pushing cell update requests down to the core engine.");
    }
  };

  if (!result) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 36, height: 36, margin: "0 auto 12px" }} />
          <div style={{ color: "var(--text2)" }}>Running global auditing suite and health analytics…</div>
        </div>
      </div>
    );
  }

  const analytics = result.analytics || { score: 100, clusters: [], metrics: { missingCells: 0, duplicateRecords: 0, formattingErrors: 0 } };
  const clusters = analytics.clusters || [];
  const finalKept = (result.totalCleanRows || 0) + overrides.size;
  const finalRemoved = (result.totalFlaggedRows || 0) - overrides.size;

  const toggleOv = (rowId) => {
    setOverrides((prev) => {
      const n = new Set(prev);
      if (n.has(rowId)) n.delete(rowId); else n.add(rowId);
      return n;
    });
  };

  const handleConfirm = async () => {
    try {
      await fetch(`${BASE_URL}/api/rescue-rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rescuedIds: Array.from(overrides) }),
      });
      onComplete({ totalOriginal: finalKept + finalRemoved, totalKept: finalKept, totalRemoved: finalRemoved });
    } catch (e) {
      alert("Error saving manual validation overrides.");
    }
  };

  return (
    <div className="review-wrap">
      <div className="card" style={{ padding: "24px", background: "linear-gradient(135deg, var(--surface) 0%, rgba(0, 229, 160, 0.02) 100%)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: "32px", alignItems: "center", flexWrap: "wrap" }}>
          
          <div style={{ position: "relative", width: "100px", height: "100px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)", borderRadius: "50%", border: `4px solid ${analytics.score > 80 ? "var(--accent)" : "var(--warn)"}` }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "28px", fontWeight: "700", color: analytics.score > 80 ? "var(--accent)" : "var(--warn)" }}>{analytics.score}%</div>
              <div style={{ fontSize: "9px", textTransform: "uppercase", tracking: "0.05em", color: "var(--text3)" }}>Health</div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: "250px" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>⚠️ Primary Anomalies &amp; Error Clusters Detected:</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {clusters.length === 0 ? (
                <span className="reason-badge" style={{ background: "rgba(0, 229, 160, 0.1)", color: "var(--accent)" }}>🛡️ Dataset is perfectly clean. Zero exceptions found.</span>
              ) : (
                clusters.map((c, idx) => (
                  <span key={idx} className="reason-badge" style={{ background: "rgba(255, 92, 92, 0.06)", border: "1px solid rgba(255, 92, 92, 0.15)", color: "var(--danger)", padding: "6px 12px", fontSize: "11px" }}>
                    {c.issue} <strong style={{ marginLeft: "4px", background: "var(--danger)", color: "white", padding: "1px 5px", borderRadius: "3px" }}>{c.count}</strong>
                  </span>
                ))
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "24px", background: "rgba(0,0,0,0.15)", padding: "14px 20px", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text)" }}>{analytics.metrics?.missingCells || 0}</div><div style={{ fontSize: "11px", color: "var(--text3)" }}>Blank Cells</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: "16px", fontWeight: "600", color: "var(--warn)" }}>{analytics.metrics?.duplicateRecords || 0}</div><div style={{ fontSize: "11px", color: "var(--text3)" }}>Duplicates</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: "16px", fontWeight: "600", color: "var(--danger)" }}>{analytics.metrics?.formattingErrors || 0}</div><div style={{ fontSize: "11px", color: "var(--text3)" }}>Bad Formats</div></div>
          </div>
        </div>
      </div>

      <div className="review-stats" style={{ marginTop: "-8px" }}>
        <div className="review-stat"><div className="rs-val">{((result.totalCleanRows || 0) + (result.totalFlaggedRows || 0)).toLocaleString()}</div><div className="rs-key">Total rows</div></div>
        <div className="review-stat keep"><div className="rs-val keep">{finalKept.toLocaleString()}</div><div className="rs-key">Will be kept</div></div>
        <div className="review-stat remove"><div className="rs-val remove">{finalRemoved.toLocaleString()}</div><div className="rs-key">Will be removed</div></div>
        <div className="review-stat"><div className="rs-val" style={{ color: "var(--warn)" }}>{overrides.size} rescued</div><div className="rs-key">Overrides tracked</div></div>
      </div>

      {Object.keys(result.sheets).length > 1 && (
        <div className="card" style={{ padding: "12px 20px", marginBottom: "-4px" }}>
          <div className="section-label" style={{ marginBottom: "8px" }}>Select Workbook Sheet to Audit Preview:</div>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: "none" }}>
            {Object.keys(result.sheets).map(name => (
              <div key={name} className={`tab ${activeSheet === name ? "active" : ""}`} onClick={() => { setActiveSheet(name); setPage(0); }}>📄 {name}</div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: "none" }}>
            <div className={`tab ${tab === "removed" ? "active" : ""}`} onClick={() => { setTab("removed"); setPage(0); }}>🔴 Flagged Records ({targetSheetData.totalFlagged})</div>
            <div className={`tab ${tab === "kept" ? "active" : ""}`} onClick={() => { setTab("kept"); setPage(0); }}>🟢 Retained Records ({targetSheetData.totalClean})</div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text3)", background: "rgba(255,255,255,0.03)", padding: "4px 10px", borderRadius: "4px", border: "1px solid var(--border)" }}>
            💡 <strong>Double-click any cell</strong> to edit contents inline instantly
          </div>
        </div>

        <div className="preview-table-wrap">
          <table>
            <thead>
              <tr>
                {tab === "removed" && <th style={{ width: 60 }}>Keep?</th>}
                {tab === "removed" && <th>Reason</th>}
                {fileMeta.sheets[activeSheet]?.headers.map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr key={i} style={tab === "removed" && overrides.has(row._row_id) ? { background: "rgba(0,229,160,0.06)" } : undefined}>
                  {tab === "removed" && (
                    <td><input type="checkbox" checked={overrides.has(row._row_id)} onChange={() => toggleOv(row._row_id)} style={{ accentColor: "var(--accent)" }} /></td>
                  )}
                  {tab === "removed" && (
                    <td><span className="reason-badge">{row._reasons || "Flagged record"}</span></td>
                  )}
                  
                  {fileMeta.sheets[activeSheet]?.headers.map((h) => {
                    const isEditing = editingCell?.rowId === row._row_id && editingCell?.column === h;
                    return (
                      <td 
                        key={h} 
                        onDoubleClick={() => !isEditing && setEditingCell({ rowId: row._row_id, column: h, val: String(row[h] ?? "") })}
                        style={{ cursor: "cell", position: "relative" }}
                        title="Double-click to edit cell"
                      >
                        {isEditing ? (
                          <input 
                            type="text" 
                            defaultValue={editingCell.val}
                            autoFocus
                            onBlur={(e) => handleCellSave(row._row_id, h, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave(row._row_id, h, e.target.value);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            style={{ position: "absolute", top: 2, left: 2, width: "calc(100% - 4px)", height: "calc(100% - 4px)", background: "var(--surface3)", border: "1px solid var(--accent)", color: "var(--text)", padding: "0 8px", zIndex: 10, borderRadius: "2px" }}
                          />
                        ) : (
                          String(row[h] ?? "")
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="pagination">
            <button className="pg-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
            <span>Page {page + 1} of {totalPages}</span>
            <button className="pg-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        )}
      </div>

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn btn-danger" onClick={handleConfirm}>🗑️ Confirm &amp; Export</button>
      </div>
    </div>
  );
}