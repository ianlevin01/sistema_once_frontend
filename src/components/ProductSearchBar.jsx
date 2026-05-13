import { useState, useEffect, useRef, useCallback, memo, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { searchProducts, getProduct } from "../utils/api";

const extractPrice = (product, priceType, divisa = "ARS") => {
  const prices = product?.prices || product?.product_prices || [];
  const found  = prices.find((p) => p.price_type === priceType);
  if (!found) return 0;
  const raw = divisa === "USD" ? (found.price_usd ?? found.price) : found.price;
  return Math.ceil(Number(raw) * 100) / 100;
};

const DROPDOWN_W = 780;
const PREVIEW_W  = 310;
const LIST_MAX_H = 340;

function calcDropdownPos(anchorEl, preferUp = false) {
  if (!anchorEl) return { top: 0, left: 0, openUp: false };
  const rect   = anchorEl.getBoundingClientRect();
  const vpW    = window.innerWidth;
  const vpH    = window.innerHeight;
  const GAP    = 6;
  let left = rect.left;
  if (left + DROPDOWN_W > vpW - 8) left = vpW - DROPDOWN_W - 8;
  if (left < 8) left = 8;
  const spaceBelow = vpH - rect.bottom - GAP;
  const spaceAbove = rect.top - GAP;
  const dropH      = LIST_MAX_H + 16;
  let openUp = preferUp;
  if (!preferUp && spaceBelow < dropH && spaceAbove > spaceBelow) openUp = true;
  if (preferUp  && spaceAbove < 80)                                openUp = false;
  const top = openUp ? rect.top - GAP : rect.bottom + GAP;
  return { top, left, openUp };
}

// ── Panel de preview completamente aislado ─────────────────────
// Al ser un componente separado con memo, sus re-renders (cuando llega
// la imagen o el detalle) NO afectan el layout de la lista de resultados,
// eliminando el mouseLeave/mouseEnter espurio que causaba el flickering.
const PreviewPanel = memo(({ product, loading, priceType, divisa = "ARS" }) => {
  const photos  = product?.images?.map((i) => i.url).filter(Boolean) || [];
  const price   = product ? extractPrice(product, priceType, divisa) : 0;
  const prefix  = divisa === "USD" ? "USD " : "$";

  return (
    <div style={{
      width:          PREVIEW_W,
      flexShrink:     0,
      borderLeft:     "1px solid var(--border)",
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      padding:        "18px 14px",
      background:     "var(--bg3, var(--bg2))",
      gap:            10,
      overflowY:      "auto",
    }}>
      <div style={{
        width:          280,
        height:         280,
        borderRadius:   8,
        overflow:       "hidden",
        border:         "1px solid var(--border)",
        background:     "var(--bg2)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        flexShrink:     0,
      }}>
        {loading && !photos.length ? (
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
            Cargando…
          </span>
        ) : photos.length ? (
          <img
            src={photos[0]}
            alt="preview"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
          />
        ) : (
          <span style={{ fontSize: 44, opacity: 0.3 }}>📦</span>
        )}
      </div>

      {product ? (
        <div style={{ width: "100%", textAlign: "center" }}>
          {product.code && (
            <div style={{
              display:      "inline-block",
              fontFamily:   "var(--font-mono)",
              fontSize:     10,
              color:        "var(--accent)",
              background:   "var(--accent-dim)",
              border:       "1px solid var(--accent)",
              borderRadius: 4,
              padding:      "2px 8px",
              marginBottom: 8,
            }}>
              {product.code}
            </div>
          )}
          <div style={{
            fontSize:     12,
            fontWeight:   600,
            color:        "var(--text)",
            lineHeight:   1.4,
            marginBottom: price > 0 ? 8 : 0,
            wordBreak:    "break-word",
          }}>
            {product.name}
          </div>
          {price > 0 && (
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize:   18,
              fontWeight: 700,
              color:      "var(--accent)",
            }}>
              {prefix}{price.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </div>
      ) : !loading ? (
        <div style={{
          fontSize:   11,
          fontFamily: "var(--font-mono)",
          color:      "var(--text-dim)",
          textAlign:  "center",
        }}>
          Sin imagen
        </div>
      ) : null}
    </div>
  );
});

// ── Ítem de la lista también aislado con memo ──────────────────
// Cada ítem no se re-renderiza cuando cambia el preview,
// solo cuando cambia su propio estado de highlight.
const ResultItem = memo(({ product, highlight, onMouseEnter, onMouseLeave, onMouseDown }) => (
  <div
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onMouseDown={onMouseDown}
    style={{
      padding:      "10px 16px",
      cursor:       "pointer",
      display:      "flex",
      alignItems:   "center",
      gap:          12,
      background:   highlight ? "var(--accent-dim)" : "transparent",
      borderLeft:   `3px solid ${highlight ? "var(--accent)" : "transparent"}`,
      borderBottom: "1px solid var(--border)",
      transition:   "background 0.07s",
    }}
  >
    <span style={{
      fontFamily:   "var(--font-mono)",
      fontSize:     11,
      color:        highlight ? "var(--accent)" : "var(--text-muted, #888)",
      width:        80,
      flexShrink:   0,
      overflow:     "hidden",
      textOverflow: "ellipsis",
      whiteSpace:   "nowrap",
    }}>
      {product.code || "—"}
    </span>
    <span style={{
      fontSize:     13,
      color:        highlight ? "var(--text)" : "var(--text-muted, var(--text))",
      flex:         1,
      overflow:     "hidden",
      textOverflow: "ellipsis",
      whiteSpace:   "nowrap",
      fontWeight:   highlight ? 500 : 400,
    }}>
      {product.name}
    </span>
    {highlight && (
      <span style={{ fontSize: 11, color: "var(--accent)", flexShrink: 0, opacity: 0.7 }}>
        ↵
      </span>
    )}
  </div>
));

const ProductSearchBar = forwardRef(function ProductSearchBar({
  priceType     = "precio_1",
  divisa        = "ARS",
  onSelect,
  onSearchFocus,
  disabled,
  autoFocus,
  dropUp: preferUp = false,
}, ref) {
  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState([]);
  const [activeIdx,     setActiveIdx]     = useState(0);
  const [hovered,       setHovered]       = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailCache,   setDetailCache]   = useState({});
  const [open,          setOpen]          = useState(false);
  const [dropPos,       setDropPos]       = useState({ top: 0, left: 0, openUp: false });

  const inputRef      = useRef(null);
  const wrapperRef    = useRef(null);
  const listRef       = useRef(null);
  const hoverTimerRef = useRef(null);
  const searchIdRef   = useRef(0);

  // Permite que el padre llame prodSearchRef.current.focus()
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const previewIdx     = hovered !== null ? hovered : activeIdx;
  const previewProduct = results[previewIdx] ? detailCache[results[previewIdx].id] : null;

  const updateDropPos = useCallback(() => {
    setDropPos(calcDropdownPos(wrapperRef.current, preferUp));
  }, [preferUp]);

  // ── Búsqueda con debounce ──────────────────────────────────────
  useEffect(() => {
    const id = ++searchIdRef.current;
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await searchProducts(query);
        if (id !== searchIdRef.current) return; // respuesta obsoleta, ignorar
        setResults(data);
        setActiveIdx(0);
        setHovered(null);
        if (data.length > 0) { updateDropPos(); setOpen(true); }
        else setOpen(false);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query, updateDropPos]);

  // ── Reposicionar al scroll/resize ─────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handle = () => updateDropPos();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [open, updateDropPos]);

  // ── Precargar detalle del producto activo ─────────────────────
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

  // ── Scroll al ítem activo ──────────────────────────────────────
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[activeIdx];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // ── Cerrar al click fuera ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (
        wrapperRef.current && !wrapperRef.current.contains(e.target) &&
        !document.getElementById("psb-portal")?.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // ── Limpiar hover timer al desmontar ──────────────────────────
  useEffect(() => {
    return () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); };
  }, []);

  // ── Teclado ────────────────────────────────────────────────────
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

  // ── Confirmar selección ────────────────────────────────────────
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
    onSelect?.({ product: detail, price: extractPrice(detail, priceType, divisa) });
  }, [detailCache, priceType, onSelect]);

  // ── Handlers de hover con debounce ────────────────────────────
  const handleMouseEnter = useCallback((i) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHovered(i), 60);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHovered(null), 60);
  }, []);

  // ── Dropdown via portal ────────────────────────────────────────
  const dropdownEl = open && results.length > 0 && createPortal(
    <div
      id="psb-portal"
      style={{
        position:     "fixed",
        top:          dropPos.openUp ? undefined : dropPos.top,
        bottom:       dropPos.openUp ? `calc(100vh - ${dropPos.top}px)` : undefined,
        left:         dropPos.left,
        width:        DROPDOWN_W,
        zIndex:       99999,
        background:   "var(--bg2)",
        border:       "1px solid var(--border)",
        borderRadius: 10,
        boxShadow:    "0 16px 56px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.2)",
        display:      "flex",
        overflow:     "hidden",
        maxHeight:    LIST_MAX_H + 16,
        animation:    dropPos.openUp ? "psbSlideUp 0.14s ease" : "psbSlideDown 0.14s ease",
      }}
    >
      {/* Lista con altura fija para que el preview no la desplace */}
      <div
        ref={listRef}
        style={{
          flex:           1,
          overflowY:      "auto",
          minWidth:       0,
          scrollbarWidth: "thin",
          scrollbarColor: "var(--border) transparent",
        }}
      >
        {results.map((p, i) => (
          <ResultItem
            key={p.id}
            product={p}
            highlight={hovered !== null ? i === hovered : i === activeIdx}
            onMouseEnter={() => handleMouseEnter(i)}
            onMouseLeave={handleMouseLeave}
            onMouseDown={(e) => { e.preventDefault(); confirmSelection(p); }}
          />
        ))}
      </div>

      {/* Preview aislado: sus re-renders no tocan la lista */}
      <PreviewPanel
        product={previewProduct}
        loading={loadingDetail}
        priceType={priceType}
        divisa={divisa}
      />

      <style>{`
        @keyframes psbSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes psbSlideUp {
          from { opacity: 0; transform: translateY(6px);  }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>,
    document.body
  );

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>

      <div className="search-bar" style={{ height: 44 }}>
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          placeholder="Buscar producto por código o nombre..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length) { updateDropPos(); setOpen(true); }
            onSearchFocus?.();
          }}
          onBlur={() => {}}
          style={{ fontSize: 14 }}
          autoFocus={autoFocus}
          disabled={disabled}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
              inputRef.current?.focus();
            }}
            style={{
              background: "none",
              border:     "none",
              color:      "var(--text-dim)",
              cursor:     "pointer",
              fontSize:   14,
              padding:    "0 6px",
            }}
          >
            ✕
          </button>
        )}
      </div>
      {dropdownEl}
    </div>
  );
});

export default ProductSearchBar;
