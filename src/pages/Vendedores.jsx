import { useState, useEffect } from "react";
import {
  getVendedores, createVendedor, updateVendedor, deleteVendedor,
} from "../utils/api";
import { useToast } from "../utils/useToast";

const EMPTY = { nombre: "", email: "", activo: true };

const LBL = ({ children }) => (
  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>
    {children}
  </div>
);

const ROW = ({ label, value, mono }) => (
  <div style={{ marginBottom:12 }}>
    <LBL>{label}</LBL>
    <div style={{ fontSize:13, color: value ? "var(--text)" : "var(--text-dim)", fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)" }}>
      {value ?? "—"}
    </div>
  </div>
);

export default function Vendedores() {
  const [vendedores,    setVendedores]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(null);
  const [editing,       setEditing]       = useState(false);
  const [isNew,         setIsNew]         = useState(false);
  const [form,          setForm]          = useState(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [search,        setSearch]        = useState("");
  const { addToast, ToastContainer } = useToast();

  const load = async () => {
    setLoading(true);
    try { const { data } = await getVendedores(); setVendedores(data); }
    catch { addToast("Error cargando vendedores", "error"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = vendedores.filter((v) =>
    !search.trim() || v.nombre?.toLowerCase().includes(search.toLowerCase()) || v.email?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setForm(EMPTY); setSelected(null); setIsNew(true); setEditing(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setForm({ nombre: selected.nombre || "", email: selected.email || "", activo: selected.activo ?? true });
    setIsNew(false); setEditing(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { addToast("El nombre es obligatorio", "error"); return; }
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await createVendedor(form);
        addToast("Vendedor creado", "success");
        await load();
        setSelected(data);
      } else {
        const { data } = await updateVendedor(selected.id, form);
        addToast("Vendedor actualizado", "success");
        await load();
        setSelected(data);
      }
      setEditing(false); setIsNew(false);
    } catch { addToast("Error guardando vendedor", "error"); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selected || !confirm(`¿Eliminar a "${selected.nombre}"?`)) return;
    try {
      await deleteVendedor(selected.id);
      addToast("Vendedor eliminado", "success");
      setSelected(null); setEditing(false);
      await load();
    } catch { addToast("Error eliminando vendedor", "error"); }
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <>
      <ToastContainer />
      <div style={{ display:"flex", height:"calc(100vh - 56px)", margin:"-28px", overflow:"hidden" }}>

        {/* PANEL IZQUIERDO: detalle / formulario */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--bg)", borderRight:"1px solid var(--border)" }}>

          {/* Header */}
          <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--bg2)", flexShrink:0 }}>
            <div>
              {editing ? (
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                  {isNew ? "Nuevo vendedor" : `Editando — ${selected?.nombre}`}
                </span>
              ) : selected ? (
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>{selected.nombre}</span>
                  {!selected.activo && (
                    <span className="badge badge-danger">Inactivo</span>
                  )}
                </div>
              ) : (
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", letterSpacing:"0.1em", textTransform:"uppercase" }}>
                  Seleccioná un vendedor →
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
              <div style={{ maxWidth:480, display:"flex", flexDirection:"column", gap:0 }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Datos del vendedor</div>
                <div className="input-group">
                  <label className="input-label">Nombre *</label>
                  <input className="input" value={form.nombre} onChange={f("nombre")} placeholder="Nombre completo" autoFocus />
                </div>
                <div className="input-group">
                  <label className="input-label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={f("email")} placeholder="vendedor@empresa.com" />
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:8 }}>
                  <input type="checkbox" id="activo" checked={form.activo} onChange={f("activo")} style={{ accentColor:"var(--accent)", width:15, height:15 }} />
                  <label htmlFor="activo" style={{ fontSize:13, color:"var(--text-muted)", cursor:"pointer" }}>Vendedor activo</label>
                </div>
              </div>

            ) : !selected ? (
              <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, color:"var(--text-dim)" }}>
                <span style={{ fontSize:48 }}>🧑‍💼</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:12, letterSpacing:"0.08em" }}>Seleccioná un vendedor →</span>
              </div>

            ) : (
              <div style={{ display:"flex", gap:32 }}>
                {/* Columna izquierda */}
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Datos</div>
                  <ROW label="Nombre" value={selected.nombre} />
                  <ROW label="Email"  value={selected.email} />
                  <ROW label="Estado" value={selected.activo ? "Activo" : "Inactivo"} />
                  <ROW label="Alta"   value={selected.created_at ? new Date(selected.created_at).toLocaleDateString("es-AR") : null} mono />
                </div>

                {/* Columna derecha: stat de ventas */}
                <div style={{ width:200, flexShrink:0 }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Actividad</div>
                  <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:8, padding:"20px 24px", textAlign:"center" }}>
                    <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Total ventas</div>
                    <div style={{ fontSize:36, fontFamily:"var(--font-mono)", fontWeight:800, color:"var(--accent)" }}>
                      {Number(selected.total_ventas || 0).toLocaleString("es-AR")}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text-dim)", marginTop:4 }}>comprobantes</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: lista */}
        <div style={{ width:320, flexShrink:0, display:"flex", flexDirection:"column", background:"var(--bg2)" }}>
          <div style={{ padding:"16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input
                placeholder="Buscar vendedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch("")}
                  style={{ background:"none", border:"none", color:"var(--text-dim)", cursor:"pointer", fontSize:14, padding:"0 4px" }}>✕</button>
              )}
            </div>
            <div style={{ marginTop:8, fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:"0.06em" }}>
              {loading ? "Cargando..." : `${filtered.length} vendedor${filtered.length !== 1 ? "es" : ""}`}
            </div>
          </div>

          <div style={{ flex:1, overflowY:"auto" }}>
            {filtered.map((v) => {
              const isSel = selected?.id === v.id;
              return (
                <div key={v.id} onClick={() => { setSelected(v); setEditing(false); setIsNew(false); }}
                  style={{
                    padding:"10px 14px", borderBottom:"1px solid var(--border)", cursor:"pointer",
                    background: isSel ? "var(--accent-dim)" : "transparent",
                    borderLeft: `3px solid ${isSel ? "var(--accent)" : "transparent"}`,
                    transition:"background 0.1s", display:"flex", alignItems:"center", gap:10,
                    opacity: v.activo ? 1 : 0.5,
                  }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--bg3)"; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ flex:1, overflow:"hidden" }}>
                    <div style={{ fontSize:12, color:"var(--text)", fontWeight: isSel ? 500 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {v.nombre}
                    </div>
                    {v.email && (
                      <div style={{ fontSize:11, color:"var(--text-dim)", fontFamily:"var(--font-mono)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.email}</div>
                    )}
                  </div>
                  <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color: isSel ? "var(--accent)" : "var(--text-dim)", flexShrink:0 }}>
                    {Number(v.total_ventas || 0)} vtas
                  </div>
                  {isSel && <span style={{ color:"var(--accent)", fontSize:10, flexShrink:0 }}>◀</span>}
                </div>
              );
            })}
            {!loading && filtered.length === 0 && (
              <div style={{ padding:"60px 16px", textAlign:"center", color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:11, lineHeight:2 }}>
                🧑‍💼<br />Sin vendedores
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <div style={{ padding:"10px 16px", borderTop:"1px solid var(--border)", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:"0.06em", background:"var(--bg3)", flexShrink:0 }}>
              {filtered.length} VENDEDORES
            </div>
          )}
        </div>
      </div>
    </>
  );
}
