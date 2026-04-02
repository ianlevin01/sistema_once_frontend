import { useState, useEffect, useRef } from "react";
import {
  searchCustomers, getCustomer,
  createCustomer, updateCustomer, deleteCustomer,
  getCuentaCorrienteCliente, getCuentaCorrienteGeneral,
  registrarPagoCC, agregarSaldoCC, registrarCobranzaCC,
} from "../utils/api";
import { useToast } from "../utils/useToast";

// ─── Constantes del formulario de cliente ────────────────────
const EMPTY_CLIENTE = {
  name:"", type:"minorista", document:"", phone:"", email:"",
  domicilio:"", localidad:"", provincia:"", codigo_postal:"",
  contacto:"", descuento:"", dias_plazo:"", transporte:"DON ALFREDO",
  condicion_iva:"Consumidor Final", vendedor:"", cuenta_pesos:"", cuenta_dolares:"",
};
const COND_IVA    = ["Resp. Inscripto","Resp. Monotributo","Consumidor Final","Exento"];
const TRANSPORTES = ["DON ALFREDO","VIA CARGO","CORREO","OCA","ANDREANI","RETIRA"];

// ─── Helpers de formato ──────────────────────────────────────
const fmtARS = (n) => `$${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const fmtUSD = (n) => `U$D ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-AR") : "—";

// ─── Sub-componentes de UI ───────────────────────────────────
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
// TAB INDIVIDUAL
// ════════════════════════════════════════════════════════════
function TabIndividual() {
  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState([]);
  const [loadingList,   setLoadingList]   = useState(false);
  const [selected,      setSelected]      = useState(null);   // datos del cliente
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [editing,       setEditing]       = useState(false);
  const [isNew,         setIsNew]         = useState(false);
  const [form,          setForm]          = useState(EMPTY_CLIENTE);
  const [saving,        setSaving]        = useState(false);

  // Cuenta corriente del cliente seleccionado
  const [cc,         setCC]         = useState(null);
  const [loadingCC,  setLoadingCC]  = useState(false);
  const [viewCC,     setViewCC]     = useState(false);   // false = ficha cliente, true = cuenta corriente

  // Modales de pago y cobranza
  const [modalPago,      setModalPago]      = useState(false);
  const [modalCobranza,  setModalCobranza]  = useState(false);
  const [formPago,       setFormPago]       = useState({ monto:"", concepto:"" });
  const [formCobranza,   setFormCobranza]   = useState({ monto:"", concepto:"", metodo_pago:"Efectivo" });
  const [savingPago,     setSavingPago]     = useState(false);
  const [savingCobranza, setSavingCobranza] = useState(false);

  const METODOS_COBRANZA = ["Efectivo","Cheque","Depósito","Tarjeta","Mercpago"];

  const listRef = useRef(null);
  const { addToast, ToastContainer } = useToast();

  // Búsqueda de clientes
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoadingList(true);
      try { const { data } = await searchCustomers(query); setResults(data); setSelectedIndex(-1); }
      catch { addToast("Error buscando clientes", "error"); }
      setLoadingList(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Navegación con teclado
  useEffect(() => {
    const handleKey = (e) => {
      if (results.length === 0 || editing) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.min(prev + 1, results.length - 1);
          selectCustomer(results[next], next);
          scrollToIndex(next);
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          selectCustomer(results[next], next);
          scrollToIndex(next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [results, editing]);

  const scrollToIndex = (idx) => {
    if (!listRef.current) return;
    const item = listRef.current.children[idx];
    if (item) item.scrollIntoView({ block:"nearest", behavior:"smooth" });
  };

  const selectCustomer = async (c, idx) => {
    if (idx !== undefined) setSelectedIndex(idx);
    setSelected({ ...c, _loading: true });
    setEditing(false); setIsNew(false); setViewCC(false); setCC(null);
    setLoadingDetail(true);
    try { const { data } = await getCustomer(c.id); setSelected(data); }
    catch { addToast("Error cargando cliente", "error"); }
    setLoadingDetail(false);
  };

  const loadCC = async (customerId) => {
    setLoadingCC(true);
    try {
      const { data } = await getCuentaCorrienteCliente(customerId);
      setCC(data);
    } catch { addToast("Error cargando cuenta corriente", "error"); }
    setLoadingCC(false);
  };

  const handleVerCC = () => {
    setViewCC(true);
    if (!cc) loadCC(selected.id);
  };

  const handlePago = async () => {
    const monto = Number(formPago.monto);
    if (!monto || monto <= 0) { addToast("Monto inválido", "error"); return; }
    setSavingPago(true);
    try {
      await registrarPagoCC(selected.id, { monto, concepto: formPago.concepto || "Pago" });
      addToast("Pago registrado", "success");
      setModalPago(false); setFormPago({ monto:"", concepto:"" });
      loadCC(selected.id);
    } catch (err) { addToast(err.response?.data?.message || "Error registrando pago", "error"); }
    setSavingPago(false);
  };

  const handleCobranza = async () => {
    const monto = Number(formCobranza.monto);
    if (!monto || monto <= 0) { addToast("Monto inválido", "error"); return; }
    if (!formCobranza.metodo_pago) { addToast("Seleccioná un método de pago", "error"); return; }
    setSavingCobranza(true);
    try {
      await registrarCobranzaCC(selected.id, {
        monto,
        concepto:    formCobranza.concepto || "Cobranza",
        metodo_pago: formCobranza.metodo_pago,
      });
      addToast("Cobranza registrada", "success");
      setModalCobranza(false);
      setFormCobranza({ monto:"", concepto:"", metodo_pago:"Efectivo" });
      loadCC(selected.id);
    } catch (err) { addToast(err.response?.data?.message || "Error registrando cobranza", "error"); }
    setSavingCobranza(false);
  };

  // Formulario cliente
  const openNew  = () => { setForm(EMPTY_CLIENTE); setSelected(null); setIsNew(true); setEditing(true); setViewCC(false); };
  const openEdit = () => {
    if (!selected) return;
    setForm({
      name: selected.name||"", type: selected.type||"minorista",
      document: selected.document||"", phone: selected.phone||"",
      email: selected.email||"", domicilio: selected.domicilio||"",
      localidad: selected.localidad||"", provincia: selected.provincia||"",
      codigo_postal: selected.codigo_postal||"", contacto: selected.contacto||"",
      descuento: selected.descuento||"", dias_plazo: selected.dias_plazo||"",
      transporte: selected.transporte||"DON ALFREDO",
      condicion_iva: selected.condicion_iva||"Consumidor Final",
      vendedor: selected.vendedor||"", cuenta_pesos: selected.cuenta_pesos||"",
      cuenta_dolares: selected.cuenta_dolares||"",
    });
    setIsNew(false); setEditing(true); setViewCC(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { addToast("El nombre es obligatorio", "error"); return; }
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await createCustomer(form);
        addToast("Cliente creado", "success");
        setEditing(false); setIsNew(false);
        if (query) { const { data: r } = await searchCustomers(query); setResults(r); }
        const { data: det } = await getCustomer(data.id);
        setSelected(det);
      } else {
        await updateCustomer(selected.id, form);
        setSelected((prev) => ({ ...prev, ...form }));
        addToast("Cliente actualizado", "success");
        setEditing(false);
      }
    } catch { addToast("Error guardando cliente", "error"); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selected || !confirm(`¿Eliminar a "${selected.name}"?`)) return;
    try {
      await deleteCustomer(selected.id);
      addToast("Cliente eliminado", "success");
      setSelected(null); setEditing(false); setCC(null); setViewCC(false);
      setResults((prev) => prev.filter((c) => c.id !== selected.id));
    } catch { addToast("Error eliminando cliente", "error"); }
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const INPUT = ({ label, k, type="text", placeholder="" }) => (
    <div className="input-group">
      <label className="input-label">{label}</label>
      <input className="input" type={type} value={form[k]} onChange={f(k)} placeholder={placeholder} />
    </div>
  );

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      <ToastContainer />
      <div style={{ display:"flex", height:"calc(100vh - 56px)", margin:"-28px", overflow:"hidden" }}>

        {/* PANEL IZQUIERDO: detalle / form / cuenta corriente */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--bg)", borderRight:"1px solid var(--border)" }}>

          {/* Header */}
          <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--bg2)", flexShrink:0 }}>
            <div>
              {editing ? (
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                  {isNew ? "Nuevo cliente" : `Editando — ${selected?.name}`}
                </span>
              ) : selected ? (
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  {selected.codigo && (
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:12, fontWeight:700, color:"var(--accent)", background:"var(--accent-dim)", padding:"3px 10px", borderRadius:4 }}>
                      {selected.codigo}
                    </span>
                  )}
                  <span style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>{selected.name}</span>
                  <span className={`badge ${selected.type === "mayorista" ? "badge-accent" : "badge-info"}`}>{selected.type || "—"}</span>
                  {/* Tabs Ficha / Cuenta Corriente */}
                  <div style={{ marginLeft:16, display:"flex", gap:4 }}>
                    <button
                      onClick={() => setViewCC(false)}
                      style={{ fontSize:12, padding:"4px 12px", borderRadius:4, border:"1px solid var(--border)", cursor:"pointer",
                        background: !viewCC ? "var(--accent)" : "transparent",
                        color:      !viewCC ? "#fff"          : "var(--text-muted)",
                      }}>Ficha</button>
                    <button
                      onClick={handleVerCC}
                      style={{ fontSize:12, padding:"4px 12px", borderRadius:4, border:"1px solid var(--border)", cursor:"pointer",
                        background: viewCC ? "var(--accent)" : "transparent",
                        color:      viewCC ? "#fff"          : "var(--text-muted)",
                      }}>Cta Cte</button>
                  </div>
                </div>
              ) : (
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", letterSpacing:"0.1em", textTransform:"uppercase" }}>
                  Seleccioná un cliente →
                </span>
              )}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {editing ? (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setIsNew(false); }}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </>
              ) : viewCC && selected ? (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => setModalCobranza(true)}>+ Registrar cobranza</button>
                  <button className="btn btn-ghost btn-sm"   onClick={() => setModalPago(true)}>Registrar pago</button>
                </>
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
              /* FORMULARIO */
              <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Datos personales</div>
                <div className="grid-2">
                  <INPUT label="Nombre *" k="name" placeholder="Nombre completo o razón social" />
                  <INPUT label="C.U.I.T." k="document" placeholder="20-12345678-9" />
                </div>
                <INPUT label="Domicilio" k="domicilio" placeholder="Av. Corrientes 1234" />
                <div className="grid-3">
                  <INPUT label="Localidad"     k="localidad"     placeholder="Buenos Aires" />
                  <INPUT label="Provincia"     k="provincia"     placeholder="Buenos Aires" />
                  <INPUT label="Código Postal" k="codigo_postal" placeholder="1043" />
                </div>
                <div className="grid-2">
                  <INPUT label="Teléfono" k="phone"    placeholder="11 1234-5678" />
                  <INPUT label="Contacto" k="contacto" placeholder="Nombre de contacto" />
                </div>
                <INPUT label="Email" k="email" type="email" placeholder="correo@ejemplo.com" />
                <hr className="divider" />
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Condiciones comerciales</div>
                <div className="grid-3">
                  <div className="input-group">
                    <label className="input-label">Tipo</label>
                    <select className="select" value={form.type} onChange={f("type")}>
                      <option value="minorista">Minorista</option>
                      <option value="mayorista">Mayorista</option>
                      <option value="proveedor">Proveedor</option>
                    </select>
                  </div>
                  <INPUT label="Descuento (%)" k="descuento" type="number" placeholder="0" />
                  <INPUT label="Días de plazo" k="dias_plazo" type="number" placeholder="0" />
                </div>
                <div className="grid-2">
                  <div className="input-group">
                    <label className="input-label">Condición ante el IVA</label>
                    <select className="select" value={form.condicion_iva} onChange={f("condicion_iva")}>
                      {COND_IVA.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Transporte</label>
                    <select className="select" value={form.transporte} onChange={f("transporte")}>
                      {TRANSPORTES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <INPUT label="Vendedor"     k="vendedor"      placeholder="Nombre del vendedor" />
                  <INPUT label="Cuenta Pesos" k="cuenta_pesos"  placeholder="CBU o alias" />
                </div>
                <INPUT label="Cuenta Dólares" k="cuenta_dolares" placeholder="Cuenta en USD" />
              </div>

            ) : !selected ? (
              <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, color:"var(--text-dim)" }}>
                <span style={{ fontSize:48 }}>👤</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:12, letterSpacing:"0.08em" }}>Buscá y seleccioná un cliente →</span>
              </div>

            ) : loadingDetail ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:12 }}>Cargando...</div>

            ) : viewCC ? (
              /* ── CUENTA CORRIENTE ── */
              loadingCC ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:12 }}>Cargando cuenta corriente...</div>
              ) : !cc ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:12 }}>Sin cuenta corriente</div>
              ) : (
                <div>
                  {/* Saldo destacado */}
                  <div style={{ display:"flex", gap:16, marginBottom:28 }}>
                    <div style={{ flex:1, background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8, padding:"18px 22px" }}>
                      <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Saldo en pesos</div>
                      <div style={{ fontSize:28, fontFamily:"var(--font-mono)", fontWeight:800, color: cc.saldo >= 0 ? "var(--danger)" : "var(--success)" }}>
                        {fmtARS(cc.saldo)}
                      </div>
                      <div style={{ fontSize:11, color:"var(--text-dim)", marginTop:4 }}>{cc.saldo >= 0 ? "Debe" : "Saldo a favor"}</div>
                    </div>
                  </div>

                  {/* Movimientos */}
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>
                    Movimientos ({cc.movimientos?.length || 0})
                  </div>
                  {!cc.movimientos?.length ? (
                    <div style={{ color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:12, padding:"24px 0" }}>Sin movimientos</div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                      {/* Header */}
                      <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 150px 130px 80px", gap:12, padding:"8px 12px", background:"var(--bg3)", borderRadius:"6px 6px 0 0", borderBottom:"2px solid var(--border)" }}>
                        {["Fecha","Concepto","Método","Monto","Tipo"].map((h) => (
                          <div key={h} style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</div>
                        ))}
                      </div>
                      {cc.movimientos.map((m) => (
                        <div key={m.id} style={{ display:"grid", gridTemplateColumns:"120px 1fr 150px 130px 80px", gap:12, padding:"11px 12px", borderBottom:"1px solid var(--border)", alignItems:"center", background:"var(--bg)" }}>
                          <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{fmtDate(m.created_at)}</span>
                          <span style={{ fontSize:13 }}>{m.concepto || "—"}</span>
                          <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{m.metodo_pago || "—"}</span>
                          <span style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color: m.tipo === "debito" ? "var(--danger)" : "var(--success)" }}>
                            {m.tipo === "debito" ? "+" : "−"}{fmtARS(m.monto)}
                          </span>
                          <span className={`badge ${m.tipo === "debito" ? "badge-danger" : "badge-success"}`}>
                            {m.tipo === "debito" ? "Débito" : "Pago"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )

            ) : (
              /* ── FICHA DEL CLIENTE ── */
              <div style={{ display:"flex", gap:32 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Datos personales</div>
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
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Condiciones</div>
                  <ROW label="Tipo"          value={selected.type} />
                  <ROW label="Condición IVA" value={selected.condicion_iva} />
                  <ROW label="Descuento"     value={selected.descuento != null ? `${selected.descuento}%` : null} mono />
                  <ROW label="Días de plazo" value={selected.dias_plazo != null ? `${selected.dias_plazo} días` : null} mono />
                  <ROW label="Transporte"    value={selected.transporte} />
                  <ROW label="Vendedor"      value={selected.vendedor} />
                </div>
                <div style={{ width:200, flexShrink:0 }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Cuentas bancarias</div>
                  <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"12px 14px", marginBottom:10 }}>
                    <LBL>Cuenta en Pesos</LBL>
                    <div style={{ fontSize:12, color: selected.cuenta_pesos ? "var(--text)" : "var(--text-dim)", fontFamily:"var(--font-mono)" }}>
                      {selected.cuenta_pesos || "—"}
                    </div>
                  </div>
                  <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"12px 14px" }}>
                    <LBL>Cuenta en Dólares</LBL>
                    <div style={{ fontSize:12, color: selected.cuenta_dolares ? "var(--success)" : "var(--text-dim)", fontFamily:"var(--font-mono)" }}>
                      {selected.cuenta_dolares || "—"}
                    </div>
                  </div>
                  <div style={{ marginTop:16, fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Alta</div>
                  <div style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
                    {fmtDate(selected.created_at)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: lista de clientes */}
        <div style={{ width:320, flexShrink:0, display:"flex", flexDirection:"column", background:"var(--bg2)" }}>
          <div style={{ padding:"16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
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
                <div key={c.id} onClick={() => selectCustomer(c, i)}
                  style={{
                    padding:"10px 14px", borderBottom:"1px solid var(--border)", cursor:"pointer",
                    background: isSel ? "var(--accent-dim)" : "transparent",
                    borderLeft: `3px solid ${isSel ? "var(--accent)" : "transparent"}`,
                    transition:"background 0.1s", display:"flex", alignItems:"center", gap:10,
                  }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--bg3)"; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ flex:1, overflow:"hidden" }}>
                    <div style={{ fontSize:12, color:"var(--text)", fontWeight: isSel ? 500 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {c.name}
                    </div>
                    {c.phone && (
                      <div style={{ fontSize:11, color:"var(--text-dim)", fontFamily:"var(--font-mono)", marginTop:2 }}>{c.phone}</div>
                    )}
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
              {results.length} CLIENTES · ↕ SCROLL
            </div>
          )}
        </div>
      </div>

      {/* Modal: Registrar pago */}
      {modalPago && (
        <div className="modal-overlay" onClick={() => setModalPago(false)}>
          <div className="modal" style={{ maxWidth:400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Registrar pago — {selected?.name}</span>
              <button className="modal-close" onClick={() => setModalPago(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div className="input-group">
                <label className="input-label">Monto ($)</label>
                <input className="input" type="number" min="0" value={formPago.monto}
                  onChange={(e) => setFormPago((p) => ({ ...p, monto: e.target.value }))}
                  placeholder="0.00" autoFocus />
              </div>
              <div className="input-group">
                <label className="input-label">Concepto</label>
                <input className="input" value={formPago.concepto}
                  onChange={(e) => setFormPago((p) => ({ ...p, concepto: e.target.value }))}
                  placeholder="Pago en efectivo, transferencia USD, etc." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalPago(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handlePago} disabled={savingPago}>
                {savingPago ? "Registrando..." : "Registrar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar cobranza */}
      {modalCobranza && (
        <div className="modal-overlay" onClick={() => setModalCobranza(false)}>
          <div className="modal" style={{ maxWidth:420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Registrar cobranza — {selected?.name}</span>
              <button className="modal-close" onClick={() => setModalCobranza(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div className="input-group">
                <label className="input-label">Monto ($)</label>
                <input className="input" type="number" min="0" value={formCobranza.monto}
                  onChange={(e) => setFormCobranza((p) => ({ ...p, monto: e.target.value }))}
                  placeholder="0.00" autoFocus />
              </div>
              <div className="input-group">
                <label className="input-label">Método de cobro</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {METODOS_COBRANZA.map((m) => (
                    <button
                      key={m}
                      onClick={() => setFormCobranza((p) => ({ ...p, metodo_pago: m }))}
                      style={{
                        padding:"7px 16px", borderRadius:6, border:"1px solid var(--border)",
                        cursor:"pointer", fontSize:13, fontFamily:"var(--font-mono)",
                        background: formCobranza.metodo_pago === m ? "var(--accent)"     : "var(--bg3)",
                        color:      formCobranza.metodo_pago === m ? "#fff"              : "var(--text-muted)",
                        fontWeight: formCobranza.metodo_pago === m ? 700                 : 400,
                        transition:"all 0.13s",
                      }}
                    >{m}</button>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Concepto (opcional)</label>
                <input className="input" value={formCobranza.concepto}
                  onChange={(e) => setFormCobranza((p) => ({ ...p, concepto: e.target.value }))}
                  placeholder="Cobranza, seña, etc." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalCobranza(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCobranza} disabled={savingCobranza}>
                {savingCobranza ? "Guardando..." : "Registrar cobranza"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// TAB GENERAL
// ════════════════════════════════════════════════════════════
function TabGeneral() {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const { addToast, ToastContainer } = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const { data } = await getCuentaCorrienteGeneral(); setCuentas(data); }
      catch { addToast("Error cargando cuentas corrientes", "error"); }
      setLoading(false);
    })();
  }, []);

  const filtered = cuentas.filter((c) =>
    !search.trim() || c.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalDeudaARS = filtered.reduce((a, c) => a + Math.max(0, Number(c.saldo_ars || 0)), 0);
  const totalDeudaUSD = filtered.reduce((a, c) => a + Math.max(0, Number(c.saldo_usd || 0)), 0);

  return (
    <>
      <ToastContainer />

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom:20 }}>
        <div className="stat-card">
          <div className="stat-label">Cuentas activas</div>
          <div className="stat-value accent">{filtered.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deuda total ARS</div>
          <div className="stat-value danger">{fmtARS(totalDeudaARS)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deuda total USD</div>
          <div className="stat-value danger">{fmtUSD(totalDeudaUSD)}</div>
        </div>
      </div>

      {/* Buscador */}
      <div className="search-bar" style={{ marginBottom:16, maxWidth:360 }}>
        <span className="search-icon">🔍</span>
        <input
          placeholder="Filtrar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")}
            style={{ background:"none", border:"none", color:"var(--text-dim)", cursor:"pointer", fontSize:14, padding:"0 4px" }}>✕</button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Todas las cuentas corrientes</span>
          <span className="badge badge-info">{filtered.length}</span>
        </div>

        {loading ? (
          <div className="empty">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">Sin cuentas corrientes</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th style={{ textAlign:"right" }}>Saldo ARS</th>
                  <th style={{ textAlign:"right" }}>Saldo USD</th>
                  <th>Último presupuesto</th>
                  <th>Último pago</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const saldoARS = Number(c.saldo_ars || 0);
                  const saldoUSD = Number(c.saldo_usd || 0);
                  const colorARS = saldoARS > 0 ? "var(--danger)" : saldoARS < 0 ? "var(--success)" : "var(--text-dim)";
                  const colorUSD = saldoUSD > 0 ? "var(--danger)" : saldoUSD < 0 ? "var(--success)" : "var(--text-dim)";
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontSize:13, fontWeight:500, color:"var(--text)" }}>{c.customer_name}</div>
                        {c.customer_document && (
                          <div style={{ fontSize:11, color:"var(--text-dim)", fontFamily:"var(--font-mono)" }}>{c.customer_document}</div>
                        )}
                      </td>
                      <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color:colorARS }}>
                        {fmtARS(saldoARS)}
                      </td>
                      <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color:colorUSD }}>
                        {saldoUSD !== 0 ? fmtUSD(saldoUSD) : <span style={{ color:"var(--text-dim)", fontWeight:400 }}>—</span>}
                      </td>
                      <td style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
                        {fmtDate(c.ultimo_debito)}
                      </td>
                      <td style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
                        {fmtDate(c.ultimo_pago)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL con tabs
// ════════════════════════════════════════════════════════════
export default function CuentaCorriente() {
  const [tab, setTab] = useState("individual");

  return (
    <>
      {/* Selector de tab */}
      <div style={{ display:"flex", gap:4, marginBottom:24 }}>
        {[
          { key:"individual", label:"👤 Individual" },
          { key:"general",    label:"📋 General"    },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding:"8px 20px", fontSize:13, fontWeight:500, cursor:"pointer",
              borderRadius:"var(--radius)", border:"1px solid var(--border)",
              background: tab === key ? "var(--accent)"      : "var(--bg2)",
              color:      tab === key ? "#fff"               : "var(--text-muted)",
              transition:"background 0.15s, color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "individual" ? <TabIndividual /> : <TabGeneral />}
    </>
  );
}
