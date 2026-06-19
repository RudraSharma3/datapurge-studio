import React, { useState, useRef } from "react";

export default function UploadStep({ onComplete }) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(null);
  const inputRef = useRef();

  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  async function handleFiles(files) {
    const file = files[0];
    if (!file) return;
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${BASE_URL}/api/analyze`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Backend failed to parse the file structure.");
      const data = await response.json();
      setParsed(data);
    } catch (e) {
      setError("Failed to communicate with processing core parameters.");
    } finally {
      setLoading(false);
    }
  }

  if (parsed) {
    return (
      <div className="upload-wrap">
        <div className="card">
          <div className="card-title">File Loaded Successfully</div>
          <ParsedPreview data={parsed} onReset={() => setParsed(null)} onContinue={() => onComplete(parsed)} />
        </div>
      </div>
    );
  }

  return (
    <div className="upload-wrap">
      <div className="card">
        <div className="card-title">Upload Your Data File</div>
        <div className="card-sub">Supports CSV and Excel (.xlsx, .xls)</div>
        <div
          className={`drop-zone ${dragOver ? "drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />
          {loading ? (
            <>
              <div className="drop-icon"><div className="spinner" style={{ width: 40, height: 40, margin: "0 auto" }} /></div>
              <div className="drop-title">Parsing dataset architecture…</div>
            </>
          ) : (
            <>
              <div className="drop-icon">📂</div>
              <div className="drop-title">Drop your file here, or click to browse</div>
              <div className="drop-sub">Column types auto-detected · Multi-sheet layouts supported</div>
              <div className="drop-types">
                <span className="type-badge">CSV</span>
                <span className="type-badge">XLSX</span>
                <span className="type-badge">XLS</span>
              </div>
            </>
          )}
        </div>
        {error && <div className="alert alert-warn" style={{ marginTop: 12 }}>⚠️ {error}</div>}
      </div>
    </div>
  );
}

function ParsedPreview({ data, onReset, onContinue }) {
  const sheetNames = Object.keys(data.sheets || {});
  const [previewSheet, setPreviewSheet] = useState(sheetNames[0] || "Default_Sheet");

  const totalRows = sheetNames.reduce((acc, name) => acc + (data.sheets[name]?.rowCount || 0), 0);

  const currentSheet = data.sheets[previewSheet] || { headers: [], colTypes: {}, rows: [], rowCount: 0 };
  const headers = currentSheet.headers || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="file-preview">
        <div className="file-icon">{data.fileType === "csv" ? "📄" : "📊"}</div>
        <div className="file-info">
          <div className="file-name">{data.fileName}</div>
          <div className="file-meta">
            {data.fileType?.toUpperCase()} · {sheetNames.length} sheet(s) detected · {totalRows.toLocaleString()} total combined rows
          </div>
        </div>
        <button className="btn btn-secondary" onClick={onReset}>✕ Remove</button>
      </div>

      <div className="file-stats">
        <div className="stat-item"><span className="stat-val">{totalRows.toLocaleString()}</span><span className="stat-key">Total combined rows</span></div>
        <div className="stat-item"><span className="stat-val">{sheetNames.length}</span><span className="stat-key">Worksheets</span></div>
        <div className="stat-item"><span className="stat-val">{headers.length}</span><span className="stat-key">Active sheet columns</span></div>
      </div>

      {sheetNames.length > 1 && (
        <div>
          <div className="section-label">Select worksheet preview snapshot:</div>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {sheetNames.map((name) => (
              <div key={name} className={`tab ${previewSheet === name ? "active" : ""}`} onClick={() => setPreviewSheet(name)}>
                📄 {name} ({(data.sheets[name]?.rowCount || 0)} rows)
              </div>
            ))}
          </div>
        </div>
      )}

      {headers.length > 0 && (
        <div>
          <div className="section-label">Detected Column Meta ({previewSheet})</div>
          <div className="col-chips">
            {headers.map((h) => (
              <span key={h} className="col-chip sel" style={{ cursor: "default" }}>
                {h} <span style={{ opacity: 0.6, fontSize: 10 }}>· {currentSheet.colTypes[h] || "text"}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="section-label">Sample Data Grid (Top 5 rows of {previewSheet})</div>
        <div className="preview-table-wrap">
          <table>
            <thead>
              <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {currentSheet.rows?.length === 0 ? (
                <tr><td colSpan={headers.length || 1} style={{ textAlign: "center", padding: 20, color: "var(--text3)" }}>Sheet is empty</td></tr>
              ) : (
                currentSheet.rows?.map((row, i) => (
                  <tr key={i}>{headers.map(h => <td key={h}>{String(row[h] ?? "")}</td>)}</tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={onReset}>Upload different file</button>
        <button className="btn btn-primary" onClick={onContinue}>Configure Data Cleaning →</button>
      </div>
    </div>
  );
}