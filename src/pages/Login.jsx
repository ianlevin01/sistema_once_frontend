import { useState, useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../utils/useAuth";

export default function Login() {
  useEffect(() => { document.title = "Iniciar sesión — Once"; }, []);
  const { login, loginWithGoogle } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.response?.data?.message || "Credenciales incorrectas");
    }
    setLoading(false);
  };

  const handleGoogle = async ({ credential }) => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle(credential);
    } catch (err) {
      setError(err.response?.data?.message || "No autorizado");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
    }}>
      <div style={{
        width: 360,
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "40px 36px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
      }}>
        {/* Logo / título */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: "var(--accent)", margin: "0 auto 14px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
          }}>S</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            SistemaOnce
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            Pasteur 280 · Local 11
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)",
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
            }}>
              Email
            </div>
            <input
              className="input"
              type="email"
              placeholder="usuario@mail.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              autoFocus
              style={{ width: "100%", fontSize: 14 }}
            />
          </div>

          {/* Contraseña */}
          <div style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)",
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
            }}>
              Contraseña
            </div>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              style={{ width: "100%", fontSize: 16, letterSpacing: "0.1em" }}
            />
          </div>

          {error && (
            <div style={{
              marginTop: 10, padding: "8px 12px",
              background: "rgba(220,60,60,0.12)", border: "1px solid rgba(220,60,60,0.3)",
              borderRadius: 6, fontSize: 13, color: "var(--danger)", textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !email.trim() || !password.trim()}
            style={{ width: "100%", marginTop: 20, fontSize: 14, padding: "12px" }}
          >
            {loading ? "Ingresando..." : "Ingresar →"}
          </button>
        </form>

        {/* Separador */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>o</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Google */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <GoogleLogin
            onSuccess={handleGoogle}
            onError={() => setError("Error al iniciar sesión con Google")}
            text="signin_with"
            shape="rectangular"
            theme="outline"
            size="large"
            width="288"
          />
        </div>
      </div>
    </div>
  );
}
