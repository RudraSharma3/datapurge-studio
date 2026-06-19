import React, { useState } from "react";
import { Hexagon } from "lucide-react";

export default function AuthScreen({ onAuthSuccess, onCancel }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isSignUp && !username) return;
    setLoading(true);
    setMsg({ text: "", type: "" });

    const targetUrl = isSignUp
      ? `${BASE_URL}/api/auth/signup`
      : `${BASE_URL}/api/auth/login`;

    const bodyPayload = isSignUp
      ? { username, email, password }
      : { email, password };

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication layer rejected handshake.");
      }

      if (isSignUp) {
        setMsg({ text: "Account created successfully! Welcome to DataPurge. You can now sign in.", type: "info" });
        setIsSignUp(false);
        setUsername("");
        setPassword("");
      } else {
        if (data.session?.access_token) {
          localStorage.setItem("datapurge_session_token", data.session.access_token);
          localStorage.setItem("datapurge_user_profile", JSON.stringify(data.user));
        }
        onAuthSuccess(data.user);
      }
    } catch (err) {
      console.error("Auth System Connection Failure:", err);
      setMsg({ text: err.message || "Failed to establish validation schema data link.", type: "warn" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-fullscreen-container">
      <button className="auth-back-escape" onClick={onCancel}>
        ← Back to Home
      </button>

      <div className="auth-premium-card">
        <div className="auth-brand-center" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "24px" }}>
          <Hexagon size={26} color="#00e5a0" fill="rgba(0, 229, 160, 0.1)" style={{ filter: "drop-shadow(0 0 8px rgba(0, 229, 160, 0.4))" }} />
          <span className="auth-logo-text" style={{ fontSize: "20px", fontWeight: "700" }}>DataPurge</span>
        </div>

        <div className="auth-header-text-block">
          <h3>{isSignUp ? "Create your account" : "Sign in to your account"}</h3>
          <p>{isSignUp ? "Get started with automated multi-sheet styling retention." : "Welcome back. Enter your credentials to access your dashboard presets."}</p>
        </div>

        <form onSubmit={handleAuth} className="auth-form-layout">
          {isSignUp && (
            <div className="auth-field-row">
              <label>Choose Username</label>
              <input
                type="text"
                required
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value.replace(/\s+/g, ''))}
                disabled={loading}
              />
            </div>
          )}

          <div className="auth-field-row">
            <label>Work Email Address</label>
            <input
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="auth-field-row">
            <label>Account Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {msg.text && (
            <div className={`auth-status-alert ${msg.type === "warn" ? "warn" : "info"}`}>
              {msg.type === "warn" ? "⚠️" : "✨"} {msg.text}
            </div>
          )}

          <button type="submit" disabled={loading} className="auth-submit-action-btn">
            {loading ? "Verifying secure pipeline..." : isSignUp ? "Create Account & Workspace" : "Access Studio Workspace ➜"}
          </button>
        </form>

        <div className="auth-toggle-footer">
          {isSignUp ? "Already have a product account?" : "New to DataPurge Studio?"}{" "}
          <span onClick={() => { setIsSignUp(!isSignUp); setMsg({ text: "", type: "" }); setUsername(""); setEmail(""); setPassword(""); }}>
            {isSignUp ? "Sign In instead" : "Create an account for free"}
          </span>
        </div>
      </div>
    </div>
  );
}