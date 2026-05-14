import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { searchProducts, getStockMovimientos } from "../utils/api";
import { useAuth } from "../utils/useAuth";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "—";

const fmtQty   = (n) => (n != null ? Number(n).toLocaleString("es-AR") : "");
const fmtPrice = (n) => (n != null ? `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—");

export default function StockMovimientos() {
  const { user } = useAuth();

  // ── Búsqueda de producto ──────────────────────────────────────
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const [product, setProduct]       = useState(null);
  const [highlightIdx, setHighlight] = useState(-1);
  const searchTimer                  = useRef(null);
  const inputRef                     = useRef(null);
  const [dropPos, setDropPos]        = useState(null);

  // ── Filtros ───────────────────────────────────────────────────
  const [mode, setMode]             = useState("completo");
  const [inclManual, setInclManual] = useState(true);

  // ── Resultados ────────────────────────────────────────────────
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // ── Dropdown position (fixed, escapes scroll container) ──────
  useEffect(() => {
    if (results.length > 0 && inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 2, left: r.left, width: r.width });
    }
    setHighlight(-1);
  }, [results]);

  // ── Close dropdown on outside click ──────────────────────────
  useEffect(() => {
    if (!results.length) return;
    const handler = () => setResults([]);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [results.length]);

  // ── Búsqueda debounced ────────────────────────────────────────
  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data: res } = await searchProducts(query);
        setResults(Array.isArray(res) ? res.slice(0, 10) : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  const selectProduct = useCallback((p) => {
    setProduct(p);
    setQuery(`[${p.code}] ${p.name}`);
    setResults([]);
    setHighlight(-1);
  }, []);

  const handleKeyDown = (e) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < results.length) {
        selectProduct(results[highlightIdx]);
      }
    } else if (e.key === "Escape") {
      setResults([]);
    }
  };

  const loadMovements = useCallback(async (prod, currentMode, currentInclManual) => {
    if (!prod) return;
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await getStockMovimientos({
        product_id:     prod.id,
        mode:           currentMode,
        include_manual: currentInclManual ? "true" : "false",
      });
      setData(res);
    } catch (e) {
      setError(e.response?.data?.message || "Error al cargar movimientos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (product) loadMovements(product, mode, inclManual);
  }, [product, mode, inclManual, loadMovements]);

  const totalStock    = data?.stock?.reduce((acc, s) => acc + Number(s.stock), 0) ?? 0;
  const totalEntradas = data?.movements?.reduce((acc, m) => acc + (m.entradas ? Number(m.entradas) : 0), 0) ?? 0;
  const totalSalidas  = data?.movements?.reduce((acc, m) => acc + (m.salidas  ? Number(m.salidas)  : 0), 0) ?? 0;

  // When manual adjustments are excluded, derive the "net" from visible movements.
  // When included, show the real DB stock (which includes all adjustments).
  const displayedStock = inclManual ? totalStock : (totalEntradas - totalSalidas);

  return (
    <div style={{ maxWidth: 1100 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
        Movimientos de Stock
      </h2>

      {/* ── Filtros ──────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 20 }}>

        {/* Búsqueda */}
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 380 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) { setProduct(null); setData(null); }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar producto por nombre o código…"
            autoComplete="off"
            style={{
              width: "100%", padding: "8px 12px", boxSizing: "border-box",
              border: "1px solid var(--border)", borderRadius: "var(--radius)",
              background: "var(--bg2)", color: "var(--text)", fontSize: 13,
              outline: "none",
            }}
          />
          {searching && (
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-dim)" }}>
              buscando…
            </span>
          )}
        </div>

        {/* Dropdown via portal — escapes any overflow:hidden parent */}
        {results.length > 0 && dropPos && createPortal(
          <ul
            onMouseDown={(e) => e.preventDefault()}
            style={{
              position: "fixed",
              top: dropPos.top, left: dropPos.left, width: dropPos.width,
              zIndex: 9999,
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "0 4px 16px rgba(0,0,0,.14)",
              listStyle: "none", margin: 0, padding: "4px 0",
              maxHeight: 280, overflowY: "auto",
            }}
          >
            {results.map((p, idx) => (
              <li
                key={p.id}
                onMouseDown={() => selectProduct(p)}
                onMouseEnter={() => setHighlight(idx)}
                style={{
                  padding: "8px 12px", cursor: "pointer", fontSize: 13,
                  borderBottom: "1px solid var(--border)",
                  display: "flex", gap: 8, alignItems: "baseline",
                  background: idx === highlightIdx ? "var(--accent-dim)" : "transparent",
                  color: idx === highlightIdx ? "var(--accent)" : "var(--text)",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", flexShrink: 0 }}>{p.code}</span>
                <span style={{ fontWeight: 500 }}>{p.name}</span>
              </li>
            ))}
          </ul>,
          document.body
        )}

        {/* Modo */}
        <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {[
            { value: "completo", label: "Informe completo" },
            { value: "deposito", label: "Por depósito" },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              style={{
                padding: "7px 14px", fontSize: 13, border: "none", cursor: "pointer",
                background: mode === value ? "var(--accent)" : "var(--bg2)",
                color: mode === value ? "#fff" : "var(--text-dim)",
                fontWeight: mode === value ? 600 : 400,
                transition: "background .12s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Incluir manuales */}
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-dim)", cursor: "pointer", userSelect: "none", paddingTop: 7 }}>
          <input type="checkbox" checked={inclManual} onChange={(e) => setInclManual(e.target.checked)} />
          Incluir ajustes manuales / Excel
        </label>

        {product && (
          <button
            onClick={() => loadMovements(product, mode, inclManual)}
            disabled={loading}
            className="btn-ghost"
            style={{ padding: "7px 14px", fontSize: 13 }}
          >
            {loading ? "Cargando…" : "↺ Actualizar"}
          </button>
        )}
      </div>

      {/* ── Resumen de stock ─────────────────────────────────── */}
      {data && !loading && (
        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "14px 18px", marginBottom: 18,
          display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Producto</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{data.product?.name}</div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginTop: 2 }}>{data.product?.code}</div>
          </div>

          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />

          <div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
              {inclManual ? "Stock actual total" : "Neto según comprobantes"}
            </div>
            <div style={{ fontWeight: 700, fontSize: 24, color: displayedStock > 0 ? "var(--success)" : "var(--danger)" }}>
              {fmtQty(displayedStock)}
            </div>
          </div>

          {data.stock?.length > 0 && inclManual && (
            <>
              <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
              <div>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Por depósito</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {data.stock.map((s) => (
                    <div key={s.deposito} style={{
                      padding: "3px 10px", borderRadius: "var(--radius)", fontSize: 13,
                      background: Number(s.stock) > 0 ? "var(--success-dim)" : "var(--danger-dim)",
                      color:      Number(s.stock) > 0 ? "var(--success)"     : "var(--danger)",
                      border: `1px solid ${Number(s.stock) > 0 ? "#b2dfcc" : "#f5c6c3"}`,
                    }}>
                      <span style={{ fontWeight: 600 }}>{s.deposito}</span>
                      <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)" }}>{fmtQty(s.stock)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", background: "var(--danger-dim)", color: "var(--danger)", borderRadius: "var(--radius)", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)", fontSize: 14 }}>
          Cargando movimientos…
        </div>
      )}

      {!loading && !product && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-dim)", fontSize: 14 }}>
          Buscá y seleccioná un producto para ver sus movimientos de stock.
        </div>
      )}

      {/* ── Tabla ────────────────────────────────────────────── */}
      {!loading && data?.movements && (
        <>
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg3)", borderBottom: "2px solid var(--border)" }}>
                  {[
                    { label: "Fecha",                          align: "left"  },
                    { label: "Concepto",                       align: "left"  },
                    { label: "Cliente / Proveedor · Depósito", align: "left"  },
                    { label: "Precio",                         align: "right" },
                    { label: "Entradas",                       align: "right" },
                    { label: "Salidas",                        align: "right" },
                  ].map(({ label, align }) => (
                    <th key={label} style={{
                      padding: "9px 12px", textAlign: align,
                      fontWeight: 600, fontSize: 11, whiteSpace: "nowrap",
                      color: "var(--text-dim)", letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      borderRight: "1px solid var(--border)",
                    }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-dim)" }}>
                      Sin movimientos registrados para este producto.
                      {!inclManual && " (Los ajustes manuales están desactivados)"}
                    </td>
                  </tr>
                ) : (
                  data.movements.map((m, i) => {
                    const esEntrada = m.entradas != null;
                    const esSalida  = m.salidas  != null;
                    const rowBg     = i % 2 === 0 ? "var(--bg2)" : "var(--bg)";
                    return (
                      <tr key={i} style={{ background: rowBg, borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "7px 12px", whiteSpace: "nowrap", verticalAlign: "top", color: "var(--text-dim)", fontSize: 11, borderRight: "1px solid var(--border)" }}>
                          {fmtDate(m.fecha)}
                          {m.es_manual && (
                            <span style={{ display: "block", fontSize: 10, color: "var(--accent)", marginTop: 1 }}>manual/excel</span>
                          )}
                        </td>
                        <td style={{ padding: "7px 12px", fontWeight: 600, whiteSpace: "nowrap", borderRight: "1px solid var(--border)", color: "var(--text)" }}>
                          {m.concepto}
                        </td>
                        <td style={{ padding: "7px 12px", borderRight: "1px solid var(--border)", maxWidth: 260 }}>
                          <div style={{ fontSize: 13, color: "var(--text)" }}>{m.entidad || "—"}</div>
                          {m.deposito && (
                            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginTop: 1 }}>{m.deposito}</div>
                          )}
                        </td>
                        <td style={{ padding: "7px 12px", textAlign: "right", whiteSpace: "nowrap", borderRight: "1px solid var(--border)", color: "var(--text-dim)" }}>
                          {fmtPrice(m.precio)}
                        </td>
                        <td style={{
                          padding: "7px 12px", textAlign: "right", fontWeight: esEntrada ? 700 : 400,
                          color: esEntrada ? "var(--success)" : "var(--text-dim)",
                          borderRight: "1px solid var(--border)",
                          fontSize: esEntrada ? 14 : 13,
                        }}>
                          {esEntrada ? fmtQty(m.entradas) : ""}
                        </td>
                        <td style={{
                          padding: "7px 12px", textAlign: "right", fontWeight: esSalida ? 700 : 400,
                          color: esSalida ? "var(--danger)" : "var(--text-dim)",
                          fontSize: esSalida ? 14 : 13,
                        }}>
                          {esSalida ? fmtQty(m.salidas) : ""}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {data.movements.length > 0 && (
                <tfoot>
                  <tr style={{ background: "var(--bg3)", borderTop: "2px solid var(--border)", fontWeight: 700, color: "var(--text)" }}>
                    <td colSpan={4} style={{ padding: "8px 12px", borderRight: "1px solid var(--border)", fontSize: 12, color: "var(--text-dim)" }}>
                      Total · {data.movements.length} movimiento{data.movements.length !== 1 ? "s" : ""}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 14, borderRight: "1px solid var(--border)", color: "var(--success)" }}>
                      {totalEntradas > 0 ? fmtQty(totalEntradas) : ""}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 14, color: "var(--danger)" }}>
                      {totalSalidas > 0 ? fmtQty(totalSalidas) : ""}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            {mode === "deposito"
              ? `Solo movimientos del depósito "${user?.warehouse_name || "tu depósito"}"`
              : "Todos los depósitos"}
            {!inclManual && " · Ajustes manuales/Excel excluidos"}
          </div>
        </>
      )}
    </div>
  );
}
