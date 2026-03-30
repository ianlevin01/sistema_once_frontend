import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { searchProducts, getProduct } from "../utils/api";

const extractPrice = (product, priceType) => {
  const prices = product?.prices || product?.product_prices || [];
  const found  = prices.find((p) => p.price_type === priceType);
  return found ? Number(found.price) : 0;
};

const DROPDOWN_W = 660;
const PREVIEW_W  = 220;
const LIST_MAX_H = 340;

/**
 * Calcula la posición del dropdown.
 * - Siempre intenta abrirse hacia abajo; si no hay espacio, abre hacia arriba.
 * - Evita salirse del viewport horizontalmente.
 * - Funciona dentro de modales (usa getBoundingClientRect que ya es relativo al viewport).
 */
function calcDropdownPos(anchorEl, preferUp = false) {
  if (!anchorEl) return { top: 0, left: 0, openUp: false };

  const rect   = anchorEl.getBoundingClientRect();
  const vpW    = window.innerWidth;
  const vpH    = window.innerHeight;
  const GAP    = 6;

  // Horizontal: alinear con el input, sin salirse
  let left = rect.left;
  if (left + DROPDOWN_W > vpW - 8) left = vpW - DROPDOWN_W - 8;
  if (left < 8) left = 8;

  // Vertical: ¿hay espacio abajo?
  const spaceBelow = vpH - rect.bottom - GAP;
  const spaceAbove = rect.top - GAP;
  const dropH      = LIST_MAX_H + 16; // altura aproximada

  let openUp = preferUp;
  if (!preferUp && spaceBelow < dropH && spaceAbove > spaceBelow) openUp = true;
  if (preferUp  && spaceAbove < 80)                                openUp = false;

  const top = openUp
    ? rect.top  - GAP   // el dropdown crece hacia arriba desde aquí (transform)
    : rect.bottom + GAP;

  return { top, left, openUp };
}

export default function ProductSearchBar({
  priceType  = "precio_1",
  onSelect,
  disabled,
  autoFocus,
  dropUp: preferUp = false,
}) {
  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState([]);
  const [activeIdx,     setActiveIdx]     = useState(0);
  const [hovered,       setHovered]       = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailCache,   setDetailCache]   = useState({});
  const [open,          setOpen]          = useState(false);
  const [dropPos,       setDropPos]       = useState({ top: 0, left: 0, openUp: false });

  const inputRef   = useRef(null);
  const wrapperRef = useRef(null);
  const listRef    = useRef(null);

  // ── Preview ────────────────────────────────────────────────────
  const previewIdx     = hovered !== null ? hovered : activeIdx;
  const previewProduct = results[previewIdx] ? detailCache[results[previewIdx].id] : null;
  const previewPhotos  = previewProduct?.images?.map((i) => i.url).filter(Boolean) || [];
  const previewPrice   = previewProduct ? extractPrice(previewProduct, priceType) : 0;

  // ── Recalcular posición ────────────────────────────────────────
  const updateDropPos = useCallback(() => {
    const pos = calcDropdownPos(wrapperRef.current, preferUp);
    setDropPos(pos);
  }, [preferUp]);

  // ── Búsqueda con debounce ──────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await searchProducts(query);
        setResults(data);
        setActiveIdx(0);
        setHovered(null);
        if (data.length > 0) {
          updateDropPos();
          setOpen(true);
        } else {
          setOpen(false);
        }
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query, updateDropPos]);

  // ── Reposicionar al scroll/resize ─────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handle = () => updateDropPos();
    window.addEventListener("resize",  handle);
    window.addEventListener("scroll",  handle, true);
    return () => {
      window.removeEventListener("resize",  handle);
      window.removeEventListener("scroll",  handle, true);
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
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

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
    const price = extractPrice(detail, priceType);
    onSelect?.({ product: detail, price });
  }, [detailCache, priceType, onSelect]);

  // ── Dropdown content (renderizado via portal) ──────────────────
  const dropdownEl = open && results.length > 0 && createPortal(
    <div
      id="psb-portal"
      style={{
        position:      "fixed",
        top:           dropPos.openUp ? undefined : dropPos.top,
        bottom:        dropPos.openUp ? `calc(100vh - ${dropPos.top}px)` : undefined,
        left:          dropPos.left,
        width:         DROPDOWN_W,
        zIndex:        99999,
        background:    "var(--bg2)",
        border:        "1px solid var(--border)",
        borderRadius:  10,
        boxShadow:     "0 16px 56px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.2)",
        display:       "flex",
        overflow:      "hidden",
        maxHeight:     LIST_MAX_H + 16,
        // Animación sutil de entrada
        animation:     dropPos.openUp ? "psbSlideUp 0.14s ease" : "psbSlideDown 0.14s ease",
      }}
    >
      {/* ── Lista de resultados ───────────────────────────────── */}
      <div
        ref={listRef}
        style={{
          flex:       1,
          overflowY:  "auto",
          minWidth:   0,
          scrollbarWidth: "thin",
          scrollbarColor: "var(--border) transparent",
        }}
      >
        {results.map((p, i) => {
          const isActive  = i === activeIdx && hovered === null;
          const isHover   = i === hovered;
          const highlight = isActive || isHover;
          return (
            <div
              key={p.id}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onMouseDown={(e) => { e.preventDefault(); confirmSelection(p); }}
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
              {/* Código */}
              <span style={{
                fontFamily:   "var(--font-mono)",
                fontSize:     11,
                color:        highlight ? "var(--accent)" : "var(--text-dim)",
                width:        80,
                flexShrink:   0,
                overflow:     "hidden",
                textOverflow: "ellipsis",
                whiteSpace:   "nowrap",
              }}>
                {p.code || "—"}
              </span>

              {/* Nombre */}
              <span style={{
                fontSize:     13,
                color:        highlight ? "var(--text)" : "var(--text-muted, var(--text))",
                flex:         1,
                overflow:     "hidden",
                textOverflow: "ellipsis",
                whiteSpace:   "nowrap",
                fontWeight:   highlight ? 500 : 400,
              }}>
                {p.name}
              </span>

              {/* Enter hint */}
              {highlight && (
                <span style={{ fontSize: 11, color: "var(--accent)", flexShrink: 0, opacity: 0.7 }}>
                  ↵
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Panel de preview ──────────────────────────────────── */}
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
        {/* Imagen */}
        <div style={{
          width:          188,
          height:         188,
          borderRadius:   8,
          overflow:       "hidden",
          border:         "1px solid var(--border)",
          background:     "var(--bg2)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexShrink:     0,
        }}>
          {loadingDetail && !previewPhotos.length ? (
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
              Cargando…
            </span>
          ) : previewPhotos.length ? (
            <img
              src={previewPhotos[0]}
              alt="preview"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
            />
          ) : (
            <span style={{ fontSize: 44, opacity: 0.3 }}>📦</span>
          )}
        </div>

        {/* Info del producto */}
        {previewProduct ? (
          <div style={{ width: "100%", textAlign: "center" }}>
            {previewProduct.code && (
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
                {previewProduct.code}
              </div>
            )}
            <div style={{
              fontSize:     12,
              fontWeight:   600,
              color:        "var(--text)",
              lineHeight:   1.4,
              marginBottom: previewPrice > 0 ? 8 : 0,
              wordBreak:    "break-word",
            }}>
              {previewProduct.name}
            </div>
            {previewPrice > 0 && (
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize:   18,
                fontWeight: 700,
                color:      "var(--accent)",
              }}>
                ${previewPrice.toLocaleString("es-AR")}
              </div>
            )}
          </div>
        ) : !loadingDetail ? (
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

      {/* Keyframes inyectados inline */}
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

      {/* ── Input ───────────────────────────────────────────────── */}
      <div className="search-bar" style={{ height: 44 }}>
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          placeholder="Buscar producto por código o nombre..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) setOpen(false);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length) {
              updateDropPos();
              setOpen(true);
            }
          }}
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
}
