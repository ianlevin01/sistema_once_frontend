import { useState, useEffect } from "react";
import { getCategories, getProductsForCatalog } from "../utils/api";
import { printCatalogoPDF } from "../utils/printDoc";
import { useToast } from "../utils/useToast";

export default function CatalogosPersonalizados() {
  useEffect(() => { document.title = "Catálogos — Once"; }, []);
  const [categories,   setCategories]   = useState([]);
  const [selectedCat,  setSelectedCat]  = useState("");
  const [products,     setProducts]     = useState([]);
  const [config,       setConfig]       = useState({});   // { [id]: { included, displayName, description, priceValue } }
  const [loading,      setLoading]      = useState(false);
  const [columns,      setColumns]      = useState(3);
  const [catalogTitle, setCatalogTitle] = useState("Catálogo de Productos");
  const { addToast, ToastContainer } = useToast();

  useEffect(() => {
    getCategories()
      .then((r) => setCategories(r.data || r))
      .catch(() => addToast("Error cargando categorías", "error"));
  }, []);

  const loadProducts = async () => {
    if (!selectedCat || selectedCat === "") return;
    setLoading(true);
    try {
      const { data } = await getProductsForCatalog(selectedCat);
      setProducts(data);
      setConfig((prev) => {
        const next = { ...prev };
        data.forEach((p) => {
          if (!next[p.id]) {
            const precio1 = p.prices?.[0]?.price ?? null;
            next[p.id] = {
              included:    true,
              displayName: p.name,
              description: p.description || "",
              priceValue:  precio1 != null ? String(Math.round(precio1)) : "",
            };
          }
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
          imageUrl:    p.images?.[0]?.url || null,
        };
      });

    if (!included.length) {
      addToast("Seleccioná al menos un producto", "error");
      return;
    }
    printCatalogoPDF(included, { columns, title: catalogTitle });
  };

  const includedCount = products.filter((p) => config[p.id]?.included).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ToastContainer />

      {/* Filtro categoría */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div className="input-label">Categoría</div>
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
        </div>
        <button
          className="btn btn-primary"
          onClick={loadProducts}
          disabled={!selectedCat || selectedCat === "" || loading}
        >
          {loading ? "Cargando..." : "Cargar productos"}
        </button>
      </div>

      {/* Opciones del catálogo */}
      {products.length > 0 && (
        <div style={{
          display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end",
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "12px 16px",
        }}>
          <div>
            <div className="input-label">Título del catálogo</div>
            <input
              className="input"
              value={catalogTitle}
              onChange={(e) => setCatalogTitle(e.target.value)}
              style={{ width: 260 }}
            />
          </div>
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
              Generar catálogo
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
                    {/* Checkbox */}
                    <td style={{ padding: "8px 12px", width: 36 }}>
                      <input
                        type="checkbox"
                        checked={!!cfg.included}
                        onChange={(e) => updateConfig(p.id, "included", e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>

                    {/* Código */}
                    <td style={{
                      padding: "8px 10px", fontFamily: "var(--font-mono)",
                      fontSize: 12, color: "var(--accent)", fontWeight: 600, width: 90,
                    }}>
                      {p.code || "—"}
                    </td>

                    {/* Nombre editable */}
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        className="input"
                        value={cfg.displayName || ""}
                        onChange={(e) => updateConfig(p.id, "displayName", e.target.value)}
                        style={{ width: "100%", fontSize: 13, padding: "4px 8px" }}
                        disabled={!cfg.included}
                      />
                    </td>

                    {/* Descripción editable */}
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

                    {/* Precio editable */}
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

      {!loading && products.length === 0 && selectedCat && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
          No hay productos en esta categoría
        </div>
      )}

      {!selectedCat && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
          Seleccioná una categoría para comenzar
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
