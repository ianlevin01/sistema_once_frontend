import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { searchCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getClientes } from "../utils/api";
import { useToast } from "../utils/useToast";

const EMPTY = {
  name:"", type:"minorista", document:"", phone:"", email:"",
  domicilio:"", localidad:"", provincia:"", codigo_postal:"",
  contacto:"", descuento:"", dias_plazo:"", transporte:"DON ALFREDO",
  condicion_iva:"Consumidor Final", vendedor:"", cuenta_pesos:"", cuenta_dolares:"",
};

const COND_IVA   = ["Resp. Inscripto","Resp. Monotributo","Consumidor Final","Exento"];
const TRANSPORTES = ["DON ALFREDO","VIA CARGO","CORREO","OCA","ANDREANI","RETIRA"];

export default function Customers() {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingList,   setLoadingList]   = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [isNew,    setIsNew]    = useState(false);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef(null);
  const { addToast, ToastContainer } = useToast();

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
    if (item) item.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const selectCustomer = async (c, idx) => {
    if (idx !== undefined) setSelectedIndex(idx);
    setSelected({ ...c, _loading: true });
    setEditing(false); setIsNew(false);
    setLoadingDetail(true);
    try { const { data } = await getCustomer(c.id); setSelected(data); }
    catch { addToast("Error cargando cliente", "error"); }
    setLoadingDetail(false);
  };

  const openNew = () => {
    setForm(EMPTY); setSelected(null); setIsNew(true); setEditing(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setForm({
      name:          selected.name          || "",
      type:          selected.type          || "minorista",
      document:      selected.document      || "",
      phone:         selected.phone         || "",
      email:         selected.email         || "",
      domicilio:     selected.domicilio     || "",
      localidad:     selected.localidad     || "",
      provincia:     selected.provincia     || "",
      codigo_postal: selected.codigo_postal || "",
      contacto:      selected.contacto      || "",
      descuento:     selected.descuento     || "",
      dias_plazo:    selected.dias_plazo    || "",
      transporte:    selected.transporte    || "DON ALFREDO",
      condicion_iva: selected.condicion_iva || "Consumidor Final",
      vendedor:      selected.vendedor      || "",
      cuenta_pesos:  selected.cuenta_pesos  || "",
      cuenta_dolares:selected.cuenta_dolares|| "",
    });
    setIsNew(false); setEditing(true);
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
      setSelected(null); setEditing(false);
      setResults((prev) => prev.filter((c) => c.id !== selected.id));
    } catch { addToast("Error eliminando cliente", "error"); }
  };

  const handleCancel = () => { setEditing(false); setIsNew(false); };

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const { data: todos } = await getClientes();

      // Agrupar por provincia
      const grupos = {};
      for (const c of todos) {
        const prov = (c.provincia?.trim() || "Sin provincia").toUpperCase();
        if (!grupos[prov]) grupos[prov] = [];
        grupos[prov].push(c);
      }

      const wb = XLSX.utils.book_new();
      const COLS = [
        "Nombre", "CUIT", "Domicilio", "Localidad", "Provincia", "Cód. Postal",
        "Teléfono", "Email", "Contacto", "Tipo", "Condición IVA",
        "Descuento (%)", "Días Plazo", "Transporte", "Vendedor",
        "Cuenta Pesos", "Cuenta Dólares",
      ];

      const provincias = Object.keys(grupos).sort();
      for (const prov of provincias) {
        const filas = grupos[prov].map((c) => [
          c.name          ?? "",
          c.document      ?? "",
          c.domicilio     ?? "",
          c.localidad     ?? "",
          c.provincia     ?? "",
          c.codigo_postal ?? "",
          c.phone         ?? "",
          c.email         ?? "",
          c.contacto      ?? "",
          c.type          ?? "",
          c.condicion_iva ?? "",
          c.descuento     ?? "",
          c.dias_plazo    ?? "",
          c.transporte    ?? "",
          c.vendedor      ?? "",
          c.cuenta_pesos  ?? "",
          c.cuenta_dolares ?? "",
        ]);

        const ws = XLSX.utils.aoa_to_sheet([COLS, ...filas]);

        // Ancho de columnas
        ws["!cols"] = [30,18,30,18,18,10,14,28,18,10,16,10,10,14,16,24,24].map((w) => ({ wch: w }));

        // Nombre del sheet: máx 31 chars (límite de Excel), sin chars inválidos
        const sheetName = prov.replace(/[\\/*?:[\]]/g, "").slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName || "SIN PROVINCIA");
      }

      XLSX.writeFile(wb, `clientes_por_provincia_${new Date().toISOString().slice(0, 10)}.xlsx`);
      addToast(`Excel exportado — ${todos.length} clientes en ${provincias.length} provincias`, "success");
    } catch {
      addToast("Error exportando clientes", "error");
    }
    setExporting(false);
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

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

  const INPUT = ({ label, k, type="text", placeholder="" }) => (
    <div className="input-group">
      <label className="input-label">{label}</label>
      <input className="input" type={type} value={form[k]} onChange={f(k)} placeholder={placeholder} />
    </div>
  );

  return (
    <>
      <ToastContainer />
      <div style={{ display:"flex", height:"calc(100vh - 56px)", margin:"-28px", overflow:"hidden" }}>

        {/* ── PANEL IZQUIERDO: DETALLE / FORM ── */}
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
                  <button className="btn btn-ghost btn-sm" onClick={handleCancel}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={handleExportExcel} disabled={exporting}
                    title="Exportar todos los clientes agrupados por provincia">
                    {exporting ? "Exportando..." : "↓ Excel"}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nuevo</button>
                  {selected && <>
                    <button className="btn btn-ghost btn-sm" onClick={openEdit}>✏️ Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑️</button>
                  </>}
                </>
              )}
            </div>
          </div>

          {/* Contenido */}
          <div style={{ flex:1, overflowY:"auto", padding:24 }}>
            {editing ? (
              /* ── FORMULARIO ── */
              <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>
                  Datos personales
                </div>
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
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>
                  Condiciones comerciales
                </div>
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
                  <INPUT label="Vendedor"       k="vendedor"      placeholder="Nombre del vendedor" />
                  <INPUT label="Cuenta Pesos"   k="cuenta_pesos"  placeholder="CBU o alias" />
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
            ) : (
              /* ── DETALLE ── */
              <div style={{ display:"flex", gap:32 }}>
                {/* Columna izquierda */}
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
                  <ROW label="Tipo"              value={selected.type} />
                  <ROW label="Condición IVA"     value={selected.condicion_iva} />
                  <ROW label="Descuento"         value={selected.descuento != null ? `${selected.descuento}%` : null} mono />
                  <ROW label="Días de plazo"     value={selected.dias_plazo != null ? `${selected.dias_plazo} días` : null} mono />
                  <ROW label="Transporte"        value={selected.transporte} />
                  <ROW label="Vendedor"          value={selected.vendedor} />
                </div>

                {/* Columna derecha: cuentas */}
                <div style={{ width:200, flexShrink:0 }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Cuentas</div>
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
                    {selected.created_at ? new Date(selected.created_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "—"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── PANEL DERECHO: LISTA ── */}
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
    </>
  );
}
