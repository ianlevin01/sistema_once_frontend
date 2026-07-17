import { useState, useEffect, useRef } from "react";
import { getCategories, getProductsForCatalog, searchProducts } from "../utils/api";
import { printCatalogoPDF, printPreciosPDF } from "../utils/printDoc";
import { useToast } from "../utils/useToast";

export default function CatalogosPersonalizados() {
  useEffect(() => { document.title = "Catálogos — Once"; }, []);
  const [categories,   setCategories]   = useState([]);
  const [selectedCat,  setSelectedCat]  = useState("");
  const [products,     setProducts]     = useState([]);
  const [config,       setConfig]       = useState({});   // { [id]: { included, displayName, description, priceValue } }
  const [loading,      setLoading]      = useState(false);
  const [autoSelect,   setAutoSelect]   = useState("");
  const [columns,      setColumns]      = useState(3);
  const [catalogTitle, setCatalogTitle] = useState("Catálogo de Productos");
  const [printType,    setPrintType]    = useState("catalogo");
  const [priceTier,    setPriceTier]    = useState("");
  const { addToast, ToastContainer } = useToast();

  // Buscador de producto individual
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchIdx,     setSearchIdx]     = useState(-1);
  const searchTimer = useRef(null);

  useEffect(() => {
    getCategories()
      .then((r) => setCategories(r.data || r))
      .catch(() => addToast("Error cargando categorías", "error"));
  }, []);

  // Búsqueda de producto con debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearchIdx(-1); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await searchProducts(searchQuery);
        setSearchResults(data || []);
        setSearchIdx(-1);
      } catch { /* silencioso */ }
    }, 280);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  // Agrega un producto al listado (o lo reactiva si ya estaba)
  const addProductToList = (p) => {
    if (!p) return;
    const alreadyIn = products.find((x) => x.id === p.id);
    if (alreadyIn) {
      setConfig((prev) => ({ ...prev, [p.id]: { ...prev[p.id], included: false } }));
    } else {
      setProducts((prev) => [...prev, p]);
      setConfig((prev) => {
        const precio1 = p.prices?.[0]?.price ?? null;
        return {
          ...prev,
          [p.id]: {
            included:    false,
            displayName: p.name,
            description: p.description || "",
            priceValue:  precio1 != null ? String(Math.round(precio1)) : "",
          },
        };
      });
    }
    setSearchQuery("");
    setSearchResults([]);
    setSearchIdx(-1);
  };

  const handleSearchKeyDown = (e) => {
    if (!searchResults.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchIdx((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      addProductToList(searchIdx >= 0 ? searchResults[searchIdx] : searchResults[0]);
    } else if (e.key === "Escape") {
      setSearchResults([]);
      setSearchIdx(-1);
    }
  };

  const loadProducts = async () => {
    if (!selectedCat || selectedCat === "") return;
    setLoading(true);
    try {
      const { data } = await getProductsForCatalog(selectedCat);
      const n = parseInt(autoSelect, 10);
      const autoSelectN = !isNaN(n) && n > 0 ? n : 0;
      setProducts(data);
      setConfig((prev) => {
        const next = { ...prev };
        data.forEach((p, idx) => {
          const precio1 = p.prices?.[0]?.price ?? null;
          next[p.id] = {
            included:    autoSelectN > 0 ? idx < autoSelectN : (prev[p.id]?.included ?? false),
            displayName: prev[p.id]?.displayName ?? p.name,
            description: prev[p.id]?.description ?? (p.description || ""),
            priceValue:  prev[p.id]?.priceValue  ?? (precio1 != null ? String(Math.round(precio1)) : ""),
          };
        });
        return next;
      });
    } catch {
      addToast("Error cargando productos", "error");
    }
    setLoading(false);
  };

  const updateConfig = (id, key, value) =>
    setConfig((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));

  const toggleAll = (included) =>
    setConfig((prev) => {
      const next = { ...prev };
      products.forEach((p) => { next[p.id] = { ...next[p.id], included }; });
      return next;
    });

  const handleGenerate = () => {
    const included = products
      .filter((p) => config[p.id]?.included)
      .map((p) => {
        const cfg = config[p.id] || {};
        const rawPrice = cfg.priceValue?.toString().trim();
        const price = rawPrice !== "" && rawPrice != null ? Number(rawPrice.replace(",", ".")) : null;
        return {
          displayName: cfg.displayName || p.name,
          description: cfg.description || "",
          price:       !isNaN(price) ? price : null,
          priceValue:  !isNaN(price) ? price : null,
          imageUrl:    p.images?.[0]?.url || null,
          code:        p.code || "",
          qxb:         p.qxb || "",
        };
      });

    if (!included.length) {
      addToast("Seleccioná al menos un producto", "error");
      return;
    }

    if (printType === "catalogo") {
      printCatalogoPDF(included, { columns, title: catalogTitle });
    } else if (printType === "precios") {
      printPreciosPDF(included, { title: catalogTitle });
    }
  };

  const includedCount = products.filter((p) => config[p.id]?.included).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ToastContainer />

      {/* Filtros */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>

        {/* Selector de categoría */}
        <div>
          <div className="input-label">Categoría</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className="input"
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              style={{ width: 220 }}
            >
              <option value="">— Seleccionar —</option>
              <option value="all">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min="0"
              value={autoSelect}
              onChange={(e) => setAutoSelect(e.target.value)}
              onWheel={(e) => e.target.blur()}
              placeholder="Cant."
              title="Cantidad a pre-seleccionar (los más nuevos)"
              style={{ width: 72 }}
            />
            <button
              className="btn btn-primary"
              onClick={loadProducts}
              disabled={!selectedCat || selectedCat === "" || loading}
            >
              {loading ? "Cargando..." : "Cargar"}
            </button>
          </div>
        </div>

        {/* Separador visual */}
        <div style={{ alignSelf: "flex-end", color: "var(--text-dim)", fontSize: 13, paddingBottom: 6 }}>ó</div>

        {/* Buscador de producto */}
        <div style={{ flex: 1, minWidth: 240, maxWidth: 400 }}>
          <div className="input-label">Buscar producto por nombre</div>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Escribí un nombre y presioná Enter..."
              style={{ width: "100%" }}
              autoComplete="off"
            />
            {searchResults.length > 0 && (
              <div style={{
                position: "absolute", zIndex: 50, top: "calc(100% + 2px)", left: 0, right: 0,
                background: "var(--bg2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,.15)",
                maxHeight: 240, overflowY: "auto",
              }}>
                {searchResults.map((p, i) => (
                  <div
                    key={p.id}
                    onMouseDown={() => addProductToList(p)}
                    style={{
                      padding: "8px 12px", cursor: "pointer", fontSize: 13,
                      background: i === searchIdx ? "var(--accent-dim)" : "transparent",
                      borderLeft: `3px solid ${i === searchIdx ? "var(--accent)" : "transparent"}`,
                      display: "flex", alignItems: "center", gap: 10,
                    }}
                    onMouseEnter={() => setSearchIdx(i)}
                    onMouseLeave={() => setSearchIdx(-1)}
                  >
                    {p.code && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", flexShrink: 0 }}>
                        {p.code}
                      </span>
                    )}
                    <span style={{ fontWeight: i === searchIdx ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                    {products.find((x) => x.id === p.id) && (
                      <span style={{ fontSize: 10, color: "var(--text-dim)", flexShrink: 0 }}>ya en lista</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Opciones del catálogo */}
      {products.length > 0 && (
        <div style={{
          display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end",
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "12px 16px",
        }}>
          <div>
            <div className="input-label">Precio para seleccionados</div>
            <select
              className="input"
              value={priceTier}
              onChange={(e) => {
                const tier = e.target.value;
                setPriceTier(tier);
                if (!tier) return;
                setConfig((prev) => {
                  const next = { ...prev };
                  products.forEach((p) => {
                    if (!next[p.id]?.included) return;
                    const priceObj = p.prices?.find((pr) => pr.price_type === tier);
                    if (priceObj?.price != null) {
                      next[p.id] = { ...next[p.id], priceValue: String(Math.round(priceObj.price)) };
                    }
                  });
                  return next;
                });
              }}
              style={{ width: 140 }}
            >
              <option value="">— Seleccionar —</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={`precio_${n}`}>Precio {n}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="input-label">Título del catálogo</div>
            <input
              className="input"
              value={catalogTitle}
              onChange={(e) => setCatalogTitle(e.target.value)}
              style={{ width: 260 }}
            />
          </div>
          {printType === "catalogo" && (
            <div>
              <div className="input-label">Columnas en PDF</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    className={"btn " + (columns === n ? "btn-primary" : "btn-ghost")}
                    onClick={() => setColumns(n)}
                    style={{ padding: "5px 14px" }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="input-label">Tipo de impresión</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className={"btn " + (printType === "catalogo" ? "btn-primary" : "btn-ghost")}
                onClick={() => setPrintType("catalogo")}
                style={{ padding: "5px 14px", fontSize: 12 }}
              >
                Catálogo completo
              </button>
              <button
                className={"btn " + (printType === "precios" ? "btn-primary" : "btn-ghost")}
                onClick={() => setPrintType("precios")}
                style={{ padding: "5px 14px", fontSize: 12 }}
              >
                Lista de precios
              </button>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              {includedCount} de {products.length} incluidos
            </span>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => toggleAll(true)}>
              Todos
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => toggleAll(false)}>
              Ninguno
            </button>
            <button className="btn btn-primary" onClick={handleGenerate}>
              {printType === "catalogo" ? "Generar catálogo" : "Generar lista de precios"}
            </button>
          </div>
        </div>
      )}

      {/* Tabla de productos */}
      {products.length > 0 && (
        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg3)", borderBottom: "1px solid var(--border)" }}>
                <th style={TH}></th>
                <th style={TH}>Código</th>
                <th style={TH}>Nombre en catálogo</th>
                <th style={TH}>Descripción</th>
                <th style={{ ...TH, textAlign: "right" }}>Precio ($)</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const cfg = config[p.id] || {};
                const isLast = i === products.length - 1;
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: isLast ? "none" : "1px solid var(--border)",
                      opacity: cfg.included ? 1 : 0.4,
                    }}
                  >
                    <td style={{ padding: "8px 12px", width: 36 }}>
                      <input
                        type="checkbox"
                        checked={!!cfg.included}
                        onChange={(e) => updateConfig(p.id, "included", e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td style={{
                      padding: "8px 10px", fontFamily: "var(--font-mono)",
                      fontSize: 12, color: "var(--accent)", fontWeight: 600, width: 90,
                    }}>
                      {p.code || "—"}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        className="input"
                        value={cfg.displayName || ""}
                        onChange={(e) => updateConfig(p.id, "displayName", e.target.value)}
                        style={{ width: "100%", fontSize: 13, padding: "4px 8px" }}
                        disabled={!cfg.included}
                      />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        className="input"
                        value={cfg.description || ""}
                        onChange={(e) => updateConfig(p.id, "description", e.target.value)}
                        placeholder="opcional"
                        style={{ width: "100%", fontSize: 12, padding: "4px 8px" }}
                        disabled={!cfg.included}
                      />
                    </td>
                    <td style={{ padding: "6px 10px", width: 140 }}>
                      <input
                        className="input"
                        type="number"
                        value={cfg.priceValue ?? ""}
                        onChange={(e) => updateConfig(p.id, "priceValue", e.target.value)}
                        placeholder="sin precio"
                        style={{
                          width: "100%", fontSize: 13, padding: "4px 8px",
                          textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700,
                        }}
                        disabled={!cfg.included}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{
            padding: "8px 14px", borderTop: "1px solid var(--border)",
            fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)",
          }}>
            {products.length} producto{products.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {!loading && products.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
          Cargá una categoría o buscá productos uno por uno para armar el catálogo
        </div>
      )}
    </div>
  );
}

const TH = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-dim)",
};
