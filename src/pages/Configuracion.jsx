import { useState, useEffect } from "react";
import { useToast } from "../utils/useToast";
import api from "../utils/api";

const fmt  = (v, dec = 2) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtU = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Calcula todos los precios a partir del costo USD y la configuración
function calcPrecios(costoUsd, config) {
  const base = Number(costoUsd || 0) * Number(config.cotizacion_dolar || 0);
  return [1, 2, 3, 4, 5].map((n) => {
    const pct = Number(config[`pct_${n}`] || 0);
    const precioArs = base * (1 + pct / 100);
    return {
      label: `Precio #${n}`,
      pct,
      ars: precioArs,
      usd: Number(costoUsd || 0) * (1 + pct / 100),
    };
  });
}

export default function Configuracion() {
  const { addToast, ToastContainer } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const [config, setConfig] = useState({
    cotizacion_dolar: "",
    pct_1: "", pct_2: "", pct_3: "", pct_4: "", pct_5: "",
  });

  // Para la preview de precios
  const [costoDemo, setCostoDemo] = useState("100");

  // ── Cargar configuración ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/config/precios");
        setConfig({
          cotizacion_dolar: String(data.cotizacion_dolar),
          pct_1: String(data.pct_1),
          pct_2: String(data.pct_2),
          pct_3: String(data.pct_3),
          pct_4: String(data.pct_4),
          pct_5: String(data.pct_5),
        });
      } catch {
        addToast("Error cargando configuración", "error");
      }
      setLoading(false);
    })();
  }, []);

  const setField = (key) => (e) => setConfig((p) => ({ ...p, [key]: e.target.value }));

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const payload = {
      cotizacion_dolar: Number(config.cotizacion_dolar),
      pct_1: Number(config.pct_1),
      pct_2: Number(config.pct_2),
      pct_3: Number(config.pct_3),
      pct_4: Number(config.pct_4),
      pct_5: Number(config.pct_5),
    };

    if (!payload.cotizacion_dolar || payload.cotizacion_dolar <= 0) {
      addToast("La cotización del dólar debe ser mayor a 0", "error");
      return;
    }

    setSaving(true);
    try {
      await api.put("/config/precios", payload);
      addToast("Configuración guardada", "success");
    } catch {
      addToast("Error guardando configuración", "error");
    }
    setSaving(false);
  };

  const precios = calcPrecios(costoDemo, config);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
        Cargando configuración...
      </div>
    );
  }

  return (
    <>
      <ToastContainer />
      <div style={{ padding: "32px 28px", maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0, marginBottom: 6 }}>
            ⚙️ Configuración de Precios
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0, lineHeight: 1.6 }}>
            Los precios de todos los productos se calculan automáticamente a partir del costo en USD y estos porcentajes.
            La tabla <code style={{ background: "var(--bg3)", padding: "1px 5px", borderRadius: 3, fontSize: 12 }}>product_prices</code> ya no se usa.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* ── Columna izquierda: config ── */}
          <div>
            <div className="card" style={{ padding: "24px 24px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>
                Cotización del dólar
              </div>

              <div className="input-group" style={{ marginBottom: 28 }}>
                <label className="input-label">USD → ARS (tipo de cambio)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--text-dim)" }}>$</span>
                  <input
                    className="input"
                    type="number"
                    value={config.cotizacion_dolar}
                    onChange={setField("cotizacion_dolar")}
                    placeholder="1000"
                    style={{ fontSize: 18, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent)", width: 160 }}
                  />
                  <span style={{ fontSize: 13, color: "var(--text-dim)" }}>pesos por dólar</span>
                </div>
              </div>

              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
                Porcentaje sobre costo (%)
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16, lineHeight: 1.5 }}>
                Precio final = Costo USD × Cotización × (1 + % / 100)
              </div>

              {[1, 2, 3, 4, 5].map((n) => (
                <div className="input-group" key={n} style={{ marginBottom: 14 }}>
                  <label className="input-label">Precio #{n} — porcentaje sobre costo</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      className="input"
                      type="number"
                      value={config[`pct_${n}`]}
                      onChange={setField(`pct_${n}`)}
                      placeholder="0"
                      style={{ width: 110, fontFamily: "var(--font-mono)", fontSize: 15, textAlign: "center" }}
                    />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--text-muted)" }}>%</span>
                    {config[`pct_${n}`] !== "" && (
                      <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                        → ×{(1 + Number(config[`pct_${n}`]) / 100).toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 28 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ width: "100%", fontSize: 14, padding: "12px" }}
                >
                  {saving ? "Guardando..." : "✓ Guardar configuración"}
                </button>
              </div>
            </div>
          </div>

          {/* ── Columna derecha: preview ── */}
          <div>
            <div className="card" style={{ padding: "24px 24px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
                Vista previa de precios
              </div>

              <div className="input-group" style={{ marginBottom: 20 }}>
                <label className="input-label">Costo de ejemplo (en USD)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)", fontSize: 14 }}>USD</span>
                  <input
                    className="input"
                    type="number"
                    value={costoDemo}
                    onChange={(e) => setCostoDemo(e.target.value)}
                    style={{ width: 110, fontFamily: "var(--font-mono)", fontSize: 15 }}
                  />
                </div>
              </div>

              {/* Tabla de precios calculados */}
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 70px", background: "var(--bg3)", borderBottom: "2px solid var(--border)" }}>
                  {["Precio", "Pesos (ARS)", "Dólares (USD)", "% sobre costo"].map((h) => (
                    <div key={h} style={{ padding: "8px 10px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {h}
                    </div>
                  ))}
                </div>

                {/* Fila: costo base */}
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 70px", borderBottom: "1px solid var(--border)", background: "var(--bg2)" }}>
                  <div style={{ padding: "10px 10px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Costo</div>
                  <div style={{ padding: "10px 10px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>
                    ${fmt(Number(costoDemo || 0) * Number(config.cotizacion_dolar || 0))}
                  </div>
                  <div style={{ padding: "10px 10px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>
                    USD {fmtU(costoDemo)}
                  </div>
                  <div style={{ padding: "10px 10px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>—</div>
                </div>

                {precios.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid", gridTemplateColumns: "100px 1fr 1fr 70px",
                      borderBottom: i < precios.length - 1 ? "1px solid var(--border)" : "none",
                      background: i % 2 === 0 ? "transparent" : "var(--bg2)",
                    }}
                  >
                    <div style={{ padding: "10px 10px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{p.label}</div>
                    <div style={{ padding: "10px 10px", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                      ${fmt(p.ars)}
                    </div>
                    <div style={{ padding: "10px 10px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>
                      USD {fmtU(p.usd)}
                    </div>
                    <div style={{ padding: "10px 10px", fontFamily: "var(--font-mono)", fontSize: 12, color: p.pct > 0 ? "var(--success)" : "var(--text-dim)" }}>
                      +{fmt(p.pct, 1)}%
                    </div>
                  </div>
                ))}
              </div>

              {/* Cotización actual */}
              <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cotización actual</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 800, color: "var(--accent)" }}>
                  $1 USD = ${fmt(config.cotizacion_dolar)} ARS
                </span>
              </div>
            </div>

            {/* Nota informativa */}
            <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-dim)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--text-muted)" }}>¿Cómo funciona?</strong><br />
              Cada producto tiene un <strong>Costo en USD</strong> (campo <code>costo_usd</code>).<br />
              Al mostrar precios, el sistema calcula:<br />
              <code style={{ display: "block", margin: "6px 0", padding: "4px 8px", background: "var(--bg2)", borderRadius: 4, fontSize: 11 }}>
                Precio N = costo_usd × cotización × (1 + pct_N / 100)
              </code>
              Así nunca tenés que actualizar los precios individualmente — solo actualizás la cotización o los porcentajes aquí.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
