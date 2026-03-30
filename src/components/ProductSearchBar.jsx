import { useState, useEffect, useRef, useCallback } from "react";
import { searchProducts, getProduct } from "../utils/api";

const extractPrice = (product, priceType) => {
  const prices = product?.prices || product?.product_prices || [];
  const found  = prices.find((p) => p.price_type === priceType);
  return found ? Number(found.price) : 0;
};

export default function ProductSearchBar({ priceType = "precio_1", onSelect, disabled, autoFocus }) {
  const [query,      setQuery]      = useState("");
  const [results,    setResults]    = useState([]);
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [hovered,    setHovered]    = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailCache,   setDetailCache]   = useState({});
  const [open,       setOpen]       = useState(false);
  const [dropPos,    setDropPos]    = useState({ top: 0, left: 0, width: 0 });

  const inputRef   = useRef(null);
  const wrapperRef = useRef(null);
  const listRef    = useRef(null);

  const previewIdx     = hovered !== null ? hovered : activeIdx;
  const previewProduct = results[previewIdx] ? detailCache[results[previewIdx].id] : null;
  const previewPhotos  = previewProduct?.images?.map((i) => i.url).filter(Boolean) || [];

  // Calcular posición del dropdown basada en la posición real del wrapper en pantalla
  const updateDropPos = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setDropPos({
      top:   rect.bottom + window.scrollY + 4,
      left:  rect.left   + window.scrollX,
      width: rect.width,
    });
  };

  // Búsqueda con debounce
  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await searchProducts(query);
        setResults(data);
        setActiveIdx(0);
        setOpen(data.length > 0);
        updateDropPos();
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Actualizar posición si cambia el tamaño de ventana o se hace scroll
  useEffect(() => {
    if (!open) return;
    const handle = () => updateDropPos();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [open]);

  // Pre-cargar detalles del producto activo para la preview
  useEffect(() => {
    const idx  = hovered !== null ? hovered : activeIdx;
    const prod = results[idx];
    if (!prod || detailCache[prod.id]) return;

    let cancelled = false;
    setLoadingDetail(true);
    getProduct(prod.id)
      .then(({ data }) => { if (!cancelled) setDetailCache((c) => ({ ...c, [prod.id]: data })); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingDetail(false); });

    return () => { cancelled = true; };
  }, [activeIdx, hovered, results]);

  // Scroll del item activo en la lista
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[activeIdx];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleKeyDown = (e) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      setHovered(null);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
      setHovered(null);
    } else if (e.key === "Enter") {
      e.preventDefault();
      confirmSelection(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const confirmSelection = useCallback(async (prod) => {
    if (!prod) return;
    setOpen(false);
    setQuery("");
    setResults([]);

    let detail = detailCache[prod.id];
    if (!detail) {
      try { const { data } = await getProduct(prod.id); detail = data; }
      catch { detail = prod; }
    }
    const price = extractPrice(detail, priceType);
    onSelect?.({ product: detail, price });
  }, [detailCache, priceType, onSelect]);

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div className="search-bar" style={{ height: 44 }}>
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          placeholder="Buscar producto por código o nombre..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (!e.target.value) setOpen(false); }}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length) { updateDropPos(); setOpen(true); } }}
          style={{ fontSize: 14 }}
          autoFocus={autoFocus}
          disabled={disabled}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); inputRef.current?.focus(); }}
            style={{ background:"none", border:"none", color:"var(--text-dim)", cursor:"pointer", fontSize:14, padding:"0 6px" }}
          >✕</button>
        )}
      </div>

      {/* Dropdown con position:fixed para escapar de overflow:hidden de modales */}
      {open && results.length > 0 && (
        <div style={{
          position: "fixed",
          top:   dropPos.top,
          left:  dropPos.left,
          width: dropPos.width,
          zIndex: 9999,
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
          display: "flex",
          maxHeight: 340,
          overflow: "hidden",
        }}>
          {/* Lista de resultados */}
          <div ref={listRef} style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
            {results.map((p, i) => {
              const isActive = i === activeIdx && hovered === null;
              const isHover  = i === hovered;
              const highlight = isActive || isHover;
              return (
                <div
                  key={p.id}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onMouseDown={(e) => { e.preventDefault(); confirmSelection(p); }}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: highlight ? "var(--accent-dim)" : "transparent",
                    borderLeft: `3px solid ${isActive ? "var(--accent)" : "transparent"}`,
                    borderBottom: "1px solid var(--border)",
                    transition: "background 0.08s",
                  }}
                >
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color: highlight ? "var(--accent)" : "var(--text-dim)", width:64, flexShrink:0, overflow:"hidden", textOverflow:"ellipsis" }}>
                    {p.code || "—"}
                  </span>
                  <span style={{ fontSize:13, color: highlight ? "var(--text)" : "var(--text-muted)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight: highlight ? 500 : 400 }}>
                    {p.name}
                  </span>
                  {highlight && <span style={{ fontSize:10, color:"var(--accent)", flexShrink:0 }}>↵</span>}
                </div>
              );
            })}
          </div>

          {/* Preview de imagen */}
          <div style={{
            width: 180,
            flexShrink: 0,
            borderLeft: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "var(--bg3)",
            gap: 10,
          }}>
            {loadingDetail && !previewPhotos.length ? (
              <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)" }}>Cargando...</div>
            ) : previewPhotos.length ? (
              <>
                <div style={{ width:140, height:140, borderRadius:8, overflow:"hidden", border:"1px solid var(--border)", background:"var(--bg2)" }}>
                  <img
                    src={previewPhotos[0]}
                    alt="preview"
                    style={{ width:"100%", height:"100%", objectFit:"contain" }}
                    onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
                  />
                </div>
                {previewProduct && (
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", marginBottom:2 }}>{previewProduct.code || ""}</div>
                    <div style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.4 }}>{previewProduct.name}</div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, color:"var(--text-dim)" }}>
                <span style={{ fontSize:36 }}>📦</span>
                <span style={{ fontSize:11, fontFamily:"var(--font-mono)" }}>Sin imagen</span>
                {previewProduct && (
                  <div style={{ textAlign:"center", marginTop:4 }}>
                    <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)" }}>{previewProduct.code || ""}</div>
                    <div style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.4 }}>{previewProduct.name}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
