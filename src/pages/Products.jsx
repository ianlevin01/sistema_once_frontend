import { useState, useEffect, useRef, useCallback } from "react";
import Modal from "../components/Modal";
import { searchProducts, getProduct, createProduct, updateProduct, deleteProduct } from "../utils/api";
import { useToast } from "../utils/useToast";

const EMPTY_FORM = {
  name: "", code: "", barcode: "", box_code: "", description: "",
  category_id: "", active: true, cost: "", tasa_iva: "", despacho: "",
  aduana: "", origen: "", qxb: "", fecha: "", video_url: "",
  price_1: "", price_2: "", price_3: "", price_4: "", price_5: "",
};

const WAREHOUSES_DEFAULT = [
  "Alfred","Saldo","Oficina ML","Camarin",
  "Salon Teatro","Oficina","Tertulia","Past 280","Peron Lejos",
];

const VAL  = (v) => (v !== undefined && v !== null && v !== "") ? v : null;
const FMT  = (v) => v != null ? Number(v).toLocaleString("es-AR", { minimumFractionDigits: 2 }) : "—";
const FMTN = (v) => v != null ? Number(v).toLocaleString("es-AR") : "—";

// ─── Componente de upload de imágenes ────────────────────────────────────────
function ImageUploadSlot({ label, file, preview, onFileChange, onClear }) {
  const inputRef = useRef(null);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>
        {label}
      </div>
      <div
        onClick={() => !preview && inputRef.current?.click()}
        style={{
          width:"100%", height:110, borderRadius:8,
          border: preview ? "2px solid var(--accent)" : "2px dashed var(--border)",
          background: preview ? "var(--bg3)" : "var(--bg)",
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor: preview ? "default" : "pointer",
          overflow:"hidden", position:"relative",
          transition:"border-color 0.15s, background 0.15s",
        }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) onFileChange(f);
        }}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt={label}
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              title="Quitar imagen"
              style={{
                position:"absolute", top:6, right:6,
                background:"rgba(0,0,0,0.65)", border:"none", borderRadius:"50%",
                width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer", color:"#fff", fontSize:11, lineHeight:1,
              }}
            >✕</button>
          </>
        ) : (
          <div style={{ textAlign:"center", color:"var(--text-dim)" }}>
            <div style={{ fontSize:22, marginBottom:4 }}>📷</div>
            <div style={{ fontSize:10, fontFamily:"var(--font-mono)" }}>Subir / arrastrar</div>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display:"none" }}
        onChange={(e) => { const f = e.target.files[0]; if (f) onFileChange(f); }}
      />
    </div>
  );
}

// ─── Galería de imágenes (detalle) ────────────────────────────────────────────
function ImageGallery({ photos }) {
  const [active, setActive] = useState(0);
  const valid = photos.filter(Boolean);
  if (!valid.length) return null;

  return (
    <section>
      <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
        Fotografías
      </div>

      <div style={{ width:"100%", height:220, borderRadius:8, overflow:"hidden", border:"1px solid var(--border)", background:"var(--bg3)", marginBottom:8, position:"relative" }}>
        <img
          src={valid[active]}
          alt={`Foto ${active + 1}`}
          style={{ width:"100%", height:"100%", objectFit:"contain" }}
          onError={(e) => { e.currentTarget.style.opacity = 0.3; }}
        />
        {valid.length > 1 && (
          <div style={{ position:"absolute", bottom:8, right:10, fontFamily:"var(--font-mono)", fontSize:10, color:"#fff", background:"rgba(0,0,0,0.5)", padding:"2px 8px", borderRadius:10 }}>
            {active + 1} / {valid.length}
          </div>
        )}
      </div>

      {valid.length > 1 && (
        <div style={{ display:"flex", gap:8 }}>
          {valid.map((url, i) => (
            <div
              key={i}
              onClick={() => setActive(i)}
              style={{
                width:60, height:60, borderRadius:6, overflow:"hidden", cursor:"pointer", flexShrink:0,
                border: `2px solid ${i === active ? "var(--accent)" : "var(--border)"}`,
                background:"var(--bg3)", transition:"border-color 0.15s",
              }}
            >
              <img src={url} alt={`Thumb ${i + 1}`} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Products() {
  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [loadingList,   setLoadingList]   = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [modal,         setModal]         = useState(null);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [saving,        setSaving]        = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef(null);
  const { addToast, ToastContainer } = useToast();

  const EMPTY_IMGS = [
    { file: null, preview: null, existingUrl: null },
    { file: null, preview: null, existingUrl: null },
    { file: null, preview: null, existingUrl: null },
  ];
  const [imgSlots, setImgSlots] = useState(EMPTY_IMGS);

  // ── Búsqueda ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoadingList(true);
      try { const { data } = await searchProducts(query); setResults(data); }
      catch { addToast("Error buscando productos", "error"); }
      setLoadingList(false);
      setSelectedIndex(-1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // ── Seleccionar producto ──────────────────────────────────────────────────
  const selectProduct = async (p, idx) => {
    if (idx !== undefined) setSelectedIndex(idx);
    setSelected({ ...p, _loading: true });
    setLoadingDetail(true);
    try { const { data } = await getProduct(p.id); setSelected(data); }
    catch { addToast("Error cargando producto", "error"); }
    setLoadingDetail(false);
  };

  // ── Teclado ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (results.length === 0 || modal) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.min(prev + 1, results.length - 1);
          selectProduct(results[next], next);
          scrollToIndex(next);
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          selectProduct(results[next], next);
          scrollToIndex(next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [results, modal]);

  const scrollToIndex = (idx) => {
    if (!listRef.current) return;
    const item = listRef.current.children[idx];
    if (item) item.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  // ── Helpers de imágenes ───────────────────────────────────────────────────
  const handleImgFile = (slotIdx, file) => {
    const preview = URL.createObjectURL(file);
    setImgSlots((prev) => prev.map((s, i) =>
      i === slotIdx ? { ...s, file, preview } : s
    ));
  };

  const handleImgClear = (slotIdx) => {
    setImgSlots((prev) => prev.map((s, i) =>
      i === slotIdx ? { file: null, preview: null, existingUrl: null } : s
    ));
  };

  const slotDisplayPreview = (slot) => slot.preview || slot.existingUrl || null;

  // ── Abrir modal nuevo ─────────────────────────────────────────────────────
  const openNew = () => {
    setForm(EMPTY_FORM);
    setImgSlots(EMPTY_IMGS);
    setModal("new");
  };

  // ── Abrir modal editar ────────────────────────────────────────────────────
  const openEdit = () => {
    if (!selected) return;
    const prices  = selected.prices || selected.product_prices || [];
    const getPrice = (type) => prices.find((p) => p.price_type === type)?.price || "";
    setForm({
      name:        selected.name        || "",
      code:        selected.code        || "",
      barcode:     selected.barcode     || "",
      box_code:    selected.box_code    || "",
      description: selected.description || "",
      category_id: selected.category_id || "",
      active:      selected.active      ?? true,
      cost:        getPrice("costo")    || selected.cost || "",
      tasa_iva:    selected.tasa_iva    || "",
      despacho:    selected.despacho    || "",
      aduana:      selected.aduana      || "",
      origen:      selected.origen      || "",
      qxb:         selected.qxb         || "",
      fecha:       selected.fecha || selected.created_at?.slice(0,10) || "",
      video_url:   selected.video_url   || "",
      price_1:     getPrice("precio_1") || "",
      price_2:     getPrice("precio_2") || "",
      price_3:     getPrice("precio_3") || "",
      price_4:     getPrice("precio_4") || "",
      price_5:     getPrice("precio_5") || "",
    });

    // ✅ Cargar imágenes desde el array images de la API
    const imgs = selected.images || [];
    setImgSlots([
      { file: null, preview: null, existingUrl: imgs[0]?.url || null },
      { file: null, preview: null, existingUrl: imgs[1]?.url || null },
      { file: null, preview: null, existingUrl: imgs[2]?.url || null },
    ]);
    setModal("edit");
  };

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { addToast("El nombre es obligatorio", "error"); return; }
    setSaving(true);
    try {
      const fd = new FormData();

      Object.entries(form).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) fd.append(k, v);
      });

      imgSlots.forEach((slot) => {
        if (slot.file) fd.append("images", slot.file);
      });

      if (modal === "edit" && selected) {
        await updateProduct(selected.id, fd);
        const { data } = await getProduct(selected.id);
        setSelected(data);
        addToast("Producto actualizado", "success");
      } else {
        await createProduct(fd);
        addToast("Producto creado", "success");
        if (query) { const { data } = await searchProducts(query); setResults(data); }
      }
      setModal(null);
    } catch { addToast("Error guardando producto", "error"); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selected || !confirm(`¿Eliminar "${selected.name}"?`)) return;
    try {
      await deleteProduct(selected.id);
      addToast("Producto eliminado", "success");
      setSelected(null);
      setResults((prev) => prev.filter((p) => p.id !== selected.id));
    } catch { addToast("Error eliminando", "error"); }
  };

  const f = (k) => (e) => setForm((prev) => ({
    ...prev, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
  }));

  // ── Datos del producto seleccionado ──────────────────────────────────────
  const prices  = selected?.prices || selected?.product_prices || [];
  const stock   = selected?.stock  || [];
  const costs   = selected?.costs  || selected?.product_costs  || [];
  const getPrice = (type) => prices.find((p) => p.price_type === type);
  const getCost  = () => getPrice("costo") || (selected?.cost ? { price: selected.cost } : null);

  const totalStock    = stock.reduce((a, s) => a + (Number(s.quantity) || 0), 0);
  const totalReserved = stock.reduce((a, s) => a + (Number(s.reserved) || 0), 0);

  const stockRows = stock.length > 0
    ? stock.map((s) => ({ name: s.warehouse?.name || s.warehouse_name || s.warehouse_id, qty: s.quantity, res: s.reserved ?? 0 }))
    : WAREHOUSES_DEFAULT.map((w) => ({ name: w, qty: null, res: null }));

  const lastCosts = [...costs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);

  // ✅ Ahora lee desde el array images de la API
  const selectedPhotos = selected?.images?.length
    ? selected.images.map((img) => img.url).filter(Boolean)
    : [];

  const LBL = ({ children }) => (
    <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>
      {children}
    </div>
  );

  const Field = ({ label, value, mono, accent, dim }) => (
    <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 14px" }}>
      <LBL>{label}</LBL>
      <div style={{
        fontSize: mono ? 14 : 13,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontWeight: accent ? 700 : 400,
        color: accent ? "var(--accent)" : dim ? "var(--text-dim)" : "var(--text-muted)",
        wordBreak: "break-all",
      }}>
        {value ?? "—"}
      </div>
    </div>
  );

  return (
    <>
      <ToastContainer />
      <div style={{ display:"flex", height:"calc(100vh - 56px)", margin:"-28px", overflow:"hidden" }}>

        {/* ══ PANEL IZQUIERDO — DETALLE ══════════════════════════════════════ */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--bg)" }}>

          {/* Header */}
          <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--bg2)", flexShrink:0 }}>
            <div>
              {selected ? (
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"var(--accent)", background:"var(--accent-dim)", padding:"3px 10px", borderRadius:4 }}>
                    {selected.code || "—"}
                  </span>
                  <span style={{ fontSize:14, fontWeight:600, color:"var(--text)", maxWidth:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {selected.name}
                  </span>
                  <span className={`badge ${selected.active !== false ? "badge-success" : "badge-danger"}`}>
                    {selected.active !== false ? "ACTIVO" : "INACTIVO"}
                  </span>
                </div>
              ) : (
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", letterSpacing:"0.1em", textTransform:"uppercase" }}>
                  Seleccioná un producto →
                </span>
              )}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nuevo</button>
              {selected && <>
                <button className="btn btn-ghost btn-sm" onClick={openEdit}>✏️ Editar</button>
                <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑️</button>
              </>}
            </div>
          </div>

          {/* Cuerpo scrolleable */}
          <div style={{ flex:1, overflowY:"auto", padding:24 }}>
            {!selected ? (
              <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, color:"var(--text-dim)" }}>
                <span style={{ fontSize:52 }}>🏷️</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:12, letterSpacing:"0.08em" }}>
                  Buscá y seleccioná un producto de la lista →
                </span>
              </div>
            ) : loadingDetail ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:12 }}>
                Cargando...
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:22 }}>

                {/* ── 1: Identificación ── */}
                <section>
                  <LBL>Identificación</LBL>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                    <Field label="Código"   value={selected.code}    mono accent />
                    <Field label="Barcode"  value={selected.barcode} mono />
                    <Field label="Box Code" value={selected.box_code} mono />
                    <Field label="QxB"      value={VAL(selected.qxb) ?? "—"} mono />
                  </div>
                  <div style={{ marginTop:10, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 14px" }}>
                    <LBL>Detalle / Descripción</LBL>
                    <div style={{ fontSize:14, color:"var(--text)", fontWeight:500 }}>{selected.description || selected.name || "—"}</div>
                  </div>
                </section>

                {/* ── 2: Fotos ── */}
                {selectedPhotos.length > 0 && (
                  <ImageGallery photos={selectedPhotos} />
                )}

                {/* ── 3: Precios ── */}
                <section>
                  <LBL>Precios</LBL>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                    {(() => {
                      const c = getCost();
                      return (
                        <div style={{ background:"rgba(224,85,85,0.08)", border:"1px solid rgba(224,85,85,0.25)", borderRadius:6, padding:"12px 14px" }}>
                          <LBL>Costo</LBL>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700, color:"var(--danger)" }}>
                            {c ? `$${FMT(c.price)}` : "—"}
                          </div>
                          {c?.currency && c.currency !== "ARS" && (
                            <div style={{ fontSize:11, color:"var(--text-dim)", marginTop:4 }}>{c.currency}</div>
                          )}
                        </div>
                      );
                    })()}
                    {[1,2,3,4,5].map((n) => {
                      const p = getPrice(`precio_${n}`);
                      return (
                        <div key={n} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"12px 14px" }}>
                          <LBL>Precio #{n}</LBL>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700, color: p ? "var(--accent)" : "var(--text-dim)" }}>
                            {p ? `$${FMT(p.price)}` : "—"}
                          </div>
                          {p?.currency && p.currency !== "ARS" && (
                            <div style={{ fontSize:11, color:"var(--text-dim)", marginTop:4 }}>{p.currency}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* ── 4: Impuestos / Logística ── */}
                <section>
                  <LBL>Impuestos y logística</LBL>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                    <Field label="Tasa IVA" value={VAL(selected.tasa_iva) != null ? `${selected.tasa_iva}%` : null} mono />
                    <Field label="Despacho" value={selected.despacho} mono />
                    <Field label="Aduana"   value={selected.aduana}   mono />
                    <Field label="Origen"   value={selected.origen}   />
                  </div>
                </section>

                {/* ── 5: Stock ── */}
                <section>
                  <LBL>Stock por depósito</LBL>
                  <div style={{ border:"1px solid var(--border)", borderRadius:6, overflow:"hidden" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr style={{ background:"var(--bg3)" }}>
                          {["Depósito","Completo","Reservado"].map((h, i) => (
                            <th key={h} style={{ padding:"8px 14px", textAlign:i===0?"left":"right", fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--text-dim)", borderBottom:"1px solid var(--border)" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stockRows.map((row, i) => (
                          <tr key={row.name} style={{ borderBottom: i < stockRows.length-1 ? "1px solid var(--border)" : "none" }}>
                            <td style={{ padding:"8px 14px", fontSize:13 }}>{row.name}</td>
                            <td style={{ padding:"8px 14px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:600,
                              color: row.qty === null ? "var(--text-dim)" : row.qty > 0 ? "var(--success)" : row.qty < 0 ? "var(--danger)" : "var(--text-muted)"
                            }}>
                              {row.qty === null ? "—" : FMTN(row.qty)}
                            </td>
                            <td style={{ padding:"8px 14px", textAlign:"right", fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>
                              {row.res === null ? "—" : FMTN(row.res)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {stock.length > 0 && (
                        <tfoot>
                          <tr style={{ background:"var(--bg3)", borderTop:"2px solid var(--border)" }}>
                            <td style={{ padding:"9px 14px", fontFamily:"var(--font-mono)", fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Totales</td>
                            <td style={{ padding:"9px 14px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:800, color:"var(--accent)", fontSize:15 }}>{FMTN(totalStock)}</td>
                            <td style={{ padding:"9px 14px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--text-muted)" }}>{FMTN(totalReserved)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  {VAL(selected.punto_pedido) != null && (
                    <div style={{ marginTop:8, fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)" }}>
                      Punto de pedido: <span style={{ color:"var(--accent)" }}>{selected.punto_pedido}</span>
                    </div>
                  )}
                </section>

                {/* ── 6: Historial de costos ── */}
                {lastCosts.length > 0 && (
                  <section>
                    <LBL>Historial de costos</LBL>
                    <div style={{ display:"flex", gap:10 }}>
                      {lastCosts.map((c, i) => (
                        <div key={i} style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 14px" }}>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", marginBottom:4 }}>
                            {c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR") : `Costo ${i+1}`}
                          </div>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, color:"var(--danger)" }}>
                            ${FMT(c.cost)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── 7: Clasificación ── */}
                <section>
                  <LBL>Clasificación y datos adicionales</LBL>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                    <Field label="Rubro / Categoría" value={selected.category?.name || selected.category_name || selected.category_id || "—"} />
                    <Field label="Fecha alta" value={selected.fecha || (selected.created_at ? new Date(selected.created_at).toLocaleDateString("es-AR") : null)} mono />
                    <Field label="Estado" value={selected.active !== false ? "Activo" : "Inactivo"} />
                  </div>
                </section>

                {/* ── 8: Video ── */}
                {selected.video_url && (
                  <section>
                    <LBL>Video</LBL>
                    <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:18 }}>▶</span>
                      <a href={selected.video_url} target="_blank" rel="noreferrer"
                        style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--info)", textDecoration:"none", wordBreak:"break-all" }}>
                        {selected.video_url}
                      </a>
                    </div>
                  </section>
                )}

                {/* ── 9: ID técnico ── */}
                <section style={{ opacity:0.5 }}>
                  <LBL>ID interno</LBL>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)" }}>{selected.id}</div>
                </section>

              </div>
            )}
          </div>
        </div>

        {/* ══ PANEL DERECHO — LISTA ══════════════════════════════════════════ */}
        <div style={{ width:320, flexShrink:0, display:"flex", flexDirection:"column", background:"var(--bg2)", borderLeft:"1px solid var(--border)" }}>

          <div style={{ padding:"16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input
                placeholder="Código o nombre..."
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
              {loadingList
                ? "Buscando..."
                : results.length > 0
                  ? `${results.length} producto${results.length !== 1 ? "s" : ""}`
                  : query ? "Sin resultados" : "Escribí para buscar"}
            </div>
          </div>

          <div ref={listRef} style={{ flex:1, overflowY:"auto" }}>
            {results.map((p, i) => {
              const isSelected = selectedIndex === i || (selectedIndex === -1 && selected?.id === p.id);
              return (
                <div key={p.id} onClick={() => selectProduct(p, i)}
                  style={{
                    padding:"10px 14px", borderBottom:"1px solid var(--border)", cursor:"pointer",
                    background: isSelected ? "var(--accent-dim)" : "transparent",
                    borderLeft: `3px solid ${isSelected ? "var(--accent)" : "transparent"}`,
                    transition:"background 0.1s",
                    display:"flex", alignItems:"center", gap:10,
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg3)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color: isSelected ? "var(--accent)" : "var(--text-dim)", width:62, flexShrink:0, overflow:"hidden", textOverflow:"ellipsis" }}>
                    {p.code || "—"}
                  </span>
                  <span style={{ fontSize:12, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight: isSelected ? 500 : 400 }}>
                    {p.name}
                  </span>
                  {isSelected && <span style={{ color:"var(--accent)", fontSize:10, flexShrink:0 }}>◀</span>}
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
                ↑<br />Buscá por código<br />o nombre de producto
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div style={{ padding:"10px 16px", borderTop:"1px solid var(--border)", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:"0.06em", background:"var(--bg3)", flexShrink:0 }}>
              {results.length} PRODUCTOS · ↕ SCROLL
            </div>
          )}
        </div>
      </div>

      {/* ══ MODAL NUEVO / EDITAR ══════════════════════════════════════════════ */}
      {modal && (
        <Modal
          title={modal === "edit" ? `Editar — ${selected?.code || selected?.name}` : "Nuevo producto"}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : modal === "edit" ? "Guardar cambios" : "Crear producto"}
            </button>
          </>}
        >
          {/* Identificación */}
          <div className="input-group">
            <label className="input-label">Nombre / Detalle *</label>
            <input className="input" value={form.name} onChange={f("name")} placeholder="Descripción del producto" />
          </div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Código</label>
              <input className="input" value={form.code} onChange={f("code")} placeholder="AV5847" />
            </div>
            <div className="input-group">
              <label className="input-label">Barcode</label>
              <input className="input" value={form.barcode} onChange={f("barcode")} placeholder="7790001111111" />
            </div>
          </div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Box Code</label>
              <input className="input" value={form.box_code} onChange={f("box_code")} placeholder="890" />
            </div>
            <div className="input-group">
              <label className="input-label">QxB</label>
              <input className="input" type="number" value={form.qxb} onChange={f("qxb")} placeholder="36" />
            </div>
          </div>

          <hr className="divider" />

          {/* Imágenes */}
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>
            Imágenes del producto
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:4 }}>
            {["Foto principal", "Foto 2", "Foto 3"].map((label, i) => (
              <ImageUploadSlot
                key={i}
                label={label}
                file={imgSlots[i].file}
                preview={slotDisplayPreview(imgSlots[i])}
                onFileChange={(file) => handleImgFile(i, file)}
                onClear={() => handleImgClear(i)}
              />
            ))}
          </div>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", marginBottom:2 }}>
            Formatos: JPG, PNG, WEBP · Arrastrá o hacé click en cada slot
          </div>

          <hr className="divider" />

          {/* Precios */}
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Precios</div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Costo</label>
              <input className="input" type="number" value={form.cost} onChange={f("cost")} placeholder="0.00" />
            </div>
            <div className="input-group">
              <label className="input-label">Tasa IVA (%)</label>
              <input className="input" type="number" value={form.tasa_iva} onChange={f("tasa_iva")} placeholder="21" />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {[1,2,3,4,5].map((n) => (
              <div className="input-group" key={n}>
                <label className="input-label">Precio #{n}</label>
                <input className="input" type="number" value={form[`price_${n}`]} onChange={f(`price_${n}`)} placeholder="0.00" />
              </div>
            ))}
          </div>

          <hr className="divider" />

          {/* Logística */}
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Logística</div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Despacho</label>
              <input className="input" value={form.despacho} onChange={f("despacho")} />
            </div>
            <div className="input-group">
              <label className="input-label">Aduana</label>
              <input className="input" value={form.aduana} onChange={f("aduana")} />
            </div>
          </div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Origen</label>
              <input className="input" value={form.origen} onChange={f("origen")} placeholder="China, Brasil..." />
            </div>
            <div className="input-group">
              <label className="input-label">Categoría ID</label>
              <input className="input" value={form.category_id} onChange={f("category_id")} placeholder="UUID" />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">URL Video</label>
            <input className="input" value={form.video_url} onChange={f("video_url")} placeholder="https://youtube.com/..." />
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:4 }}>
            <input type="checkbox" id="active" checked={form.active} onChange={f("active")} style={{ accentColor:"var(--accent)", width:15, height:15 }} />
            <label htmlFor="active" style={{ fontSize:13, color:"var(--text-muted)", cursor:"pointer" }}>Producto activo</label>
          </div>
        </Modal>
      )}
    </>
  );
}
