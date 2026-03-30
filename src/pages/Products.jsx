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
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <div style={{ fontSize:11, fontFamily:"var(--font-sans)", fontWeight:500, color:"var(--text-muted)" }}>
        {label}
      </div>
      <div
        onClick={() => !preview && inputRef.current?.click()}
        style={{
          width:"100%", height:90, borderRadius:6,
          border: preview ? "2px solid var(--accent)" : "2px dashed var(--border-mid)",
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
                position:"absolute", top:4, right:4,
                background:"rgba(0,0,0,0.55)", border:"none", borderRadius:"50%",
                width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer", color:"#fff", fontSize:10, lineHeight:1,
              }}
            >✕</button>
          </>
        ) : (
          <div style={{ textAlign:"center", color:"var(--text-dim)" }}>
            <div style={{ fontSize:18, marginBottom:2 }}>+</div>
            <div style={{ fontSize:10, fontFamily:"var(--font-sans)" }}>Subir</div>
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

// ─── Galería de imágenes compacta (tira deslizable) ──────────────────────────
function ImageGallery({ photos }) {
  const [active, setActive] = useState(0);
  const valid = photos.filter(Boolean);
  if (!valid.length) return null;

  return (
    <div style={{ width:130 }}>
      {/* Imagen principal compacta */}
      <div style={{ width:130, height:120, borderRadius:7, overflow:"hidden", border:"1px solid var(--border)", background:"var(--bg3)", marginBottom:5, position:"relative" }}>
        <img
          src={valid[active]}
          alt={`Foto ${active + 1}`}
          style={{ width:"100%", height:"100%", objectFit:"contain" }}
          onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
        />
        {valid.length > 1 && (
          <div style={{ position:"absolute", bottom:4, right:5, fontFamily:"var(--font-mono)", fontSize:9, color:"var(--text-muted)", background:"rgba(255,255,255,0.9)", padding:"1px 5px", borderRadius:8, border:"1px solid var(--border)" }}>
            {active + 1}/{valid.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {valid.length > 1 && (
        <div style={{ display:"flex", gap:4, overflowX:"auto", paddingBottom:2 }}>
          {valid.map((url, i) => (
            <div
              key={i}
              onClick={() => setActive(i)}
              style={{
                width:36, height:36, borderRadius:4, overflow:"hidden", cursor:"pointer", flexShrink:0,
                border: `2px solid ${i === active ? "var(--accent)" : "var(--border)"}`,
                opacity: i === active ? 1 : 0.65,
                transition:"all 0.13s",
              }}
            >
              <img src={url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            </div>
          ))}
        </div>
      )}
    </div>
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
    { file: null, preview: null, existingKey: null },
    { file: null, preview: null, existingKey: null },
    { file: null, preview: null, existingKey: null },
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
      i === slotIdx ? { file: null, preview: null, existingKey: null } : s
    ));
  };

  const slotDisplayPreview = (slot) => slot.preview || null;

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

    // Cargar imágenes desde el array images de la API — guardar la key para poder conservarla
    const imgs = selected.images || [];
    setImgSlots([
      { file: null, preview: imgs[0]?.url || null, existingKey: imgs[0]?.key || null },
      { file: null, preview: imgs[1]?.url || null, existingKey: imgs[1]?.key || null },
      { file: null, preview: imgs[2]?.url || null, existingKey: imgs[2]?.key || null },
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

      // Para edición: mandar las keys existentes que se conservan (las que no se borraron)
      if (modal === "edit") {
        imgSlots.forEach((slot) => {
          if (slot.existingKey) fd.append("keepImages", slot.existingKey);
        });
      }

      // Mandar archivos nuevos slot por slot con su índice
      imgSlots.forEach((slot, idx) => {
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
    <div style={{ fontSize:11, fontFamily:"var(--font-sans)", fontWeight:500, color:"var(--text-muted)", marginBottom:6 }}>
      {children}
    </div>
  );

  const Field = ({ label, value, mono, accent, dim }) => (
    <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"9px 12px" }}>
      <LBL>{label}</LBL>
      <div style={{
        fontSize: 13,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontWeight: accent ? 600 : 400,
        color: accent ? "var(--accent)" : dim ? "var(--text-dim)" : "var(--text)",
        wordBreak: "break-all",
      }}>
        {value ?? "—"}
      </div>
    </div>
  );

  return (
    <>
      <ToastContainer />
      <div style={{ display:"flex", height:"calc(100vh - 56px)", margin:"-24px", overflow:"hidden" }}>

        {/* ══ PANEL IZQUIERDO — DETALLE ══════════════════════════════════════ */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--bg)" }}>

          {/* Header */}
          <div style={{ padding:"12px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--bg2)", flexShrink:0 }}>
            <div>
              {selected ? (
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:12, fontWeight:600, color:"var(--accent)", background:"var(--accent-light)", padding:"2px 9px", borderRadius:4 }}>
                    {selected.code || "—"}
                  </span>
                  <span style={{ fontSize:14, fontWeight:600, color:"var(--text)", maxWidth:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {selected.name}
                  </span>
                  <span className={`badge ${selected.active !== false ? "badge-success" : "badge-danger"}`}>
                    {selected.active !== false ? "Activo" : "Inactivo"}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize:13, color:"var(--text-dim)" }}>
                  Seleccioná un producto →
                </span>
              )}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nuevo</button>
              {selected && <>
                <button className="btn btn-ghost btn-sm" onClick={openEdit}>Editar</button>
                <button className="btn btn-danger btn-sm" onClick={handleDelete}>Eliminar</button>
              </>}
            </div>
          </div>

          {/* Cuerpo — dos columnas fijas, sin scroll vertical en la vista principal */}
          <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
            {!selected ? (
              <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, color:"var(--text-dim)" }}>
                <span style={{ fontSize:40 }}>🏷️</span>
                <span style={{ fontSize:13 }}>Buscá y seleccioná un producto de la lista →</span>
              </div>
            ) : loadingDetail ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"var(--text-dim)", fontSize:13 }}>
                Cargando...
              </div>
            ) : (
              /* Layout en dos columnas: izquierda datos, derecha stock */
              <div style={{ display:"flex", height:"100%", gap:0, overflow:"hidden" }}>

                {/* ── COLUMNA IZQUIERDA: identificación + foto + precios + logística ── */}
                <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:14, borderRight:"1px solid var(--border)" }}>

                  {/* Identificación */}
                  <section>
                    <LBL>Identificación</LBL>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                      <Field label="Código"   value={selected.code}    mono accent />
                      <Field label="Barcode"  value={selected.barcode} mono />
                      <Field label="Box Code" value={selected.box_code} mono />
                      <Field label="QxB"      value={VAL(selected.qxb) ?? "—"} mono />
                    </div>
                    <div style={{ marginTop:6, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"7px 10px" }}>
                      <LBL>Descripción</LBL>
                      <div style={{ fontSize:13, color:"var(--text)", fontWeight:500 }}>{selected.description || selected.name || "—"}</div>
                    </div>
                  </section>

                  {/* Foto + Precios en fila */}
                  <section>
                    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      {/* Foto compacta */}
                      {selectedPhotos.length > 0 && (
                        <div style={{ flexShrink:0 }}>
                          <LBL>Foto</LBL>
                          <ImageGallery photos={selectedPhotos} />
                        </div>
                      )}

                      {/* Precios compactos — tabla inline */}
                      <div style={{ flex:1 }}>
                        <LBL>Precios</LBL>
                        <div style={{ border:"1px solid var(--border)", borderRadius:7, overflow:"hidden", background:"var(--bg2)" }}>
                          {/* Costo */}
                          {(() => {
                            const c = getCost();
                            return (
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 10px", background:"#fff5f5", borderBottom:"1px solid rgba(220,38,38,0.12)" }}>
                                <span style={{ fontSize:11, color:"var(--danger)", fontWeight:500 }}>Costo</span>
                                <span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"var(--danger)" }}>
                                  {c ? `$${FMT(c.price)}` : "—"}
                                </span>
                              </div>
                            );
                          })()}
                          {/* Precios 1-5 */}
                          {[1,2,3,4,5].map((n, idx) => {
                            const p = getPrice(`precio_${n}`);
                            const isLast = idx === 4;
                            return (
                              <div key={n} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 10px", borderBottom: isLast ? "none" : "1px solid var(--border)", background: p ? "var(--accent-light)" : "transparent" }}>
                                <span style={{ fontSize:11, color:"var(--text-muted)", fontWeight:500 }}>Precio #{n}</span>
                                <span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight: p ? 700 : 400, color: p ? "var(--accent)" : "var(--text-dim)" }}>
                                  {p ? `$${FMT(p.price)}` : "—"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Logística — fila compacta */}
                  <section>
                    <LBL>Logística</LBL>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                      <Field label="IVA"      value={VAL(selected.tasa_iva) != null ? `${selected.tasa_iva}%` : null} mono />
                      <Field label="Despacho" value={selected.despacho} mono />
                      <Field label="Aduana"   value={selected.aduana}   mono />
                      <Field label="Origen"   value={selected.origen}   />
                    </div>
                  </section>

                  {/* Clasificación */}
                  <section>
                    <LBL>Clasificación</LBL>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                      <Field label="Categoría" value={selected.category?.name || selected.category_name || selected.category_id || "—"} />
                      <Field label="Fecha alta" value={selected.fecha || (selected.created_at ? new Date(selected.created_at).toLocaleDateString("es-AR") : null)} mono />
                      <Field label="Estado"    value={selected.active !== false ? "Activo" : "Inactivo"} />
                    </div>
                  </section>

                  {/* Historial de costos */}
                  {lastCosts.length > 0 && (
                    <section>
                      <LBL>Historial de costos</LBL>
                      <div style={{ display:"flex", gap:6 }}>
                        {lastCosts.map((c, i) => (
                          <div key={i} style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"7px 10px" }}>
                            <div style={{ fontSize:10, color:"var(--text-dim)", marginBottom:2 }}>
                              {c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR") : `Costo ${i+1}`}
                            </div>
                            <div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"var(--danger)" }}>
                              ${FMT(c.cost)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Video */}
                  {selected.video_url && (
                    <section>
                      <LBL>Video</LBL>
                      <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"7px 10px", display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:13 }}>▶</span>
                        <a href={selected.video_url} target="_blank" rel="noreferrer"
                          style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--info)", textDecoration:"none", wordBreak:"break-all" }}>
                          {selected.video_url}
                        </a>
                      </div>
                    </section>
                  )}

                  {/* ID técnico */}
                  <section style={{ opacity:0.4, marginTop:"auto", paddingTop:4 }}>
                    <LBL>ID interno</LBL>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)" }}>{selected.id}</div>
                  </section>
                </div>

                {/* ── COLUMNA DERECHA: stock ── */}
                <div style={{ width:280, flexShrink:0, display:"flex", flexDirection:"column", background:"var(--sidebar-stock-bg, #f0f6ff)" }}>
                  <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--accent)", flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:"#fff", textTransform:"uppercase", letterSpacing:"0.06em" }}>Stock por depósito</span>
                    {stock.length > 0 && (
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"#fff", background:"rgba(255,255,255,0.2)", padding:"1px 8px", borderRadius:4 }}>
                        {FMTN(totalStock)}
                      </span>
                    )}
                  </div>
                  <div style={{ flex:1, overflowY:"auto" }}>
                    {stockRows.map((row, i) => {
                      const hasQty = row.qty !== null;
                      const isPos  = hasQty && row.qty > 0;
                      const isNeg  = hasQty && row.qty < 0;
                      return (
                        <div key={row.name} style={{
                          display:"flex", alignItems:"center", justifyContent:"space-between",
                          padding:"8px 14px", borderBottom:"1px solid var(--border)",
                          background: isPos ? "rgba(37,99,235,0.04)" : "transparent",
                        }}>
                          <span style={{ fontSize:12, color:"var(--text-muted)", flex:1 }}>{row.name}</span>
                          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                            {row.res !== null && row.res > 0 && (
                              <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--warning)", background:"var(--warning-dim)", padding:"1px 6px", borderRadius:3 }}>
                                R:{FMTN(row.res)}
                              </span>
                            )}
                            <span style={{
                              fontFamily:"var(--font-mono)", fontSize:13, fontWeight:600, minWidth:32, textAlign:"right",
                              color: !hasQty ? "var(--text-dim)" : isPos ? "var(--accent)" : isNeg ? "var(--danger)" : "var(--text-muted)"
                            }}>
                              {!hasQty ? "—" : FMTN(row.qty)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {stock.length > 0 && (
                    <div style={{ padding:"10px 14px", borderTop:"2px solid var(--accent)", background:"var(--accent-light)", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:600, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.04em" }}>Total</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, color:"var(--accent)" }}>{FMTN(totalStock)}</span>
                    </div>
                  )}
                  {VAL(selected.punto_pedido) != null && (
                    <div style={{ padding:"6px 14px", borderTop:"1px solid var(--border)", fontSize:11, color:"var(--text-muted)", background:"var(--bg3)" }}>
                      Punto de pedido: <span style={{ color:"var(--accent)", fontWeight:600 }}>{selected.punto_pedido}</span>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>

        {/* ══ PANEL DERECHO — LISTA ══════════════════════════════════════════ */}
        <div style={{ width:290, flexShrink:0, display:"flex", flexDirection:"column", background:"var(--bg2)", borderLeft:"1px solid var(--border)" }}>

          <div style={{ padding:"12px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
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
            <div style={{ marginTop:6, fontSize:11, color:"var(--text-dim)" }}>
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
                    padding:"9px 12px", borderBottom:"1px solid var(--border)", cursor:"pointer",
                    background: isSelected ? "var(--accent-light)" : "transparent",
                    borderLeft: `3px solid ${isSelected ? "var(--accent)" : "transparent"}`,
                    transition:"background 0.1s",
                    display:"flex", alignItems:"center", gap:8,
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg3)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color: isSelected ? "var(--accent)" : "var(--text-dim)", width:56, flexShrink:0, overflow:"hidden", textOverflow:"ellipsis" }}>
                    {p.code || "—"}
                  </span>
                  <span style={{ fontSize:12, color: isSelected ? "var(--text)" : "var(--text-muted)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight: isSelected ? 500 : 400 }}>
                    {p.name}
                  </span>
                </div>
              );
            })}

            {!loadingList && results.length === 0 && query && (
              <div style={{ padding:"40px 16px", textAlign:"center", color:"var(--text-dim)", fontSize:12, lineHeight:1.8 }}>
                Sin resultados para<br /><span style={{ color:"var(--text-muted)" }}>"{query}"</span>
              </div>
            )}
            {!query && (
              <div style={{ padding:"60px 16px", textAlign:"center", color:"var(--text-dim)", fontSize:12, lineHeight:2.4 }}>
                ↑<br />Buscá por código<br />o nombre de producto
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div style={{ padding:"8px 12px", borderTop:"1px solid var(--border)", fontSize:10.5, color:"var(--text-dim)", background:"var(--bg3)", flexShrink:0 }}>
              {results.length} resultados · ↕ Scroll
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
          <div style={{ fontFamily:"var(--font-sans)", fontSize:11, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:8 }}>
            Imágenes del producto
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:4 }}>
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
          <div style={{ fontFamily:"var(--font-sans)", fontSize:11, color:"var(--text-dim)", marginBottom:2 }}>
            Formatos: JPG, PNG, WEBP · Arrastrá o hacé click en cada slot
          </div>

          <hr className="divider" />

          {/* Precios */}
          <div style={{ fontFamily:"var(--font-sans)", fontSize:11, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:8 }}>Precios</div>
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
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {[1,2,3,4,5].map((n) => (
              <div className="input-group" key={n}>
                <label className="input-label">Precio #{n}</label>
                <input className="input" type="number" value={form[`price_${n}`]} onChange={f(`price_${n}`)} placeholder="0.00" />
              </div>
            ))}
          </div>

          <hr className="divider" />

          {/* Logística */}
          <div style={{ fontFamily:"var(--font-sans)", fontSize:11, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:8 }}>Logística</div>
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
