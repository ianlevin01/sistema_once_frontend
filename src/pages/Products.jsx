import React, { useState, useEffect, useRef, useCallback } from "react";
import Modal from "../components/Modal";
import { searchProducts, getProduct, createProduct, updateProduct, deleteProduct, getCategories, createCategory, setProductOverride, deleteProductOverride, subirProducto, agregarStock, exportProducts, importProductsDiff, importProductsApply, getWarehouses } from "../utils/api";
import { useToast } from "../utils/useToast";
import { useAuth } from "../utils/useAuth";

const EMPTY_FORM = {
  name: "", code: "", barcode: "", box_code: "", description: "",
  category_id: "", active: true, costo_usd: "", tasa_iva: "", despacho: "",
  aduana: "", origen: "", qxb: "", fecha: "", video_url: "",
};

const FMTARS = (v) => v != null ? `$${Number(v).toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : "—";
const FMTUSD = (v) => v != null ? `USD ${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

const WAREHOUSES_DEFAULT = [];

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
            <img src={preview} alt={label} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
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

// ─── Galería de imágenes compacta ─────────────────────────────────────────────
function ImageGallery({ photos }) {
  const [active, setActive] = useState(0);
  const valid = photos.filter(Boolean);
  if (!valid.length) return null;

  return (
    <div style={{ width:280 }}>
      <div style={{ width:280, height:260, borderRadius:7, overflow:"hidden", border:"1px solid var(--border)", background:"var(--bg3)", marginBottom:6, position:"relative" }}>
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
      {valid.length > 1 && (
        <div style={{ display:"flex", gap:5, overflowX:"auto", paddingBottom:2 }}>
          {valid.map((url, i) => (
            <div
              key={i}
              onClick={() => setActive(i)}
              style={{
                width:68, height:68, borderRadius:5, overflow:"hidden", cursor:"pointer", flexShrink:0,
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
  useEffect(() => { document.title = "Productos — Once"; }, []);
  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [loadingList,   setLoadingList]   = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [modal,         setModal]         = useState(null);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [saving,        setSaving]        = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef     = useRef(null);
  const searchIdRef = useRef(0);
  const { addToast, ToastContainer } = useToast();
  const { user } = useAuth();
  const isVendedor = user?.role === "vendedor";

  // ── Tab / Import-Export ───────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState("catalogo");
  const [importFile,     setImportFile]     = useState(null);
  const [importFileName, setImportFileName] = useState("");
  const [includeStock,   setIncludeStock]   = useState(true);
  const [diffLoading,    setDiffLoading]    = useState(false);
  const [diffResult,     setDiffResult]     = useState(null);
  const [selectedCodes,  setSelectedCodes]  = useState(new Set());
  const [expandedRows,   setExpandedRows]   = useState(new Set());
  const [applying,       setApplying]       = useState(false);
  const fileInputRef = useRef(null);

  // ── Agregar stock ────────────────────────────────────────────────────────
  const [stockModal,  setStockModal]  = useState(false);
  const [stockQty,    setStockQty]    = useState("");
  const [stockSaving, setStockSaving] = useState(false);

  const handleAgregarStock = async () => {
    const qty = Number(stockQty);
    if (!qty || qty <= 0) { addToast("Ingresá una cantidad válida", "error"); return; }
    setStockSaving(true);
    try {
      await agregarStock(selected.id, qty);
      addToast(`+${qty} unidades agregadas al depósito`, "success");
      setStockModal(false);
      setStockQty("");
      const { data } = await getProduct(selected.id);
      setSelected(data);
    } catch (err) {
      addToast(err?.response?.data?.message || "Error agregando stock", "error");
    }
    setStockSaving(false);
  };

  // ── Price overrides ───────────────────────────────────────────────────────
  const [overrideModal,   setOverrideModal]   = useState(false);
  const [overrideForm,    setOverrideForm]    = useState({ pct_1:"", pct_2:"", pct_3:"", pct_4:"", pct_5:"" });
  const [savingOverride,  setSavingOverride]  = useState(false);

  const openOverrideModal = () => {
    setOverrideForm({
      pct_1: selected.ovr_pct_1 != null ? String(selected.ovr_pct_1) : "",
      pct_2: selected.ovr_pct_2 != null ? String(selected.ovr_pct_2) : "",
      pct_3: selected.ovr_pct_3 != null ? String(selected.ovr_pct_3) : "",
      pct_4: selected.ovr_pct_4 != null ? String(selected.ovr_pct_4) : "",
      pct_5: selected.ovr_pct_5 != null ? String(selected.ovr_pct_5) : "",
    });
    setOverrideModal(true);
  };

  const handleSaveOverride = async () => {
    setSavingOverride(true);
    try {
      await setProductOverride(selected.id, {
        pct_1: overrideForm.pct_1 !== "" ? Number(overrideForm.pct_1) : null,
        pct_2: overrideForm.pct_2 !== "" ? Number(overrideForm.pct_2) : null,
        pct_3: overrideForm.pct_3 !== "" ? Number(overrideForm.pct_3) : null,
        pct_4: overrideForm.pct_4 !== "" ? Number(overrideForm.pct_4) : null,
        pct_5: overrideForm.pct_5 !== "" ? Number(overrideForm.pct_5) : null,
      });
      addToast("Porcentajes guardados", "success");
      setOverrideModal(false);
      const { data } = await getProduct(selected.id);
      setSelected(data);
    } catch { addToast("Error guardando porcentajes", "error"); }
    setSavingOverride(false);
  };

  const handleDeleteOverride = async () => {
    setSavingOverride(true);
    try {
      await deleteProductOverride(selected.id);
      addToast("Porcentajes restablecidos al global", "success");
      setOverrideModal(false);
      const { data } = await getProduct(selected.id);
      setSelected(data);
    } catch { addToast("Error", "error"); }
    setSavingOverride(false);
  };

  // ── Warehouses ───────────────────────────────────────────────────────────
  const [warehouseList, setWarehouseList] = useState([]);

  useEffect(() => {
    getWarehouses().then(({ data }) => setWarehouseList(data || [])).catch(() => {});
  }, []);

  // ── Categorías ────────────────────────────────────────────────────────────
  const [categories,      setCategories]      = useState([]);
  const [catInput,        setCatInput]        = useState("");
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [creatingCat,     setCreatingCat]     = useState(false);
  const catRef = useRef(null);

  // Refs para navegación Enter en el formulario nuevo/editar
  const nameRef     = useRef(null);
  const codeRef     = useRef(null);
  const barcodeRef  = useRef(null);
  const boxCodeRef  = useRef(null);
  const qxbRef      = useRef(null);
  const costoRef    = useRef(null);
  const ivaRef      = useRef(null);
  const despachoRef = useRef(null);
  const aduanaRef   = useRef(null);
  const origenRef   = useRef(null);
  const videoRef    = useRef(null);

  // Foco en el primer campo cuando se abre el modal
  useEffect(() => {
    if (modal) setTimeout(() => nameRef.current?.focus(), 80);
  }, [modal]);

  useEffect(() => {
    getCategories().then(({ data }) => setCategories(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (catRef.current && !catRef.current.contains(e.target)) setCatDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCats = categories.filter((c) =>
    c.name.toLowerCase().includes(catInput.toLowerCase())
  );
  const showCreateOption = catInput.trim() && !categories.some(
    (c) => c.name.toLowerCase() === catInput.trim().toLowerCase()
  );

  const selectCategory = (cat) => {
    setForm((prev) => ({ ...prev, category_id: cat.id }));
    setCatInput(cat.name);
    setCatDropdownOpen(false);
  };

  const handleCreateCategory = async () => {
    if (!catInput.trim()) return;
    setCreatingCat(true);
    try {
      const { data: newCat } = await createCategory(catInput.trim());
      setCategories((prev) => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
      selectCategory(newCat);
      addToast(`Categoría "${newCat.name}" creada`, "success");
    } catch {
      addToast("Error creando categoría", "error");
    }
    setCreatingCat(false);
  };

  const openCategoryPicker = () => {
    setCatInput(form.category_id
      ? (categories.find((c) => c.id === form.category_id)?.name || "")
      : "");
    setCatDropdownOpen(true);
  };

  const EMPTY_IMGS = [
    { file: null, preview: null, existingKey: null },
    { file: null, preview: null, existingKey: null },
    { file: null, preview: null, existingKey: null },
  ];
  const [imgSlots, setImgSlots] = useState(EMPTY_IMGS);

  // ── Búsqueda ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = ++searchIdRef.current;
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoadingList(true);
      try {
        const { data } = await searchProducts(query);
        if (id !== searchIdRef.current) return;
        setResults(data);
        setSelectedIndex(-1);
      } catch {
        if (id !== searchIdRef.current) return;
        addToast("Error buscando productos", "error");
      }
      setLoadingList(false);
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

  const openNew = () => {
    setForm(EMPTY_FORM);
    setImgSlots(EMPTY_IMGS);
    setCatInput("");
    setModal("new");
  };

  const openEdit = () => {
    if (!selected) return;
    setForm({
      name:        selected.name        || "",
      code:        selected.code        || "",
      barcode:     selected.barcode     || "",
      box_code:    selected.box_code    || "",
      description: selected.description || "",
      category_id: selected.category_id || "",
      active:      selected.active      ?? true,
      costo_usd:   selected.costo_usd   || "",
      tasa_iva:    selected.tasa_iva    || "",
      despacho:    selected.despacho    || "",
      aduana:      selected.aduana      || "",
      origen:      selected.origen      || "",
      qxb:         selected.qxb         || "",
      fecha:       selected.fecha || selected.created_at?.slice(0,10) || "",
      video_url:   selected.video_url   || "",
    });
    const imgs = selected.images || [];
    setImgSlots([
      { file: null, preview: imgs[0]?.url || null, existingKey: imgs[0]?.key || null },
      { file: null, preview: imgs[1]?.url || null, existingKey: imgs[1]?.key || null },
      { file: null, preview: imgs[2]?.url || null, existingKey: imgs[2]?.key || null },
    ]);
    setCatInput(selected.category_name || categories.find((c) => c.id === selected.category_id)?.name || "");
    setModal("edit");
  };

  const handleSave = async () => {
    if (!form.name.trim()) { addToast("El nombre es obligatorio", "error"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) fd.append(k, v);
      });
      if (modal === "edit") {
        imgSlots.forEach((slot) => {
          fd.append("keepImages", slot.existingKey || "");
        });
      }
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
    } catch (err) {
      const apiData = err?.response?.data;
      addToast(
        apiData?.message || "Error guardando producto",
        apiData?.deleted ? "warning" : "error"
      );
    }
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

  const handleSubir = async () => {
    if (!selected) return;
    try {
      await subirProducto(selected.id);
      addToast("Producto subido arriba", "success");
    } catch { addToast("Error", "error"); }
  };

  // ── Import/Export handlers ───────────────────────────────────────────────
  const handleExport = async () => {
    try {
      addToast("Generando Excel...", "info");
      const { data } = await exportProducts();
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url; a.download = "productos.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch { addToast("Error generando Excel", "error"); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportFileName(file.name);
    setDiffResult(null);
    setSelectedCodes(new Set());
    setExpandedRows(new Set());
  };

  const handleAnalyze = async () => {
    if (!importFile) return;
    setDiffLoading(true);
    setDiffResult(null);
    setSelectedCodes(new Set());
    setExpandedRows(new Set());
    try {
      const { data } = await importProductsDiff(importFile, includeStock);
      setDiffResult(data);
      const actionable = (data.diff || []).filter((d) => d.status === "modified" || d.status === "new");
      setSelectedCodes(new Set(actionable.map((d) => d.code)));
    } catch (err) {
      addToast(err?.response?.data?.message || "Error analizando Excel", "error");
    }
    setDiffLoading(false);
  };

  const handleApply = async () => {
    if (!importFile || selectedCodes.size === 0) return;
    setApplying(true);
    try {
      const { data } = await importProductsApply(importFile, includeStock, [...selectedCodes]);
      addToast(`${data.applied} producto${data.applied !== 1 ? "s" : ""} actualizados`, "success");
      setDiffResult(null);
      setImportFile(null);
      setImportFileName("");
      setSelectedCodes(new Set());
      setExpandedRows(new Set());
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      addToast(err?.response?.data?.message || "Error aplicando cambios", "error");
    }
    setApplying(false);
  };

  const toggleRowExpand = (code) => setExpandedRows((prev) => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });

  const toggleCode = (code) => setSelectedCodes((prev) => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });

  const actionableDiff = (diffResult?.diff || []).filter((d) => d.status === "modified" || d.status === "new");
  const allSelected = actionableDiff.length > 0 && actionableDiff.every((d) => selectedCodes.has(d.code));

  const FIELD_LABELS = {
    name: "Nombre", costo_usd: "Costo USD", qxb: "QxB",
    category: "Rubro", category_name: "Rubro", barcode: "Barcode", box_code: "Box Code",
    punto_pedido: "Pto. Pedido", active: "Estado",
    precio_1: "Precio #1", precio_2: "Precio #2", precio_3: "Precio #3",
    precio_4: "Precio #4", precio_5: "Precio #5",
    stock: "Stock",
  };

  const f = (k) => (e) => setForm((prev) => ({
    ...prev, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
  }));

  // ── Datos del producto seleccionado ──────────────────────────────────────
  const prices = selected?.prices || selected?.product_prices || [];
  const stock  = selected?.stock  || [];
  const costs  = selected?.costs  || selected?.product_costs  || [];
  const getPrice = (type) => prices.find((p) => p.price_type === type);
  const getCost  = () => getPrice("costo") || (selected?.cost ? { price: selected.cost } : null);

  const totalStock = stock.reduce((a, s) => a + (Number(s.quantity) || 0), 0);

  // Reserva total: suma de los reserved por warehouse (viene del backend)
  // Fallback a stock_reserva global si el backend aún no devuelve reserved por fila
  const totalReserved = stock.some((s) => s.reserved != null)
    ? stock.reduce((a, s) => a + (Number(s.reserved) || 0), 0)
    : (selected?.stock_reserva || 0);

  // stockRows: usa stock real del backend + reserved por warehouse
  const stockRows = stock.length > 0
    ? stock.map((s) => ({
        name:     s.warehouse?.name || s.warehouse_name || s.warehouse_id,
        qty:      s.quantity,
        reserved: Number(s.reserved) || 0,
      }))
    : warehouseList.map((w) => ({ name: w.name, qty: null, reserved: 0 }));

  const lastCosts = [...costs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
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
      <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 56px)", margin:"-24px", overflow:"hidden" }}>

        {/* ══ TAB BAR ════════════════════════════════════════════════════════ */}
        <div style={{ display:"flex", borderBottom:"1px solid var(--border)", background:"var(--bg2)", flexShrink:0 }}>
          {[["catalogo","Catálogo"],["import","Actualización masiva"]].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding:"10px 20px", border:"none", background:"none", cursor:"pointer",
              fontSize:13, fontFamily:"var(--font-sans)", fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "var(--accent)" : "var(--text-muted)",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              transition:"all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {activeTab === "catalogo" ? (
        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

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
                <span style={{ fontSize:13, color:"var(--text-dim)" }}>Seleccioná un producto →</span>
              )}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nuevo</button>
              {selected && <>
                <button className="btn btn-ghost btn-sm" onClick={openEdit}>Editar</button>
                <button className="btn btn-danger btn-sm" onClick={handleDelete}>Eliminar</button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleSubir}
                  title="Mover arriba de todo"
                  style={{ fontSize: 11, color: "var(--accent)" }}
                >↑ Subir</button>
              </>}
            </div>
          </div>

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
              <div style={{ display:"flex", height:"100%", gap:0, overflow:"hidden" }}>

                {/* ── COLUMNA IZQUIERDA: datos ── */}
                <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:14, borderRight:"1px solid var(--border)" }}>

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

                  <section>
                    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      {selectedPhotos.length > 0 && (
                        <div style={{ flexShrink:0 }}>
                          <LBL>Foto</LBL>
                          <ImageGallery photos={selectedPhotos} />
                        </div>
                      )}
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                          <LBL style={{ margin:0 }}>Precios</LBL>
                          {!isVendedor && (
                            <button className="btn btn-ghost" style={{ fontSize:11, padding:"3px 8px" }} onClick={openOverrideModal}>
                              {selected.has_price_override ? "✏️ % personalizados" : "✏️ Porcentajes"}
                            </button>
                          )}
                        </div>
                        <div style={{ border:"1px solid var(--border)", borderRadius:7, overflow:"hidden", background:"var(--bg2)" }}>
                          {isVendedor ? (
                            (() => {
                              const precio1 = (() => {
                                const p = getPrice("precio_1");
                                return p ? Number(p.price) : null;
                              })();
                              const pctV = Number(user?.pct_vendedor ?? 0);
                              const precioPublicacion = precio1 != null ? precio1 * (1 + pctV / 100) : null;
                              const ganancia = precio1 != null && precioPublicacion != null
                                ? (precioPublicacion - precio1) / 2
                                : null;
                              return (
                                <>
                                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", padding:"4px 10px", background:"var(--bg3)", borderBottom:"1px solid var(--border)" }}>
                                    <span style={{ fontSize:10, color:"var(--text-dim)", fontFamily:"var(--font-mono)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Precio base (costo)</span>
                                    <span style={{ fontSize:10, color:"var(--text-dim)", fontFamily:"var(--font-mono)", textTransform:"uppercase", letterSpacing:"0.05em", textAlign:"right" }}>Precio de publicación</span>
                                  </div>
                                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", alignItems:"center", padding:"10px 10px" }}>
                                    <span style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, color:"var(--danger)" }}>
                                      {precio1 != null ? `$${precio1.toLocaleString("es-AR", { minimumFractionDigits:2 })}` : "—"}
                                    </span>
                                    <span style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, color:"var(--accent)", textAlign:"right" }}>
                                      {precioPublicacion != null ? `$${precioPublicacion.toLocaleString("es-AR", { minimumFractionDigits:2 })}` : "—"}
                                    </span>
                                  </div>
                                  {ganancia != null && (
                                    <div style={{ margin:"0 10px 10px", padding:"8px 10px", background:"var(--success-dim)", border:"1px solid var(--success)", borderRadius:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                      <span style={{ fontSize:12, color:"var(--success)", fontWeight:600 }}>Tu ganancia estimada</span>
                                      <span style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color:"var(--success)" }}>
                                        ${ganancia.toLocaleString("es-AR", { minimumFractionDigits:2 })}
                                      </span>
                                    </div>
                                  )}
                                </>
                              );
                            })()
                          ) : (
                            <>
                              <div style={{ display:"grid", gridTemplateColumns:"80px 44px 1fr 1fr", padding:"4px 10px", background:"var(--bg3)", borderBottom:"1px solid var(--border)" }}>
                                <span style={{ fontSize:10, color:"var(--text-dim)", fontFamily:"var(--font-mono)", textTransform:"uppercase", letterSpacing:"0.05em" }}></span>
                                <span style={{ fontSize:10, color:"var(--text-dim)", fontFamily:"var(--font-mono)", textTransform:"uppercase", letterSpacing:"0.05em", textAlign:"center" }}>%</span>
                                <span style={{ fontSize:10, color:"var(--text-dim)", fontFamily:"var(--font-mono)", textTransform:"uppercase", letterSpacing:"0.05em", textAlign:"right" }}>Pesos (ARS)</span>
                                <span style={{ fontSize:10, color:"var(--text-dim)", fontFamily:"var(--font-mono)", textTransform:"uppercase", letterSpacing:"0.05em", textAlign:"right" }}>Dólares (USD)</span>
                              </div>
                              {(() => {
                                const costoUsd   = selected.costo_usd ? Number(selected.costo_usd) : null;
                                const cotizacion = selected.cotizacion_dolar ? Number(selected.cotizacion_dolar) : null;
                                const costoArs   = costoUsd != null && cotizacion != null
                                  ? costoUsd * cotizacion
                                  : (() => { const c = getCost(); return c ? Number(c.price) : null; })();
                                return (
                                  <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 1fr", alignItems:"center", padding:"6px 10px", background:"#fff5f5", borderBottom:"1px solid rgba(220,38,38,0.12)" }}>
                                    <span style={{ fontSize:11, color:"var(--danger)", fontWeight:500 }}>Costo</span>
                                    <span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"var(--danger)", textAlign:"right" }}>
                                      {costoArs != null ? FMTARS(costoArs) : "—"}
                                    </span>
                                    <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)", textAlign:"right" }}>
                                      {costoUsd != null ? FMTUSD(costoUsd) : "—"}
                                    </span>
                                  </div>
                                );
                              })()}
                              {[1,2,3,4,5].map((n, idx) => {
                                const p = getPrice(`precio_${n}`);
                                const isLast = idx === 4;
                                const cotizacion = selected.cotizacion_dolar ? Number(selected.cotizacion_dolar) : null;
                                let arsVal = null, usdVal = null;
                                if (p) {
                                  arsVal = p.price     != null ? Number(p.price)     : null;
                                  usdVal = p.price_usd != null ? Number(p.price_usd)
                                         : (arsVal != null && cotizacion) ? arsVal / cotizacion : null;
                                }
                                const isOverridden = selected[`ovr_pct_${n}`] != null;
                                return (
                                  <div key={n} style={{ display:"grid", gridTemplateColumns:"80px 44px 1fr 1fr", alignItems:"center", padding:"6px 10px", borderBottom: isLast ? "none" : "1px solid var(--border)", background: arsVal != null ? "var(--accent-light)" : "transparent" }}>
                                    <span style={{ fontSize:11, color:"var(--text-muted)", fontWeight:500 }}>Precio #{n}</span>
                                    <span style={{ fontFamily:"var(--font-mono)", fontSize:11, textAlign:"center", color: isOverridden ? "var(--warning)" : "var(--text-dim)", fontWeight: isOverridden ? 700 : 400 }}>
                                      {p ? `${p.pct}%` : "—"}
                                    </span>
                                    <span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight: arsVal != null ? 700 : 400, color: arsVal != null ? "var(--accent)" : "var(--text-dim)", textAlign:"right" }}>
                                      {arsVal != null ? FMTARS(arsVal) : "—"}
                                    </span>
                                    <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)", textAlign:"right" }}>
                                      {usdVal != null ? FMTUSD(usdVal) : "—"}
                                    </span>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <LBL>Logística</LBL>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                      <Field label="IVA"      value={VAL(selected.tasa_iva) != null ? `${selected.tasa_iva}%` : null} mono />
                      <Field label="Despacho" value={selected.despacho} mono />
                      <Field label="Aduana"   value={selected.aduana}   mono />
                      <Field label="Origen"   value={selected.origen}   />
                    </div>
                  </section>

                  <section>
                    <LBL>Clasificación</LBL>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                      <Field label="Categoría"  value={selected.category?.name || selected.category_name || selected.category_id || "—"} />
                      <Field label="Fecha alta" value={selected.fecha || (selected.created_at ? new Date(selected.created_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : null)} mono />
                      <Field label="Estado"     value={selected.active !== false ? "Activo" : "Inactivo"} />
                    </div>
                  </section>

                  {lastCosts.length > 0 && (
                    <section>
                      <LBL>Historial de costos</LBL>
                      <div style={{ display:"flex", gap:6 }}>
                        {lastCosts.map((c, i) => (
                          <div key={i} style={{ flex:1, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"7px 10px" }}>
                            <div style={{ fontSize:10, color:"var(--text-dim)", marginBottom:2 }}>
                              {c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : `Costo ${i+1}`}
                            </div>
                            <div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"var(--danger)" }}>
                              ${FMT(c.cost)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

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

                  <section style={{ opacity:0.4, marginTop:"auto", paddingTop:4 }}>
                    <LBL>ID interno</LBL>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)" }}>{selected.id}</div>
                  </section>
                </div>

                {/* ── COLUMNA DERECHA: stock ── */}
                <div style={{ width:280, flexShrink:0, display:"flex", flexDirection:"column", background:"var(--sidebar-stock-bg, #f0f6ff)" }}>
                  <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--accent)", flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:"#fff", textTransform:"uppercase", letterSpacing:"0.06em" }}>Stock por depósito</span>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      {totalReserved > 0 && (
                        <span style={{ fontFamily:"var(--font-mono)", fontSize:12, fontWeight:700, color:"#fff", background:"rgba(255,200,0,0.35)", padding:"1px 8px", borderRadius:4, border:"1px solid rgba(255,200,0,0.5)" }}>
                          R:{FMTN(totalReserved)}
                        </span>
                      )}
                      {stock.length > 0 && (
                        <span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"#fff", background:"rgba(255,255,255,0.2)", padding:"1px 8px", borderRadius:4 }}>
                          {FMTN(totalStock)}
                        </span>
                      )}
                      {!isVendedor && (
                        <button
                          onClick={() => { setStockQty(""); setStockModal(true); }}
                          style={{ background:"rgba(255,255,255,0.25)", border:"1px solid rgba(255,255,255,0.4)", color:"#fff", borderRadius:4, padding:"2px 8px", fontSize:12, fontWeight:700, cursor:"pointer", lineHeight:1.4 }}
                          title="Agregar stock a tu depósito"
                        >+ Agregar</button>
                      )}
                    </div>
                  </div>

                  {stockModal && (
                    <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", background:"var(--bg2)", flexShrink:0 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>
                        Agregar unidades a tu depósito
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <input
                          className="input"
                          type="number" min="1" step="1"
                          placeholder="Cantidad"
                          value={stockQty}
                          onChange={(e) => setStockQty(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAgregarStock(); if (e.key === "Escape") setStockModal(false); }}
                          style={{ flex:1, height:32, fontSize:13, textAlign:"center", fontFamily:"var(--font-mono)" }}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleAgregarStock} disabled={stockSaving}>
                          {stockSaving ? "..." : "Agregar"}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setStockModal(false)}>✕</button>
                      </div>
                    </div>
                  )}

                  <div style={{ flex:1, overflowY:"auto" }}>
                    {stockRows.map((row, i) => {
                      const hasQty  = row.qty !== null;
                      const isPos   = hasQty && row.qty > 0;
                      const isNeg   = hasQty && row.qty < 0;
                      const hasRes  = row.reserved > 0;

                      return (
                        <div key={`${row.name}-${i}`} style={{
                          display:"flex", alignItems:"center", justifyContent:"space-between",
                          padding:"8px 14px", borderBottom:"1px solid var(--border)",
                          background: isPos ? "rgba(37,99,235,0.04)" : "transparent",
                        }}>
                          <span style={{ fontSize:12, color:"var(--text-muted)", flex:1 }}>{row.name}</span>
                          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                            {/* Reservas por depósito — ahora viene del backend por warehouse */}
                            {hasRes && (
                              <span style={{
                                fontFamily:"var(--font-mono)", fontSize:11, fontWeight:700,
                                color:"#b45309",
                                background:"rgba(255,200,0,0.15)",
                                border:"1px solid rgba(255,200,0,0.4)",
                                padding:"1px 7px", borderRadius:3,
                              }}>
                                R:{FMTN(row.reserved)}
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
                      <span style={{ fontSize:11, fontWeight:600, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.04em" }}>Total stock</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, color:"var(--accent)" }}>{FMTN(totalStock)}</span>
                    </div>
                  )}
                  {totalReserved > 0 && (
                    <div style={{ padding:"8px 14px", borderTop:"1px solid var(--border)", background:"rgba(255,200,0,0.08)", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:600, color:"#b45309", textTransform:"uppercase", letterSpacing:"0.04em" }}>En reserva</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color:"#b45309" }}>{FMTN(totalReserved)}</span>
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
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color: isSelected ? "var(--accent)" : "var(--text-muted)", width:56, flexShrink:0, overflow:"hidden", textOverflow:"ellipsis" }}>
                    {p.code || "—"}
                  </span>
                  <span style={{ fontSize:12, color: isSelected ? "var(--text)" : "var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight: isSelected ? 700 : 600 }}>
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
        ) : (
        /* ══ PESTAÑA ACTUALIZACIÓN MASIVA ═════════════════════════════════ */
        <div style={{ flex:1, overflowY:"auto", background:"var(--bg)", padding:"28px 32px", display:"flex", flexDirection:"column", gap:28 }}>

          {/* ── Exportar ── */}
          <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8, padding:"20px 24px" }}>
            <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:6 }}>Exportar catálogo</div>
            <div style={{ fontSize:12, color:"var(--text-dim)", marginBottom:14 }}>
              Descargá el catálogo completo en Excel con precios calculados, stock por depósito y todos los campos editables.
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleExport}>
              ⬇ Descargar Excel completo
            </button>
          </div>

          {/* ── Importar ── */}
          <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8, padding:"20px 24px" }}>
            <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:6 }}>Importar Excel</div>
            <div style={{ fontSize:12, color:"var(--text-dim)", marginBottom:16 }}>
              Subí el Excel exportado con cambios. El sistema mostrará solo las diferencias antes de aplicar.
            </div>
            <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={handleFileChange} />
              <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>
                {importFileName ? `📄 ${importFileName}` : "Seleccionar archivo..."}
              </button>
              <label style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, color:"var(--text-muted)", cursor:"pointer", userSelect:"none" }}>
                <input
                  type="checkbox"
                  checked={includeStock}
                  onChange={(e) => { setIncludeStock(e.target.checked); setDiffResult(null); setSelectedCodes(new Set()); }}
                  style={{ accentColor:"var(--accent)", width:14, height:14 }}
                />
                Incluir actualización de stock
              </label>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAnalyze}
                disabled={!importFile || diffLoading}
              >
                {diffLoading ? "Analizando..." : "Analizar diferencias"}
              </button>
            </div>
          </div>

          {/* ── Resultados del diff ── */}
          {diffResult && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

              {/* Resumen */}
              <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                {[
                  ["Modificados", diffResult.summary?.changed ?? 0, "var(--warning)"],
                  ["Nuevos",      diffResult.summary?.newProducts ?? 0, "var(--accent)"],
                  ["Sin cambios", diffResult.summary?.unchanged ?? 0, "var(--text-dim)"],
                  ["Total",       diffResult.summary?.total ?? 0, "var(--text)"],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:7, padding:"10px 18px", display:"flex", flexDirection:"column", gap:2, minWidth:100 }}>
                    <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-sans)" }}>{label}</span>
                    <span style={{ fontSize:20, fontWeight:700, color, fontFamily:"var(--font-mono)" }}>{val}</span>
                  </div>
                ))}
              </div>

              {actionableDiff.length === 0 ? (
                <div style={{ padding:"32px", textAlign:"center", color:"var(--text-dim)", fontSize:13, background:"var(--bg2)", borderRadius:8, border:"1px solid var(--border)" }}>
                  No hay diferencias — el catálogo está actualizado.
                </div>
              ) : (
                <>
                  {/* Controles de selección + aplicar */}
                  <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                    <label style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"var(--text-muted)", cursor:"pointer" }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelectedCodes(allSelected ? new Set() : new Set(actionableDiff.map((d) => d.code)))}
                        style={{ accentColor:"var(--accent)", width:14, height:14 }}
                      />
                      Seleccionar todos
                    </label>
                    <span style={{ fontSize:12, color:"var(--text-dim)" }}>
                      {selectedCodes.size} de {actionableDiff.length} seleccionados
                    </span>
                    <div style={{ marginLeft:"auto" }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleApply}
                        disabled={selectedCodes.size === 0 || applying}
                      >
                        {applying ? "Aplicando..." : `Aplicar ${selectedCodes.size} cambio${selectedCodes.size !== 1 ? "s" : ""}`}
                      </button>
                    </div>
                  </div>

                  {/* Tabla de diferencias */}
                  <div style={{ border:"1px solid var(--border)", borderRadius:8, overflow:"hidden" }}>
                    {/* Header */}
                    <div style={{ display:"grid", gridTemplateColumns:"32px 70px 1fr 1fr auto", gap:0, padding:"8px 14px", background:"var(--bg3)", borderBottom:"1px solid var(--border)", fontSize:11, fontWeight:600, color:"var(--text-muted)", fontFamily:"var(--font-sans)", textTransform:"uppercase", letterSpacing:"0.04em" }}>
                      <span></span>
                      <span>Código</span>
                      <span>Nombre</span>
                      <span>Cambios</span>
                      <span></span>
                    </div>

                    {actionableDiff.map((row) => {
                      const isChecked  = selectedCodes.has(row.code);
                      const isExpanded = expandedRows.has(row.code);
                      const changes    = row.changes || [];
                      const isNew      = row.status === "new";

                      return (
                        <div key={row.code} style={{ borderBottom:"1px solid var(--border)" }}>
                          {/* Row principal */}
                          <div style={{ display:"grid", gridTemplateColumns:"32px 70px 1fr 1fr auto", gap:0, padding:"10px 14px", alignItems:"center", background: isChecked ? "var(--accent-light)" : "var(--bg2)", cursor:"pointer" }}
                            onClick={() => toggleCode(row.code)}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCode(row.code)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ accentColor:"var(--accent)", width:14, height:14 }}
                            />
                            <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)", fontWeight:600 }}>
                              {row.code}
                            </span>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ fontSize:12, color:"var(--text)", fontWeight: isNew ? 600 : 400 }}>
                                {row.incoming?.name || row.current?.name || "—"}
                              </span>
                              {isNew && (
                                <span style={{ fontSize:10, padding:"1px 7px", borderRadius:3, background:"var(--accent)", color:"#fff", fontWeight:600 }}>NUEVO</span>
                              )}
                            </div>
                            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                              {changes.slice(0, 6).map((ch) => (
                                <span key={ch.field} style={{ fontSize:10, padding:"2px 7px", borderRadius:3, background:"rgba(234,179,8,0.15)", border:"1px solid rgba(234,179,8,0.4)", color:"#92400e", fontWeight:500 }}>
                                  {FIELD_LABELS[ch.field] || ch.field}
                                </span>
                              ))}
                              {changes.length > 6 && (
                                <span style={{ fontSize:10, color:"var(--text-dim)" }}>+{changes.length - 6}</span>
                              )}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleRowExpand(row.code); }}
                              style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-dim)", fontSize:11, padding:"2px 8px", borderRadius:4 }}
                            >
                              {isExpanded ? "▲" : "▼"}
                            </button>
                          </div>

                          {/* Detalle expandido */}
                          {isExpanded && (
                            <div style={{ padding:"12px 14px 14px 56px", background:"var(--bg3)", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:6 }}>
                              {isNew ? (
                                <div style={{ fontSize:12, color:"var(--text-dim)" }}>
                                  Producto nuevo — se creará con los datos del Excel.
                                </div>
                              ) : changes.length === 0 ? (
                                <div style={{ fontSize:12, color:"var(--text-dim)" }}>Sin detalle disponible.</div>
                              ) : (
                                <div style={{ display:"grid", gridTemplateColumns:"140px 1fr 1fr", gap:0 }}>
                                  <span style={{ fontSize:10, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.04em", padding:"4px 0" }}>Campo</span>
                                  <span style={{ fontSize:10, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.04em", padding:"4px 0" }}>Actual</span>
                                  <span style={{ fontSize:10, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.04em", padding:"4px 0" }}>Nuevo</span>
                                  {changes.map((ch) => (
                                    <React.Fragment key={ch.field}>
                                      <span style={{ fontSize:12, color:"var(--text-muted)", padding:"3px 0", borderTop:"1px solid var(--border)" }}>
                                        {FIELD_LABELS[ch.field] || ch.field}
                                      </span>
                                      <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--danger)", padding:"3px 8px 3px 0", borderTop:"1px solid var(--border)", textDecoration:"line-through", opacity:0.7 }}>
                                        {ch.from != null ? String(ch.from) : "—"}
                                      </span>
                                      <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--success)", padding:"3px 0", borderTop:"1px solid var(--border)", fontWeight:600 }}>
                                        {ch.to != null ? String(ch.to) : "—"}
                                      </span>
                                    </React.Fragment>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Botón aplicar al final también */}
                  {selectedCodes.size > 0 && (
                    <div style={{ display:"flex", justifyContent:"flex-end" }}>
                      <button
                        className="btn btn-primary"
                        onClick={handleApply}
                        disabled={applying}
                      >
                        {applying ? "Aplicando..." : `Aplicar ${selectedCodes.size} cambio${selectedCodes.size !== 1 ? "s" : ""}`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        )}{/* end tab conditional */}

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
          <div className="input-group">
            <label className="input-label">Nombre / Detalle *</label>
            <input ref={nameRef} className="input" value={form.name} onChange={f("name")} placeholder="Descripción del producto"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); codeRef.current?.focus(); } }} />
          </div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Código</label>
              <input ref={codeRef} className="input" value={form.code} onChange={f("code")} placeholder="AV5847"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); barcodeRef.current?.focus(); } }} />
            </div>
            <div className="input-group">
              <label className="input-label">Barcode</label>
              <input ref={barcodeRef} className="input" value={form.barcode} onChange={f("barcode")} placeholder="7790001111111"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); boxCodeRef.current?.focus(); } }} />
            </div>
          </div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Box Code</label>
              <input ref={boxCodeRef} className="input" value={form.box_code} onChange={f("box_code")} placeholder="890"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); qxbRef.current?.focus(); } }} />
            </div>
            <div className="input-group">
              <label className="input-label">QxB</label>
              <input ref={qxbRef} className="input" type="number" value={form.qxb} onChange={f("qxb")} placeholder="36"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); costoRef.current?.focus(); } }} />
            </div>
          </div>
          <hr className="divider" />
          <div style={{ fontFamily:"var(--font-sans)", fontSize:11, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:8 }}>
            Imágenes del producto
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:4 }}>
            {["Foto principal", "Foto 2", "Foto 3"].map((label, i) => (
              <ImageUploadSlot
                key={i} label={label}
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
          <div style={{ fontFamily:"var(--font-sans)", fontSize:11, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:8 }}>Precios</div>
          <div className="input-group">
            <label className="input-label">Costo en USD</label>
            <input ref={costoRef} className="input" type="number" value={form.costo_usd} onChange={f("costo_usd")} placeholder="0.00"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ivaRef.current?.focus(); } }} />
          </div>
          <div className="input-group">
            <label className="input-label">Tasa IVA (%)</label>
            <input ref={ivaRef} className="input" type="number" value={form.tasa_iva} onChange={f("tasa_iva")} placeholder="21"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); despachoRef.current?.focus(); } }} />
          </div>
          <hr className="divider" />
          <div style={{ fontFamily:"var(--font-sans)", fontSize:11, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:8 }}>Logística</div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Despacho</label>
              <input ref={despachoRef} className="input" value={form.despacho} onChange={f("despacho")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aduanaRef.current?.focus(); } }} />
            </div>
            <div className="input-group">
              <label className="input-label">Aduana</label>
              <input ref={aduanaRef} className="input" value={form.aduana} onChange={f("aduana")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); origenRef.current?.focus(); } }} />
            </div>
          </div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Origen</label>
              <input ref={origenRef} className="input" value={form.origen} onChange={f("origen")} placeholder="China, Brasil..."
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); videoRef.current?.focus(); } }} />
            </div>
            <div className="input-group">
              <label className="input-label">Categoría</label>
              <div ref={catRef} style={{ position:"relative" }}>
                <div style={{ display:"flex", gap:6 }}>
                  <input
                    className="input"
                    value={catInput}
                    placeholder="Buscar o crear categoría..."
                    onChange={(e) => { setCatInput(e.target.value); setCatDropdownOpen(true); }}
                    onFocus={openCategoryPicker}
                    style={{ flex:1 }}
                  />
                  {form.category_id && (
                    <button
                      title="Quitar categoría"
                      onClick={() => { setForm((p) => ({ ...p, category_id: "" })); setCatInput(""); }}
                      style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"0 10px", cursor:"pointer", color:"var(--text-muted)", fontSize:13, flexShrink:0 }}
                    >✕</button>
                  )}
                </div>
                {catDropdownOpen && (
                  <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:200, background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:7, boxShadow:"0 4px 16px rgba(0,0,0,0.18)", maxHeight:200, overflowY:"auto" }}>
                    {filteredCats.length === 0 && !showCreateOption && (
                      <div style={{ padding:"12px 14px", fontSize:12, color:"var(--text-dim)" }}>Sin resultados</div>
                    )}
                    {filteredCats.map((cat) => (
                      <div key={cat.id} onClick={() => selectCategory(cat)}
                        style={{ padding:"9px 14px", fontSize:13, cursor:"pointer", color: form.category_id === cat.id ? "var(--accent)" : "var(--text)", background: form.category_id === cat.id ? "var(--accent-light)" : "transparent", fontWeight: form.category_id === cat.id ? 600 : 400, borderBottom:"1px solid var(--border)" }}
                        onMouseEnter={(e) => { if (form.category_id !== cat.id) e.currentTarget.style.background = "var(--bg3)"; }}
                        onMouseLeave={(e) => { if (form.category_id !== cat.id) e.currentTarget.style.background = "transparent"; }}
                      >
                        {cat.name}
                      </div>
                    ))}
                    {showCreateOption && (
                      <div onClick={handleCreateCategory}
                        style={{ padding:"9px 14px", fontSize:13, cursor: creatingCat ? "default" : "pointer", color:"var(--accent)", display:"flex", alignItems:"center", gap:8, opacity: creatingCat ? 0.6 : 1 }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-light)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <span style={{ fontSize:16, lineHeight:1 }}>+</span>
                        {creatingCat ? "Creando..." : `Crear "${catInput.trim()}"`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">URL Video</label>
            <input ref={videoRef} className="input" value={form.video_url} onChange={f("video_url")} placeholder="https://youtube.com/..." />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:4 }}>
            <input type="checkbox" id="active" checked={form.active} onChange={f("active")} style={{ accentColor:"var(--accent)", width:15, height:15 }} />
            <label htmlFor="active" style={{ fontSize:13, color:"var(--text-muted)", cursor:"pointer" }}>Producto activo</label>
          </div>
        </Modal>
      )}

      {/* ── Modal de porcentajes por producto ── */}
      {overrideModal && selected && (
        <div className="modal-overlay" onClick={() => setOverrideModal(false)}>
          <div className="modal" style={{ maxWidth:380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Porcentajes de precio</span>
              <button className="modal-close" onClick={() => setOverrideModal(false)}>✕</button>
            </div>
            <div style={{ fontSize:12, color:"var(--text-dim)", marginBottom:16 }}>
              Configuración personalizada para <strong>{selected.name}</strong>.<br/>
              Dejá vacío en algún precio para usar el porcentaje global del sistema.
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {[1,2,3,4,5].map((n) => (
                <div key={n}>
                  <div className="input-label">Precio #{n} %</div>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    placeholder={`Global: ${selected[`global_pct_${n}`] ?? "?"}%`}
                    value={overrideForm[`pct_${n}`]}
                    onChange={(e) => setOverrideForm((f) => ({ ...f, [`pct_${n}`]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, marginTop:20, flexWrap:"wrap" }}>
              <button className="btn btn-primary" onClick={handleSaveOverride} disabled={savingOverride}>
                {savingOverride ? "Guardando..." : "Guardar"}
              </button>
              {selected.has_price_override && (
                <button className="btn btn-ghost" style={{ color:"var(--danger)" }} onClick={handleDeleteOverride} disabled={savingOverride}>
                  Restablecer global
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setOverrideModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
