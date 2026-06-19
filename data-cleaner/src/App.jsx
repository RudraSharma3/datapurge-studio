import React, { useState, useEffect } from "react";
import { Hexagon } from "lucide-react";
import StepIndicator from "./components/StepIndicator";
import PrivacyGate from "./components/PrivacyGate";
import LandingPage from "./components/LandingPage";
import AuthScreen from "./components/AuthScreen";
import UploadStep from "./components/UploadStep";
import ConfigureStep from "./components/ConfigureStep";
import ReviewStep from "./components/ReviewStep";
import ExportStep from "./components/ExportStep";
import "./styles.css";

const STEPS = ["Upload", "Configure", "Review", "Export"];

export default function App() {
  const [showApp, setShowApp] = useState(false);
  const [user, setUser] = useState(null);
  const [authTriggered, setAuthTriggered] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  
  const [step, setStep] = useState(0);
  const [fileMeta, setFileMeta] = useState(null);
  const [cleanConfig, setCleanConfig] = useState(null);
  const [cleanResult, setCleanResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── LOCAL PLATFORM PERSISTENT AUTH LIFECYCLE ──
  useEffect(() => {
    const localSession = localStorage.getItem("datapurge_session_token");
    const localProfile = localStorage.getItem("datapurge_user_profile");

    if (localSession && localProfile) {
      try {
        const parsedProfile = JSON.parse(localProfile);
        setUser(parsedProfile);
        setShowApp(true);
      } catch (err) {
        localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const handleAuthSuccess = (validatedUser) => {
    setUser(validatedUser);
    setAuthTriggered(false);
    setShowApp(true);
  };

  const handleLaunchClick = () => {
    if (user) {
      setShowApp(true);
    } else {
      setAuthTriggered(true);
    }
  };

  const handleLogOut = () => {
    localStorage.removeItem("datapurge_session_token");
    localStorage.removeItem("datapurge_user_profile");
    setUser(null);
    setShowApp(false);
    setAuthTriggered(false);
    setPrivacyAccepted(false); 
    setStep(0);
    setFileMeta(null);
    setCleanConfig(null);
    setCleanResult(null);
  };

  const handleRestartFlow = () => {
    setStep(0);
    setFileMeta(null);
    setCleanConfig(null);
    setCleanResult(null);
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#0d0f12", color: "var(--accent)", fontFamily: "monospace" }}>
        ⌛ INITIALIZING DATA_PURGE LOCAL CORE RUNTIME_CONTEXT...
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ paddingTop: showApp ? "0" : "20px" }}>
      {/* ── NAVBAR CONDITIONAL RENDERING — Hidden on Auth & Active Dashboard Views ── */}
      {!showApp && !authTriggered && (
        <nav className="glass-nav">
          <div className="logo-area" onClick={() => { setShowApp(false); setAuthTriggered(false); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
            <Hexagon size={22} color="#00e5a0" fill="rgba(0, 229, 160, 0.1)" style={{ filter: "drop-shadow(0 0 8px rgba(0, 229, 160, 0.4))" }} />
            <span className="logo-text" style={{ fontSize: "16px", fontWeight: "700", letterSpacing: "-0.5px" }}>DataPurge</span>
          </div>
          
          <div className="nav-links">
            <a href="#home" className="nav-link">Home</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#matrix" className="nav-link">Why DataPurge</a>
            <a href="#calculator" className="nav-link">Efficiency</a>
            <a href="#about" className="nav-link">About</a>
            <a href="#contact" className="nav-link">Contact</a>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {user ? (
              <>
                <button className="btn btn-primary" onClick={() => setShowApp(true)} style={{ padding: "8px 16px", fontSize: "12px" }}>Dashboard ➜</button>
                <button className="btn btn-secondary" onClick={handleLogOut} style={{ padding: "8px 14px", fontSize: "12px" }}>Sign Out</button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setAuthTriggered(true)} style={{ padding: "8px 20px", fontSize: "12px", background: "linear-gradient(90deg, #00e5a0, #008cff)", color: "#000", fontWeight: 600 }}>Get Started Free</button>
            )}
          </div>
        </nav>
      )}

      {/* CORE WORKSPACE APPLICATION DASHBOARD HEADER */}
      {showApp && (
        <header className="app-header">
          <div className="logo-area" onClick={() => { setShowApp(false); setAuthTriggered(false); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
            <Hexagon size={22} color="#00e5a0" fill="rgba(0, 229, 160, 0.1)" style={{ filter: "drop-shadow(0 0 8px rgba(0, 229, 160, 0.4))" }} />
            <span className="logo-text" style={{ fontWeight: "700" }}>DataPurge</span>
            <span className="logo-tag">Data Cleaning Studio</span>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {user && <span style={{ fontSize: "12px", color: "var(--text3)" }}>🧑‍💻 {user.username || user.email}</span>}
            {user && <button className="btn btn-secondary" onClick={handleLogOut} style={{ fontSize: "11px", padding: "4px 10px" }}>Sign Out</button>}
          </div>
        </header>
      )}

      {/* RENDER DECISION ENGINE CORE ROUTER TREE */}
      {authTriggered && !user ? (
        <AuthScreen 
          onAuthSuccess={handleAuthSuccess} 
          onCancel={() => setAuthTriggered(false)} 
        />
      ) : !showApp ? (
        <LandingPage onStart={handleLaunchClick} isLoggedIn={!!user} userEmail={user?.email} />
      ) : !privacyAccepted ? (
        <PrivacyGate 
          onAccept={() => setPrivacyAccepted(true)} 
          onDecline={() => { setShowApp(false); setPrivacyAccepted(false); }} 
        />
      ) : (
        <>
          <StepIndicator steps={STEPS} current={step} />
          <main className="app-main">
            {step === 0 && <UploadStep onComplete={(meta) => { setFileMeta(meta); setStep(1); }} />}
            {step === 1 && fileMeta && (
              <ConfigureStep fileMeta={fileMeta} onBack={() => setStep(0)} onComplete={(cfg) => { setCleanConfig(cfg); setStep(2); }} />
            )}
            {step === 2 && fileMeta && cleanConfig && (
              <ReviewStep fileMeta={fileMeta} config={cleanConfig} onBack={() => setStep(1)} onComplete={(res) => { setCleanResult(res); setStep(3); }} />
            )}
            {step === 3 && cleanResult && fileMeta && (
              <ExportStep stats={cleanResult} fileName={fileMeta.fileName} onRestart={handleRestartFlow} />
            )}
          </main>
        </>
      )}
    </div>
  );
}