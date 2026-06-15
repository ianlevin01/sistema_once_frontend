import { useState, useEffect } from "react";
import { useToast } from "../utils/useToast";
import api from "../utils/api";
import { getWarehouses, createWarehouse, getAIPermissions, updateAIPermission } from "../utils/api";
import { useAuth } from "../utils/useAuth";

const fmt  = (v, dec = 2) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtU = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ROUND_OPTS = [
  { val: 0,    lbl: "Sin redondeo" },
  { val: 1,    lbl: "Unidad"       },
  { val: 10,   lbl: "Decena"       },
  { val: 100,  lbl: "Centena"      },
  { val: 1000, lbl: "Millar"       },
];

// Calcula todos los precios a partir del costo USD y la configuración
// Aplica redondeo hacia arriba si round_precio_N está configurado
function calcPrecios(costoUsd, config) {
  const base = Number(costoUsd || 0) * Number(config.cotizacion_dolar || 0);
  return [1, 2, 3, 4, 5].map((n) => {
    const pct       = Number(config[`pct_${n}`] || 0);
    let   ars       = base * (1 + pct / 100);
    const roundUnit = Number(config[`round_precio_${n}`] || 0);
    if (roundUnit > 0) {
      ars = Math.ceil(ars / roundUnit) * roundUnit;
    }
    return {
      label: `Precio #${n}`,
      pct,
      ars,
      usd: Number(costoUsd || 0) * (1 + pct / 100),
      roundUnit,
    };
  });
}

export default function Configuracion() {
  useEffect(() => { document.title = "Configuración — Once"; }, []);
  const { addToast, ToastContainer } = useToast();
  const { user } = useAuth();
  const isVendedor = user?.role === "vendedor";

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // ── Depósitos ─────────────────────────────────────────────────
  const [warehouses,         setWarehouses]         = useState([]);
  const [newWhName,          setNewWhName]          = useState("");
  const [savingWh,           setSavingWh]           = useState(false);
  const [preferredWarehouse, setPreferredWarehouse] = useState("");
  const [savingPw,           setSavingPw]           = useState(false);

  // ── Permisos Asistente IA ─────────────────────────────────────
  const [aiPerms,      setAiPerms]      = useState({});
  const [savingAiPerm, setSavingAiPerm] = useState(null);

  // ── Estado admin ──────────────────────────────────────────────
  const [config, setConfig] = useState({
    cotizacion_dolar: "",
    pct_1: "", pct_2: "", pct_3: "", pct_4: "", pct_5: "",
    round_precio_1: 0, round_precio_2: 0, round_precio_3: 0, round_precio_4: 0, round_precio_5: 0,
  });
  const [costoDemo, setCostoDemo] = useState("100");

  // ── Estado vendedor ───────────────────────────────────────────
  const [pct, setPct] = useState(user?.pct_vendedor ?? 0);

  useEffect(() => {
    if (isVendedor) { setLoading(false); return; }
    (async () => {
      try {
        const [{ data: cfg }, { data: whs }, { data: aiPermsData }] = await Promise.all([
          api.get("/config/precios"),
          getWarehouses(),
          getAIPermissions(),
        ]);
        setConfig({
          cotizacion_dolar: String(cfg.cotizacion_dolar),
          pct_1: String(cfg.pct_1),
          pct_2: String(cfg.pct_2),
          pct_3: String(cfg.pct_3),
          pct_4: String(cfg.pct_4),
          pct_5: String(cfg.pct_5),
          round_precio_1: Number(cfg.round_precio_1 || 0),
          round_precio_2: Number(cfg.round_precio_2 || 0),
          round_precio_3: Number(cfg.round_precio_3 || 0),
          round_precio_4: Number(cfg.round_precio_4 || 0),
          round_precio_5: Number(cfg.round_precio_5 || 0),
        });
        setPreferredWarehouse(cfg.preferred_warehouse_id ?? "");
        setWarehouses(whs || []);
        const permMap = {};
        for (const p of (aiPermsData || [])) permMap[p.section] = p;
        setAiPerms(permMap);
      } catch {
        addToast("Error cargando configuración", "error");
      }
      setLoading(false);
    })();
  }, []);

  const setField = (key) => (e) => setConfig((p) => ({ ...p, [key]: e.target.value }));
  const setRound = (n, val) => setConfig((p) => ({ ...p, [`round_precio_${n}`]: val }));

  // ── Guardar admin ─────────────────────────────────────────────
  const handleSave = async () => {
    const payload = {
      cotizacion_dolar: Number(config.cotizacion_dolar),
      pct_1: Number(config.pct_1), pct_2: Number(config.pct_2),
      pct_3: Number(config.pct_3), pct_4: Number(config.pct_4),
      pct_5: Number(config.pct_5),
      round_precio_1: config.round_precio_1 || null,
      round_precio_2: config.round_precio_2 || null,
      round_precio_3: config.round_precio_3 || null,
      round_precio_4: config.round_precio_4 || null,
      round_precio_5: config.round_precio_5 || null,
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

  // ── Guardar vendedor ──────────────────────────────────────────
  const handleSavePct = async () => {
    if (isNaN(Number(pct)) || Number(pct) < 0) {
      addToast("Ingresá un porcentaje válido", "error");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/auth/pct-vendedor", { pct_vendedor: Number(pct) });
      const updated = { ...user, pct_vendedor: Number(pct) };
      localStorage.setItem("auth_user", JSON.stringify(updated));
      addToast("Porcentaje guardado", "success");
    } catch {
      addToast("Error guardando porcentaje", "error");
    }
    setSaving(false);
  };

  const handleSavePreferred = async (whId) => {
    setSavingPw(true);
    try {
      await api.patch("/config/preferred-warehouse", { preferred_warehouse_id: whId || null });
      setPreferredWarehouse(whId);
      addToast("Depósito de preferencia guardado", "success");
    } catch {
      addToast("Error guardando depósito de preferencia", "error");
    }
    setSavingPw(false);
  };

  const handleAddWarehouse = async () => {
    const name = newWhName.trim();
    if (!name) { addToast("Ingresá un nombre para el depósito", "error"); return; }
    setSavingWh(true);
    try {
      const { data } = await createWarehouse(name);
      setWarehouses((prev) => [...prev, data]);
      setNewWhName("");
      addToast(`Depósito "${name}" creado`, "success");
    } catch (err) {
      const msg = err?.response?.data?.message || "Error creando depósito";
      addToast(msg, "error");
    }
    setSavingWh(false);
  };

  // can_create: true = esta sección también tiene acciones de escritura habilitables
  const AI_SECTIONS = [
    { key: "clientes",         label: "Clientes",         can_create: true,  readDesc: "Buscar clientes por nombre o documento",                   createDesc: "Crear nuevos clientes" },
    { key: "cuenta_corriente", label: "Cuenta Corriente", can_create: true,  readDesc: "Consultar saldo y movimientos de cuentas",                  createDesc: "Abrir cuentas · Registrar cobranzas y cargos" },
    { key: "proveedores",      label: "Proveedores",      can_create: true,  readDesc: "Buscar proveedores y consultar su cuenta corriente",        createDesc: "Registrar movimientos en cuentas de proveedores" },
    { key: "productos",        label: "Productos",        can_create: false, readDesc: "Buscar productos por nombre o código",                      createDesc: null },
    { key: "stock",            label: "Stock",            can_create: true,  readDesc: "Consultar depósitos y movimientos de stock por producto",   createDesc: "Agregar unidades de stock a productos" },
    { key: "comprobantes",     label: "Comprobantes",     can_create: false, readDesc: "Listar y consultar comprobantes con detalle de items",      createDesc: null },
  ];

  const handleToggleAIPerm = async (section, field, value) => {
    setSavingAiPerm(section + field);
    const current = aiPerms[section] || {};
    const updated = { ...current, [field]: value };
    try {
      await updateAIPermission(section, updated);
      setAiPerms((prev) => ({ ...prev, [section]: { ...current, ...updated } }));
    } catch {
      addToast("Error guardando permiso", "error");
    }
    setSavingAiPerm(null);
  };

  const precios = calcPrecios(costoDemo, config);

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:13 }}>
        Cargando configuración...
      </div>
    );
  }

  // ── VISTA VENDEDOR ────────────────────────────────────────────
  if (isVendedor) {
    const precio1Ejemplo = 10000;
    const precioPublicacion = precio1Ejemplo * (1 + Number(pct) / 100);
    const ganancia = (precioPublicacion - precio1Ejemplo) / 2;

    return (
      <>
        <ToastContainer />
        <div style={{ maxWidth:480, margin:"0 auto", paddingTop:24 }}>
          <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
            <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", background:"var(--bg3)" }}>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>Mi configuración</div>
              <div style={{ fontSize:12, color:"var(--text-dim)", marginTop:2 }}>
                Ajustá tu porcentaje de ganancia sobre el precio base
              </div>
            </div>
            <div style={{ padding:"24px 20px", display:"flex", flexDirection:"column", gap:20 }}>
              <div className="input-group" style={{ marginBottom:0 }}>
                <label className="input-label">Mi porcentaje de ganancia (%)</label>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <input
                    className="input" type="number" min="0" max="999" step="0.5"
                    value={pct} onChange={(e) => setPct(e.target.value)}
                    style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700, width:120, textAlign:"center" }}
                  />
                  <span style={{ fontSize:20, color:"var(--text-dim)" }}>%</span>
                </div>
              </div>

              <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:16 }}>
                <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>
                  Ejemplo con precio base $10.000
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:"var(--text-muted)" }}>Precio base (costo)</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:13 }}>${precio1Ejemplo.toLocaleString("es-AR")}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:"var(--text-muted)" }}>Tu porcentaje ({pct}%)</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:13 }}>
                      + ${(precioPublicacion - precio1Ejemplo).toLocaleString("es-AR", { minimumFractionDigits:2 })}
                    </span>
                  </div>
                  <div style={{ height:1, background:"var(--border)", margin:"4px 0" }} />
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"var(--accent)" }}>Precio de publicación</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, color:"var(--accent)" }}>
                      ${precioPublicacion.toLocaleString("es-AR", { minimumFractionDigits:2 })}
                    </span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, padding:"8px 10px", background:"var(--success-dim)", border:"1px solid var(--success)", borderRadius:6 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"var(--success)" }}>Tu ganancia por venta</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, color:"var(--success)" }}>
                      ${ganancia.toLocaleString("es-AR", { minimumFractionDigits:2 })}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize:10, color:"var(--text-dim)", marginTop:10, fontFamily:"var(--font-mono)" }}>
                  * La ganancia es (precio publicación − precio base) ÷ 2
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleSavePct} disabled={saving}
                style={{ width:"100%", padding:10, fontSize:14 }}>
                {saving ? "Guardando..." : "Guardar porcentaje"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── VISTA ADMIN (tu código original intacto) ──────────────────
  return (
    <>
      <ToastContainer />
      <div style={{ padding:"32px 28px", maxWidth:860, margin:"0 auto" }}>
        <div style={{ marginBottom:32 }}>
          <h1 style={{ fontFamily:"var(--font-mono)", fontSize:22, fontWeight:800, color:"var(--text)", margin:0, marginBottom:6 }}>
            ⚙️ Configuración de Precios
          </h1>
          <p style={{ fontSize:13, color:"var(--text-dim)", margin:0, lineHeight:1.6 }}>
            Los precios de todos los productos se calculan automáticamente a partir del costo en USD y estos porcentajes.
            La tabla <code style={{ background:"var(--bg3)", padding:"1px 5px", borderRadius:3, fontSize:12 }}>product_prices</code> ya no se usa.
          </p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
          <div>
            <div className="card" style={{ padding:"24px 24px" }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:20 }}>
                Cotización del dólar
              </div>
              <div className="input-group" style={{ marginBottom:28 }}>
                <label className="input-label">USD → ARS (tipo de cambio)</label>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:16, color:"var(--text-dim)" }}>$</span>
                  <input className="input" type="number" value={config.cotizacion_dolar}
                    onChange={setField("cotizacion_dolar")} placeholder="1000"
                    style={{ fontSize:18, fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", width:160 }} />
                  <span style={{ fontSize:13, color:"var(--text-dim)" }}>pesos por dólar</span>
                </div>
              </div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 }}>
                Porcentaje sobre costo (%)
              </div>
              <div style={{ fontSize:12, color:"var(--text-dim)", marginBottom:16, lineHeight:1.5 }}>
                Precio final = Costo USD × Cotización × (1 + % / 100)
              </div>
              {[1,2,3,4,5].map((n) => (
                <div key={n} style={{ marginBottom:16, paddingBottom:16, borderBottom:"1px solid var(--border)" }}>
                  <div className="input-group" style={{ marginBottom:8 }}>
                    <label className="input-label">Precio #{n} — porcentaje sobre costo</label>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <input className="input" type="number" value={config[`pct_${n}`]}
                        onChange={setField(`pct_${n}`)} placeholder="0"
                        style={{ width:110, fontFamily:"var(--font-mono)", fontSize:15, textAlign:"center" }} />
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:15, color:"var(--text-muted)" }}>%</span>
                      {config[`pct_${n}`] !== "" && (
                        <span style={{ fontSize:12, color:"var(--text-dim)" }}>
                          → ×{(1 + Number(config[`pct_${n}`]) / 100).toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                    <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", marginRight:2, whiteSpace:"nowrap" }}>
                      Redondeo ↑
                    </span>
                    {ROUND_OPTS.map((opt) => {
                      const active = config[`round_precio_${n}`] === opt.val;
                      return (
                        <button key={opt.val} onClick={() => setRound(n, opt.val)}
                          style={{
                            padding:"3px 10px", borderRadius:4, cursor:"pointer", fontSize:11,
                            fontFamily:"var(--font-mono)",
                            border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                            background: active ? "var(--accent)" : "transparent",
                            color: active ? "#fff" : "var(--text-dim)",
                            fontWeight: active ? 700 : 400,
                            transition: "background 0.1s, border-color 0.1s",
                          }}
                        >{opt.lbl}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ marginTop:28 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}
                  style={{ width:"100%", fontSize:14, padding:12 }}>
                  {saving ? "Guardando..." : "✓ Guardar configuración"}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="card" style={{ padding:"24px 24px" }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 }}>
                Vista previa de precios
              </div>
              <div className="input-group" style={{ marginBottom:20 }}>
                <label className="input-label">Costo de ejemplo (en USD)</label>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontFamily:"var(--font-mono)", color:"var(--text-dim)", fontSize:14 }}>USD</span>
                  <input className="input" type="number" value={costoDemo}
                    onChange={(e) => setCostoDemo(e.target.value)}
                    style={{ width:110, fontFamily:"var(--font-mono)", fontSize:15 }} />
                </div>
              </div>
              <div style={{ border:"1px solid var(--border)", borderRadius:8, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"100px 1fr 1fr 70px", background:"var(--bg3)", borderBottom:"2px solid var(--border)" }}>
                  {["Precio","Pesos (ARS)","Dólares (USD)","% sobre costo"].map((h) => (
                    <div key={h} style={{ padding:"8px 10px", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</div>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"100px 1fr 1fr 70px", borderBottom:"1px solid var(--border)", background:"var(--bg2)" }}>
                  <div style={{ padding:"10px 10px", fontFamily:"var(--font-mono)", fontSize:12, fontWeight:700, color:"var(--text-muted)" }}>Costo</div>
                  <div style={{ padding:"10px 10px", fontFamily:"var(--font-mono)", fontSize:13, color:"var(--text-muted)" }}>
                    ${fmt(Number(costoDemo||0) * Number(config.cotizacion_dolar||0))}
                  </div>
                  <div style={{ padding:"10px 10px", fontFamily:"var(--font-mono)", fontSize:13, color:"var(--text-muted)" }}>USD {fmtU(costoDemo)}</div>
                  <div style={{ padding:"10px 10px", fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-dim)" }}>—</div>
                </div>
                {precios.map((p, i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"100px 1fr 1fr 70px", borderBottom: i < precios.length-1 ? "1px solid var(--border)" : "none", background: i%2===0 ? "transparent" : "var(--bg2)" }}>
                    <div style={{ padding:"10px 10px", fontFamily:"var(--font-mono)", fontSize:12, fontWeight:700, color:"var(--accent)" }}>{p.label}</div>
                    <div style={{ padding:"10px 10px", fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color:"var(--text)", display:"flex", alignItems:"center", gap:6 }}>
                      ${fmt(p.ars)}
                      {p.roundUnit > 0 && (
                        <span style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--accent)", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:3, padding:"1px 4px", whiteSpace:"nowrap" }}>
                          ↑{p.roundUnit === 1 ? "uni" : p.roundUnit === 10 ? "dec" : p.roundUnit === 100 ? "cen" : "mil"}
                        </span>
                      )}
                    </div>
                    <div style={{ padding:"10px 10px", fontFamily:"var(--font-mono)", fontSize:13, color:"var(--text-muted)" }}>USD {fmtU(p.usd)}</div>
                    <div style={{ padding:"10px 10px", fontFamily:"var(--font-mono)", fontSize:12, color: p.pct > 0 ? "var(--success)" : "var(--text-dim)" }}>+{fmt(p.pct,1)}%</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:16, padding:"10px 14px", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:12, color:"var(--text-muted)" }}>Cotización actual</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:16, fontWeight:800, color:"var(--accent)" }}>
                  $1 USD = ${fmt(config.cotizacion_dolar)} ARS
                </span>
              </div>
            </div>
            <div style={{ marginTop:16, padding:"12px 16px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, fontSize:12, color:"var(--text-dim)", lineHeight:1.7 }}>
              <strong style={{ color:"var(--text-muted)" }}>¿Cómo funciona?</strong><br />
              Cada producto tiene un <strong>Costo en USD</strong> (campo <code>costo_usd</code>).<br />
              Al mostrar precios, el sistema calcula:<br />
              <code style={{ display:"block", margin:"6px 0", padding:"4px 8px", background:"var(--bg2)", borderRadius:4, fontSize:11 }}>
                Precio N = costo_usd × cotización × (1 + pct_N / 100)
              </code>
              Así nunca tenés que actualizar los precios individualmente.
            </div>
          </div>
        </div>

        {/* ── Depósitos ── */}
        <div style={{ marginTop:32 }}>
          <div className="card" style={{ padding:"24px 24px" }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 }}>
              Depósitos (warehouses)
            </div>

            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              <input
                className="input"
                placeholder="Nombre del nuevo depósito"
                value={newWhName}
                onChange={(e) => setNewWhName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddWarehouse()}
                style={{ flex:1, maxWidth:320 }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleAddWarehouse} disabled={savingWh}>
                {savingWh ? "Creando..." : "+ Agregar depósito"}
              </button>
            </div>

            {warehouses.length === 0 ? (
              <div style={{ fontSize:13, color:"var(--text-dim)", padding:"12px 0" }}>No hay depósitos cargados.</div>
            ) : (
              <>
                <div style={{ border:"1px solid var(--border)", borderRadius:8, overflow:"hidden", marginBottom:16 }}>
                  {warehouses.map((w, i) => (
                    <div key={w.id} style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"10px 16px",
                      borderBottom: i < warehouses.length - 1 ? "1px solid var(--border)" : "none",
                      background: i % 2 === 0 ? "transparent" : "var(--bg2)",
                    }}>
                      <span style={{ fontSize:14, color:"var(--text)" }}>{w.name}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)" }}>{w.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <label style={{ fontSize:13, color:"var(--text-dim)", whiteSpace:"nowrap" }}>Depósito de preferencia (Reposiciones):</label>
                  <select
                    className="input"
                    style={{ flex:1, maxWidth:280 }}
                    value={preferredWarehouse}
                    onChange={(e) => handleSavePreferred(e.target.value)}
                    disabled={savingPw}
                  >
                    <option value="">— Sin preferencia —</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
        {/* ── Asistente IA ── */}
        <div style={{ marginTop:32 }}>
          <div className="card" style={{ padding:"24px 24px" }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>
              Asistente IA — Permisos
            </div>
            <div style={{ fontSize:12, color:"var(--text-dim)", marginBottom:20, lineHeight:1.5 }}>
              Habilitá qué puede consultar y modificar el asistente. Solo los administradores pueden usarlo.
              Las acciones de modificación siempre piden confirmación antes de ejecutarse.
            </div>

            {/* Encabezados */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 110px 110px", gap:0, marginBottom:4, padding:"0 18px" }}>
              <div />
              <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", textAlign:"center" }}>Consultar</div>
              <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", textAlign:"center" }}>Modificar</div>
            </div>

            <div style={{ border:"1px solid var(--border)", borderRadius:8, overflow:"hidden" }}>
              {AI_SECTIONS.map((s, i) => {
                const perm        = aiPerms[s.key] || {};
                const readEnabled = !!perm.can_read;
                const writeEnabled= !!perm.can_create;
                const savingRead  = savingAiPerm === s.key + "can_read";
                const savingWrite = savingAiPerm === s.key + "can_create";

                const Toggle = ({ enabled, saving, onToggle }) => (
                  <div style={{ display:"flex", justifyContent:"center", alignItems:"center" }}>
                    <div
                      onClick={() => !saving && onToggle()}
                      style={{
                        width:42, height:24, borderRadius:12, position:"relative",
                        background: enabled ? "var(--success)" : "var(--border)",
                        cursor: saving ? "default" : "pointer",
                        opacity: saving ? 0.5 : 1,
                        transition: "background 0.2s, opacity 0.15s",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position:"absolute", top:3, left: enabled ? 21 : 3,
                        width:18, height:18, borderRadius:"50%", background:"#fff",
                        boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
                        transition:"left 0.2s",
                      }} />
                    </div>
                  </div>
                );

                return (
                  <div key={s.key} style={{
                    display:"grid", gridTemplateColumns:"1fr 110px 110px",
                    alignItems:"center",
                    padding:"14px 18px",
                    borderBottom: i < AI_SECTIONS.length - 1 ? "1px solid var(--border)" : "none",
                    background: i % 2 === 0 ? "transparent" : "var(--bg2)",
                  }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:2 }}>{s.label}</div>
                      <div style={{ fontSize:11, color:"var(--text-dim)" }}>
                        {readEnabled ? s.readDesc : s.readDesc}
                        {s.can_create && writeEnabled && ` · ${s.createDesc}`}
                      </div>
                    </div>

                    <Toggle
                      enabled={readEnabled}
                      saving={savingRead}
                      onToggle={() => handleToggleAIPerm(s.key, "can_read", !readEnabled)}
                    />

                    {s.can_create ? (
                      <Toggle
                        enabled={writeEnabled}
                        saving={savingWrite}
                        onToggle={() => handleToggleAIPerm(s.key, "can_create", !writeEnabled)}
                      />
                    ) : (
                      <div style={{ textAlign:"center", fontSize:12, color:"var(--text-dim)" }}>—</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}