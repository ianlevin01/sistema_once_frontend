import { useState, useEffect, useRef } from "react";
import {
  searchCustomers, getCustomer,
  createCustomer, updateCustomer, deleteCustomer,
  getCuentaCorrienteCliente, getCuentaCorrienteGeneral,
  registrarPagoCC, registrarCobranzaCC,
  searchProveedores, getProveedor,
  createProveedor, updateProveedor, deleteProveedor,
  getCCProveedor,
  registrarPagoProveedor, registrarCobranzaProveedor,
  getProveedores,
} from "../utils/api";
import { useToast } from "../utils/useToast";

// ─── Constantes ───────────────────────────────────────────────
const EMPTY_CLIENTE = {
  name:"", type:"minorista", document:"", phone:"", email:"",
  domicilio:"", localidad:"", provincia:"", codigo_postal:"",
  contacto:"", descuento:"", dias_plazo:"", transporte:"DON ALFREDO",
  condicion_iva:"Consumidor Final", vendedor:"", cuenta_pesos:"", cuenta_dolares:"",
};
const EMPTY_PROVEEDOR = {
  name:"", type:"", document:"", phone:"", email:"",
  domicilio:"", localidad:"", provincia:"", codigo_postal:"",
  contacto:"", descuento:"", dias_plazo:"", transporte:"",
  condicion_iva:"Resp. Inscripto", vendedor:"", cuenta_pesos:"", cuenta_dolares:"",
};
const COND_IVA    = ["Resp. Inscripto","Resp. Monotributo","Consumidor Final","Exento"];
const TRANSPORTES = ["DON ALFREDO","VIA CARGO","CORREO","OCA","ANDREANI","RETIRA"];

// ─── Helpers ──────────────────────────────────────────────────
const fmtARS  = (n) => `$${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-AR") : "—";

const LBL = ({ children }) => (
  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>
    {children}
  </div>
);
const ROW = ({ label, value, mono }) => (
  <div style={{ marginBottom:10 }}>
    <LBL>{label}</LBL>
    <div style={{ fontSize:13, color: value ? "var(--text)" : "var(--text-dim)", fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)" }}>
      {value || "—"}
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════
// PANEL GENÉRICO
// ════════════════════════════════════════════════════════════
function EntityPanel({
  mode,
  searchFn,
  getFn,
  createFn,
  updateFn,
  deleteFn,
  getCCFn,
  registrarCobranzaFn,
  emptyForm,
  addToast,
}) {
  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState([]);
  const [loadingList,   setLoadingList]   = useState(false);
  const [selected,      setSelected]      = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [editing,       setEditing]       = useState(false);
  const [isNew,         setIsNew]         = useState(false);
  const [form,          setForm]          = useState(emptyForm);
  const [saving,        setSaving]        = useState(false);

  const [cc,        setCC]        = useState(null);
  const [loadingCC, setLoadingCC] = useState(false);
  const [viewCC,    setViewCC]    = useState(false);

  const [modalCobranza,  setModalCobranza]  = useState(false);
  const [formCobranza,   setFormCobranza]   = useState({ monto:"", concepto:"", metodo_pago:"Efectivo" });
  const [savingCobranza, setSavingCobranza] = useState(false);

  const METODOS_COBRANZA = ["Efectivo","Cheque","Depósito","Tarjeta","Mercpago"];
  const listRef = useRef(null);
  const label   = mode === "cliente" ? "Cliente" : "Proveedor";

  // Búsqueda
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoadingList(true);
      try {
        const res  = await searchFn(query);
        const data = Array.isArray(res) ? res : res.data;
        setResults(data);
        setSelectedIndex(-1);
      } catch { addToast(`Error buscando ${label.toLowerCase()}s`, "error"); }
      setLoadingList(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Navegación teclado
  useEffect(() => {
    const handleKey = (e) => {
      if (results.length === 0 || editing) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.min(prev + 1, results.length - 1);
          selectEntity(results[next], next);
          listRef.current?.children[next]?.scrollIntoView({ block:"nearest", behavior:"smooth" });
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          selectEntity(results[next], next);
          listRef.current?.children[next]?.scrollIntoView({ block:"nearest", behavior:"smooth" });
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [results, editing]);

  const selectEntity = async (c, idx) => {
    if (idx !== undefined) setSelectedIndex(idx);
    setSelected({ ...c, _loading: true });
    setEditing(false); setIsNew(false); setViewCC(false); setCC(null);
    setLoadingDetail(true);
    try {
      const res  = await getFn(c.id);
      const data = res.data || res;
      setSelected(data);
    } catch { addToast(`Error cargando ${label.toLowerCase()}`, "error"); }
    setLoadingDetail(false);
  };

  const loadCC = async (id) => {
    setLoadingCC(true);
    try {
      const res  = await getCCFn(id);
      const data = res.data || res;
      setCC(data);
    } catch { addToast("Error cargando cuenta corriente", "error"); }
    setLoadingCC(false);
  };

  const handleVerCC = () => { setViewCC(true); if (!cc) loadCC(selected.id); };

  const handleCobranza = async () => {
    const monto = Number(formCobranza.monto);
    if (!monto || monto <= 0) { addToast("Monto inválido", "error"); return; }
    setSavingCobranza(true);
    try {
      await registrarCobranzaFn(selected.id, {
        monto, concepto: formCobranza.concepto || "Cobranza", metodo_pago: formCobranza.metodo_pago,
      });
      addToast("Cobranza registrada", "success");
      setModalCobranza(false);
      setFormCobranza({ monto:"", concepto:"", metodo_pago:"Efectivo" });
      loadCC(selected.id);
    } catch (err) { addToast(err.response?.data?.message || "Error", "error"); }
    setSavingCobranza(false);
  };

  const openNew  = () => { setForm(emptyForm); setSelected(null); setIsNew(true); setEditing(true); setViewCC(false); };
  const openEdit = () => {
    if (!selected) return;
    setForm(Object.fromEntries(
      Object.keys(emptyForm).map((k) => [k, selected[k] ?? ""])
    ));
    setIsNew(false); setEditing(true); setViewCC(false);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { addToast("El nombre es obligatorio", "error"); return; }
    setSaving(true);
    try {
      if (isNew) {
        const res  = await createFn(form);
        const data = res.data || res;
        addToast(`${label} creado`, "success");
        setEditing(false); setIsNew(false);
        if (query) {
          const r = await searchFn(query);
          setResults(Array.isArray(r) ? r : r.data);
        }
        const det = await getFn(data.id);
        setSelected(det.data || det);
      } else {
        await updateFn(selected.id, form);
        setSelected((prev) => ({ ...prev, ...form }));
        addToast(`${label} actualizado`, "success");
        setEditing(false);
      }
    } catch { addToast("Error guardando", "error"); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selected || !confirm(`¿Eliminar a "${selected.name}"?`)) return;
    try {
      await deleteFn(selected.id);
      addToast(`${label} eliminado`, "success");
      setSelected(null); setEditing(false); setCC(null); setViewCC(false);
      setResults((prev) => prev.filter((c) => c.id !== selected.id));
    } catch { addToast("Error eliminando", "error"); }
  };

  const f   = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const INP = ({ label: lbl, k, type="text", placeholder="" }) => (
    <div className="input-group">
      <label className="input-label">{lbl}</label>
      <input className="input" type={type} value={form[k] ?? ""} onChange={f(k)} placeholder={placeholder} />
    </div>
  );

  // ── Render cuenta corriente ──────────────────────────────────
  const renderCC = () => {
    if (loadingCC) return (
      <div style={{ padding:40, textAlign:"center", color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:12 }}>Cargando...</div>
    );

    const cuenta      = cc?.cuenta || cc;
    const movimientos = cc?.movimientos || cuenta?.movimientos || [];
    const saldo       = Number(cuenta?.saldo || 0);

    if (!cuenta) return (
      <div style={{ padding:40, textAlign:"center", color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:12 }}>Sin cuenta corriente</div>
    );

    // Para clientes: saldo positivo = debe; negativo = saldo a favor
    // Para proveedores: saldo positivo = les debemos (saldo a favor del proveedor)
    const esProveedor  = mode === "proveedor";
    const saldoColor   = esProveedor
      ? (saldo > 0 ? "var(--danger)" : "var(--success)")
      : (saldo > 0 ? "var(--danger)" : "var(--success)");
    const saldoLabel   = esProveedor
      ? (saldo > 0 ? "Le debemos" : "Sin deuda")
      : (saldo > 0 ? "Debe" : "Saldo a favor");

    return (
      <div>
        <div style={{ display:"flex", gap:16, marginBottom:28 }}>
          <div style={{ flex:1, background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8, padding:"18px 22px" }}>
            <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
              Saldo en pesos
            </div>
            <div style={{ fontSize:28, fontFamily:"var(--font-mono)", fontWeight:800, color: saldoColor }}>
              {fmtARS(Math.abs(saldo))}
            </div>
            <div style={{ fontSize:11, color:"var(--text-dim)", marginTop:4 }}>{saldoLabel}</div>
          </div>
        </div>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>
          Movimientos ({movimientos.length})
        </div>
        {!movimientos.length ? (
          <div style={{ color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:12, padding:"24px 0" }}>Sin movimientos</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
            <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 150px 130px 80px", gap:12, padding:"8px 12px", background:"var(--bg3)", borderRadius:"6px 6px 0 0", borderBottom:"2px solid var(--border)" }}>
              {["Fecha","Concepto","Método","Monto","Tipo"].map((h) => (
                <div key={h} style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</div>
              ))}
            </div>
            {movimientos.map((m) => (
              <div key={m.id} style={{ display:"grid", gridTemplateColumns:"120px 1fr 150px 130px 80px", gap:12, padding:"11px 12px", borderBottom:"1px solid var(--border)", alignItems:"center", background:"var(--bg)" }}>
                <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{fmtDate(m.created_at)}</span>
                <span style={{ fontSize:13 }}>{m.concepto || "—"}</span>
                <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{m.metodo_pago || "—"}</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color: m.tipo === "debito" ? "var(--danger)" : "var(--success)" }}>
                  {m.tipo === "debito" ? "+" : "−"}{fmtARS(m.monto)}
                </span>
                <span className={`badge ${m.tipo === "debito" ? "badge-danger" : "badge-success"}`}>
                  {m.tipo === "debito" ? "Débito" : esProveedor ? "Crédito" : "Pago"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display:"flex", height:"calc(100vh - 56px - 80px)", overflow:"hidden" }}>
      {/* Panel izquierdo */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--bg)", borderRight:"1px solid var(--border)" }}>
        {/* Header */}
        <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--bg2)", flexShrink:0 }}>
          <div>
            {editing ? (
              <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                {isNew ? `Nuevo ${label.toLowerCase()}` : `Editando — ${selected?.name}`}
              </span>
            ) : selected ? (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>{selected.name}</span>
                {selected.type && <span className="badge badge-info">{selected.type}</span>}
                <div style={{ marginLeft:16, display:"flex", gap:4 }}>
                  <button onClick={() => setViewCC(false)}
                    style={{ fontSize:12, padding:"4px 12px", borderRadius:4, border:"1px solid var(--border)", cursor:"pointer",
                      background: !viewCC ? "var(--accent)" : "transparent",
                      color:      !viewCC ? "#fff" : "var(--text-muted)" }}>Ficha</button>
                  <button onClick={handleVerCC}
                    style={{ fontSize:12, padding:"4px 12px", borderRadius:4, border:"1px solid var(--border)", cursor:"pointer",
                      background: viewCC ? "var(--accent)" : "transparent",
                      color:      viewCC ? "#fff" : "var(--text-muted)" }}>Cta Cte</button>
                </div>
              </div>
            ) : (
              <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", letterSpacing:"0.1em", textTransform:"uppercase" }}>
                Seleccioná un {label.toLowerCase()} →
              </span>
            )}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {editing ? (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setIsNew(false); }}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
              </>
            ) : viewCC && selected ? (
              /* ── Solo UN botón en la vista de cta cte ── */
              <button className="btn btn-primary btn-sm" onClick={() => setModalCobranza(true)}>
                {mode === "proveedor" ? "Registrar pago" : "+ Registrar cobranza"}
              </button>
            ) : (
              <>
                <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nuevo</button>
                {selected && <>
                  <button className="btn btn-ghost btn-sm"  onClick={openEdit}>✏️ Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑️</button>
                </>}
              </>
            )}
          </div>
        </div>

        {/* Contenido */}
        <div style={{ flex:1, overflowY:"auto", padding:24 }}>
          {editing ? (
            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Datos</div>
              <div className="grid-2">
                <INP label="Nombre *" k="name" placeholder="Razón social o nombre" />
                <INP label="C.U.I.T." k="document" placeholder="20-12345678-9" />
              </div>
              <INP label="Domicilio" k="domicilio" placeholder="Dirección" />
              <div className="grid-3">
                <INP label="Localidad" k="localidad" />
                <INP label="Provincia" k="provincia" />
                <INP label="C.P."      k="codigo_postal" />
              </div>
              <div className="grid-2">
                <INP label="Teléfono" k="phone" />
                <INP label="Contacto" k="contacto" />
              </div>
              <INP label="Email" k="email" type="email" />
              <hr className="divider" />
              <div className="grid-3">
                {mode === "cliente" && (
                  <div className="input-group">
                    <label className="input-label">Tipo</label>
                    <select className="select" value={form.type} onChange={f("type")}>
                      <option value="minorista">Minorista</option>
                      <option value="mayorista">Mayorista</option>
                    </select>
                  </div>
                )}
                <INP label="Descuento (%)" k="descuento" type="number" placeholder="0" />
                <INP label="Días de plazo" k="dias_plazo" type="number" placeholder="0" />
              </div>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">Condición ante el IVA</label>
                  <select className="select" value={form.condicion_iva} onChange={f("condicion_iva")}>
                    {COND_IVA.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {mode === "cliente" && (
                  <div className="input-group">
                    <label className="input-label">Transporte</label>
                    <select className="select" value={form.transporte} onChange={f("transporte")}>
                      {TRANSPORTES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid-2">
                <INP label="Vendedor"      k="vendedor" />
                <INP label="Cuenta Pesos"  k="cuenta_pesos" />
              </div>
              <INP label="Cuenta Dólares" k="cuenta_dolares" />
            </div>
          ) : !selected ? (
            <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, color:"var(--text-dim)" }}>
              <span style={{ fontSize:48 }}>{mode === "cliente" ? "👤" : "🏢"}</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:12, letterSpacing:"0.08em" }}>Buscá y seleccioná un {label.toLowerCase()} →</span>
            </div>
          ) : loadingDetail ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:12 }}>Cargando...</div>
          ) : viewCC ? renderCC() : (
            <div style={{ display:"flex", gap:32 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Datos</div>
                <ROW label="Nombre"        value={selected.name} />
                <ROW label="Domicilio"     value={selected.domicilio} />
                <ROW label="Localidad"     value={selected.localidad} />
                <ROW label="Provincia"     value={selected.provincia} />
                <ROW label="Código Postal" value={selected.codigo_postal} mono />
                <ROW label="C.U.I.T."      value={selected.document} mono />
                <ROW label="Contacto"      value={selected.contacto} />
                <ROW label="Teléfono"      value={selected.phone} mono />
                <ROW label="Email"         value={selected.email} />
                <hr className="divider" />
                <ROW label="Condición IVA" value={selected.condicion_iva} />
                <ROW label="Descuento"     value={selected.descuento != null ? `${selected.descuento}%` : null} mono />
                <ROW label="Días de plazo" value={selected.dias_plazo != null ? `${selected.dias_plazo} días` : null} mono />
                {mode === "cliente" && <ROW label="Transporte" value={selected.transporte} />}
                <ROW label="Vendedor" value={selected.vendedor} />
              </div>
              <div style={{ width:200, flexShrink:0 }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Cuentas bancarias</div>
                <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"12px 14px", marginBottom:10 }}>
                  <LBL>Cuenta en Pesos</LBL>
                  <div style={{ fontSize:12, color: selected.cuenta_pesos ? "var(--text)" : "var(--text-dim)", fontFamily:"var(--font-mono)" }}>{selected.cuenta_pesos || "—"}</div>
                </div>
                <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"12px 14px" }}>
                  <LBL>Cuenta en Dólares</LBL>
                  <div style={{ fontSize:12, color: selected.cuenta_dolares ? "var(--success)" : "var(--text-dim)", fontFamily:"var(--font-mono)" }}>{selected.cuenta_dolares || "—"}</div>
                </div>
                <div style={{ marginTop:16, fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Alta</div>
                <div style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(selected.created_at)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel derecho: lista */}
      <div style={{ width:320, flexShrink:0, display:"flex", flexDirection:"column", background:"var(--bg2)" }}>
        <div style={{ padding:16, borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              placeholder="Nombre o CUIT..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); setSelected(null); }}
                style={{ background:"none", border:"none", color:"var(--text-dim)", cursor:"pointer", fontSize:14, padding:"0 4px" }}>✕</button>
            )}
          </div>
          <div style={{ marginTop:8, fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:"0.06em" }}>
            {loadingList ? "Buscando..." : results.length > 0 ? `${results.length} encontrados` : query ? "Sin resultados" : "Escribí para buscar"}
          </div>
        </div>

        <div ref={listRef} style={{ flex:1, overflowY:"auto" }}>
          {results.map((c, i) => {
            const isSel = selectedIndex === i || (selectedIndex === -1 && selected?.id === c.id);
            return (
              <div key={c.id} onClick={() => selectEntity(c, i)}
                style={{ padding:"10px 14px", borderBottom:"1px solid var(--border)", cursor:"pointer",
                  background: isSel ? "var(--accent-dim)" : "transparent",
                  borderLeft: `3px solid ${isSel ? "var(--accent)" : "transparent"}`,
                  transition:"background 0.1s", display:"flex", alignItems:"center", gap:10,
                }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--bg3)"; }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ flex:1, overflow:"hidden" }}>
                  <div style={{ fontSize:12, color:"var(--text)", fontWeight: isSel ? 500 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</div>
                  {c.phone && <div style={{ fontSize:11, color:"var(--text-dim)", fontFamily:"var(--font-mono)", marginTop:2 }}>{c.phone}</div>}
                </div>
                {isSel && <span style={{ color:"var(--accent)", fontSize:10, flexShrink:0 }}>◀</span>}
              </div>
            );
          })}
          {!loadingList && results.length === 0 && query && (
            <div style={{ padding:"40px 16px", textAlign:"center", color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:11, lineHeight:1.8 }}>
              Sin resultados para<br /><span style={{ color:"var(--text-muted)" }}>"{query}"</span>
            </div>
          )}
          {!query && (
            <div style={{ padding:"60px 16px", textAlign:"center", color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:11, lineHeight:2.4 }}>
              ↑<br />Buscá por nombre<br />o CUIT
            </div>
          )}
        </div>
        {results.length > 0 && (
          <div style={{ padding:"10px 16px", borderTop:"1px solid var(--border)", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:"0.06em", background:"var(--bg3)", flexShrink:0 }}>
            {results.length} {label.toUpperCase()}S · ↕ SCROLL
          </div>
        )}
      </div>

      {/* Modal cobranza / pago (único modal, adaptado por modo) */}
      {modalCobranza && (
        <div className="modal-overlay" onClick={() => setModalCobranza(false)}>
          <div className="modal" style={{ maxWidth:420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {mode === "proveedor" ? "Registrar pago" : "Registrar cobranza"} — {selected?.name}
              </span>
              <button className="modal-close" onClick={() => setModalCobranza(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div className="input-group">
                <label className="input-label">Monto ($)</label>
                <input className="input" type="number" min="0" value={formCobranza.monto}
                  onChange={(e) => setFormCobranza((p) => ({ ...p, monto: e.target.value }))} autoFocus />
              </div>
              <div className="input-group">
                <label className="input-label">Método de pago</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {METODOS_COBRANZA.map((m) => (
                    <button key={m} onClick={() => setFormCobranza((p) => ({ ...p, metodo_pago: m }))}
                      style={{ padding:"7px 16px", borderRadius:6, border:"1px solid var(--border)", cursor:"pointer", fontSize:13,
                        background: formCobranza.metodo_pago === m ? "var(--accent)" : "var(--bg3)",
                        color:      formCobranza.metodo_pago === m ? "#fff"          : "var(--text-muted)",
                        fontWeight: formCobranza.metodo_pago === m ? 700             : 400,
                      }}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Concepto (opcional)</label>
                <input className="input" value={formCobranza.concepto}
                  onChange={(e) => setFormCobranza((p) => ({ ...p, concepto: e.target.value }))}
                  placeholder={mode === "proveedor" ? "Pago a proveedor, NC, etc." : "Cobranza, seña, etc."} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalCobranza(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCobranza} disabled={savingCobranza}>
                {savingCobranza ? "Guardando..." : mode === "proveedor" ? "Registrar pago" : "Registrar cobranza"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB GENERAL — clientes Y proveedores
// ════════════════════════════════════════════════════════════
function TabGeneral() {
  const [cuentasClientes,    setCuentasClientes]    = useState([]);
  const [cuentasProveedores, setCuentasProveedores] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [vista,    setVista]    = useState("clientes"); // "clientes" | "proveedores"
  const { addToast, ToastContainer } = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Clientes: endpoint ya existente
        const { data: dataClientes } = await getCuentaCorrienteGeneral();
        setCuentasClientes(dataClientes);

        // Proveedores: cargamos todos y filtramos los que tienen CC con saldo != 0
        // (si querés todos usa getProveedores y muestra saldo 0 donde no exista CC)
        const { data: proveedores } = await getProveedores();
        // Para cada proveedor traemos su CC (en paralelo, máx 20 a la vez)
        const chunks = [];
        for (let i = 0; i < proveedores.length; i += 20) chunks.push(proveedores.slice(i, i + 20));
        const provConCC = [];
        for (const chunk of chunks) {
          const results = await Promise.allSettled(
            chunk.map(async (p) => {
              try {
                const res = await getCCProveedor(p.id);
                const cc  = res.data?.cuenta || res.data || null;
                return { ...p, saldo: Number(cc?.saldo || 0) };
              } catch {
                return { ...p, saldo: 0 };
              }
            })
          );
          results.forEach((r) => { if (r.status === "fulfilled") provConCC.push(r.value); });
        }
        setCuentasProveedores(provConCC);
      } catch { addToast("Error cargando cuentas corrientes", "error"); }
      setLoading(false);
    })();
  }, []);

  const filteredClientes = cuentasClientes.filter(
    (c) => !search.trim() || c.customer_name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredProveedores = cuentasProveedores.filter(
    (p) => !search.trim() || p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalDeudaClientes    = filteredClientes.reduce((a, c) => a + Math.max(0, Number(c.saldo || c.saldo_ars || 0)), 0);
  const totalDeudaProveedores = filteredProveedores.reduce((a, p) => a + Math.max(0, Number(p.saldo || 0)), 0);

  return (
    <>
      <ToastContainer />

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom:20 }}>
        <div className="stat-card">
          <div className="stat-label">Clientes con saldo</div>
          <div className="stat-value accent">{filteredClientes.filter((c) => Number(c.saldo||0) > 0).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deuda clientes ARS</div>
          <div className="stat-value danger">{fmtARS(totalDeudaClientes)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Proveedores con saldo</div>
          <div className="stat-value accent">{filteredProveedores.filter((p) => Number(p.saldo||0) > 0).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deuda proveedores ARS</div>
          <div className="stat-value danger">{fmtARS(totalDeudaProveedores)}</div>
        </div>
      </div>

      {/* Controles */}
      <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:4 }}>
          {[["clientes","👤 Clientes"],["proveedores","🏢 Proveedores"]].map(([key, lbl]) => (
            <button key={key} onClick={() => setVista(key)}
              style={{ padding:"6px 16px", fontSize:13, cursor:"pointer", borderRadius:"var(--radius)",
                border:"1px solid var(--border)",
                background: vista === key ? "var(--accent)" : "var(--bg2)",
                color:      vista === key ? "#fff"          : "var(--text-muted)",
              }}>{lbl}</button>
          ))}
        </div>
        <div className="search-bar" style={{ maxWidth:320 }}>
          <span className="search-icon">🔍</span>
          <input placeholder="Filtrar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:"var(--text-dim)", cursor:"pointer", fontSize:14, padding:"0 4px" }}>✕</button>}
        </div>
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:"center", color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:12 }}>Cargando...</div>
      ) : vista === "clientes" ? (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Cuentas corrientes — Clientes</span>
            <span className="badge badge-info">{filteredClientes.length}</span>
          </div>
          {filteredClientes.length === 0 ? <div className="empty">Sin cuentas corrientes</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Cliente</th><th style={{ textAlign:"right" }}>Saldo ARS</th><th>Último débito</th><th>Último pago</th></tr></thead>
                <tbody>
                  {filteredClientes.map((c) => {
                    const saldo = Number(c.saldo || c.saldo_ars || 0);
                    const color = saldo > 0 ? "var(--danger)" : saldo < 0 ? "var(--success)" : "var(--text-dim)";
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontSize:13, fontWeight:500 }}>{c.customer_name}</div>
                          {c.customer_document && <div style={{ fontSize:11, color:"var(--text-dim)", fontFamily:"var(--font-mono)" }}>{c.customer_document}</div>}
                        </td>
                        <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color }}>{fmtARS(saldo)}</td>
                        <td style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(c.ultimo_debito)}</td>
                        <td style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(c.ultimo_pago)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Cuentas corrientes — Proveedores</span>
            <span className="badge badge-info">{filteredProveedores.length}</span>
          </div>
          {filteredProveedores.length === 0 ? <div className="empty">Sin proveedores</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Proveedor</th><th>CUIT</th><th style={{ textAlign:"right" }}>Saldo ARS</th><th>Estado</th></tr></thead>
                <tbody>
                  {filteredProveedores.map((p) => {
                    const saldo = Number(p.saldo || 0);
                    const color = saldo > 0 ? "var(--danger)" : saldo < 0 ? "var(--success)" : "var(--text-dim)";
                    const label = saldo > 0 ? "Le debemos" : saldo < 0 ? "A nuestro favor" : "Sin saldo";
                    return (
                      <tr key={p.id}>
                        <td style={{ fontSize:13, fontWeight:500 }}>{p.name}</td>
                        <td style={{ fontSize:12, color:"var(--text-dim)", fontFamily:"var(--font-mono)" }}>{p.document || "—"}</td>
                        <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color }}>{fmtARS(Math.abs(saldo))}</td>
                        <td><span style={{ fontSize:11, fontFamily:"var(--font-mono)", color, background: saldo !== 0 ? "var(--bg3)" : "transparent", padding:"2px 8px", borderRadius:4, border: saldo !== 0 ? `1px solid ${color}` : "none" }}>{label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function CuentaCorriente() {
  const [tab, setTab] = useState("clientes");
  const { addToast, ToastContainer } = useToast();

  const TABS = [
    { key:"clientes",    label:"👤 Clientes"    },
    { key:"proveedores", label:"🏢 Proveedores"  },
    { key:"general",     label:"📋 General"      },
  ];

  return (
    <>
      <ToastContainer />
      <div style={{ display:"flex", gap:4, marginBottom:24 }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding:"8px 20px", fontSize:13, fontWeight:500, cursor:"pointer",
              borderRadius:"var(--radius)", border:"1px solid var(--border)",
              background: tab === key ? "var(--accent)" : "var(--bg2)",
              color:      tab === key ? "#fff"          : "var(--text-muted)",
              transition:"background 0.15s, color 0.15s",
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "clientes" && (
        <EntityPanel
          mode="cliente"
          searchFn={(q) => searchCustomers(q)}
          getFn={getCustomer}
          createFn={createCustomer}
          updateFn={updateCustomer}
          deleteFn={deleteCustomer}
          getCCFn={getCuentaCorrienteCliente}
          registrarCobranzaFn={registrarCobranzaCC}
          emptyForm={EMPTY_CLIENTE}
          addToast={addToast}
        />
      )}

      {tab === "proveedores" && (
        <EntityPanel
          mode="proveedor"
          searchFn={(q) => searchProveedores(q)}
          getFn={getProveedor}
          createFn={createProveedor}
          updateFn={updateProveedor}
          deleteFn={deleteProveedor}
          getCCFn={getCCProveedor}
          registrarCobranzaFn={registrarCobranzaProveedor}
          emptyForm={EMPTY_PROVEEDOR}
          addToast={addToast}
        />
      )}

      {tab === "general" && <TabGeneral />}
    </>
  );
}
