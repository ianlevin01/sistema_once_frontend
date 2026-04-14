import { useState, useEffect, useRef, useCallback } from "react";
import {
  getComprobantes, getComprobante, createComprobante, updateComprobante,
  deleteComprobante, searchCustomers, searchProveedores, getWarehouses,
  getLastSalePrice,
} from "../utils/api";
import { useAuth } from "../utils/useAuth";
import { useToast } from "../utils/useToast";
import { useVendedores } from "../utils/useVendedores";
import ProductSearchBar from "../components/ProductSearchBar";

// ── Constantes ─────────────────────────────────────────────────
const TIPOS   = ["Presupuesto","Devolucion","Nota de Pedido","Reposicion","Devol a proveedor"];
const PAGOS   = ["Contado","Cta Cte","Tarjeta","Banco","Mercado Pago","Cheque"];
const PRECIOS = ["precio_1","precio_2","precio_3","precio_4","precio_5","costo"];
const PRECIO_LBL = {
  precio_1:"Precio #1", precio_2:"Precio #2", precio_3:"Precio #3",
  precio_4:"Precio #4", precio_5:"Precio #5", costo:"Costo",
};
const TIPOS_CON_CONSUMIDOR_FINAL = ["Presupuesto","Devolucion","Nota de Pedido"];
const today = () => new Date().toISOString().slice(0, 10);
const fmt   = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 });

// ── Componente de fila de item editable ────────────────────────
function ItemRow({ item, idx, onRemove, onChangeQty, onChangePrice, onChangeDesc }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 90px 110px 36px", gap:8, padding:"10px 0", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)" }}>{item.code || "—"}</span>
      <input
        className="input"
        style={{ fontSize:13, height:32, padding:"0 8px" }}
        value={item.description || item.name}
        onChange={(e) => onChangeDesc(idx, e.target.value)}
      />
      <input
        className="input"
        style={{ fontSize:13, height:32, textAlign:"center", fontFamily:"var(--font-mono)", padding:"0 6px" }}
        type="number" min="1"
        value={item.quantity}
        onChange={(e) => onChangeQty(idx, Number(e.target.value))}
      />
      <input
        className="input"
        style={{ fontSize:13, height:32, textAlign:"right", fontFamily:"var(--font-mono)", color:"var(--accent)", padding:"0 8px" }}
        type="number" min="0" step="0.01"
        value={item.unit_price}
        onChange={(e) => onChangePrice(idx, Number(e.target.value))}
      />
      <button onClick={() => onRemove(idx)} style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", fontSize:18, textAlign:"center" }}>✕</button>
    </div>
  );
}

// ── Panel izquierdo de configuración ──────────────────────────
function LeftPanel({
  tipo, setTipo, payMethod, setPayMethod, priceType, setPriceType,
  vendedor, setVendedor, textoLibre, setTextoLibre,
  esReposicion, admiteConsumidorFinal,
  esConsumidorFinal, toggleConsumidorFinal,
  consumidorFinalNombre, setConsumidorFinalNombre,
  divisa, setDivisa,
  custSel, custQuery, setCustQuery, custResults, selectCust, setCustSel,
  provSel, provQuery, setProvQuery, provResults, selectProv, setProvSel,
  warehouses, warehouseId, setWarehouseId,
  vendedores, lastPrice, user,
  onSave, onCancel, saving, isEditing,
  total, itemCount,
}) {
  const [showConfig, setShowConfig] = useState(false);

  return (
    <div style={{ width:300, flexShrink:0, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", background:"var(--bg2)", overflow:"hidden" }}>

      {/* Header compacto */}
      <div style={{ padding:"14px 16px 10px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:10, fontWeight:700, color:"var(--accent)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>
          {isEditing ? "✏️ Editando" : "Nuevo comprobante"}
        </div>

        {/* Tipo — botones compactos 2 columnas */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
          {TIPOS.map((t) => (
            <button key={t} onClick={() => setTipo(t)}
              disabled={isEditing}
              style={{
                padding:"6px 4px", borderRadius:4, cursor: isEditing ? "default" : "pointer",
                fontSize:11, fontFamily:"var(--font-mono)", border:"1px solid var(--border)",
                background: tipo===t ? "var(--accent-dim)" : "transparent",
                color:      tipo===t ? "var(--accent)"     : "var(--text-dim)",
                borderColor: tipo===t ? "var(--accent)"    : "var(--border)",
                fontWeight: tipo===t ? 700 : 400,
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                opacity: isEditing ? 0.6 : 1,
              }}
              title={t}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Cliente / Proveedor */}
      <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
        <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
          {esReposicion ? "Proveedor" : "Cliente"}
        </div>

        {esReposicion ? (
          provSel ? (
            <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600 }}>{provSel.name}</span>
              <button onClick={() => setProvSel(null)} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:14 }}>✕</button>
            </div>
          ) : (
            <>
              <div className="search-bar" style={{ height:34 }}>
                <span className="search-icon">🔍</span>
                <input placeholder="Nombre o CUIT..." value={provQuery} onChange={(e) => setProvQuery(e.target.value)} style={{ fontSize:12 }} />
              </div>
              {provResults.length > 0 && (
                <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, maxHeight:120, overflowY:"auto", marginTop:4 }}>
                  {provResults.map((p) => (
                    <div key={p.id} onClick={() => selectProv(p)}
                      style={{ padding:"7px 10px", fontSize:13, cursor:"pointer", borderBottom:"1px solid var(--border)", color:"var(--text)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background="var(--bg2)"}
                      onMouseLeave={(e) => e.currentTarget.style.background="transparent"}>
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        ) : (
          <>
            {admiteConsumidorFinal && (
              <div style={{ display:"flex", gap:4, marginBottom:8 }}>
                {["Cliente","Cons. Final"].map((lbl, i) => {
                  const isCF = i === 1;
                  const active = esConsumidorFinal === isCF;
                  return (
                    <button key={lbl} onClick={() => toggleConsumidorFinal(isCF)}
                      style={{
                        flex:1, padding:"5px 0", borderRadius:4, cursor:"pointer", fontSize:11,
                        fontFamily:"var(--font-mono)", border:"1px solid var(--border)",
                        background: active ? "var(--accent-dim)" : "transparent",
                        color:      active ? "var(--accent)"     : "var(--text-dim)",
                        fontWeight: active ? 700 : 400,
                      }}>
                      {lbl}
                    </button>
                  );
                })}
              </div>
            )}

            {esConsumidorFinal ? (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <input className="input" placeholder="Nombre (opcional)" value={consumidorFinalNombre}
                  onChange={(e) => setConsumidorFinalNombre(e.target.value)} style={{ fontSize:12, height:32 }} />
                <div style={{ display:"flex", gap:4 }}>
                  {["ARS","USD"].map((d) => (
                    <button key={d} onClick={() => setDivisa(d)}
                      style={{
                        flex:1, padding:"6px 0", borderRadius:4, cursor:"pointer", fontSize:12,
                        fontFamily:"var(--font-mono)", fontWeight:700,
                        border:`1px solid ${divisa===d ? "var(--accent)" : "var(--border)"}`,
                        background: divisa===d ? "var(--accent-dim)" : "transparent",
                        color:      divisa===d ? "var(--accent)"     : "var(--text-muted)",
                      }}>
                      {d === "ARS" ? "🪙 ARS" : "💵 USD"}
                    </button>
                  ))}
                </div>
              </div>
            ) : custSel ? (
              <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600 }}>{custSel.name}</span>
                <button onClick={() => { setCustSel(null); }} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:14 }}>✕</button>
              </div>
            ) : (
              <>
                <div className="search-bar" style={{ height:34 }}>
                  <span className="search-icon">🔍</span>
                  <input placeholder="Nombre o CUIT..." value={custQuery} onChange={(e) => setCustQuery(e.target.value)} style={{ fontSize:12 }} />
                </div>
                {custResults.length > 0 && (
                  <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, maxHeight:120, overflowY:"auto", marginTop:4 }}>
                    {custResults.map((c) => (
                      <div key={c.id} onClick={() => selectCust(c)}
                        style={{ padding:"7px 10px", fontSize:13, cursor:"pointer", borderBottom:"1px solid var(--border)", color:"var(--text)" }}
                        onMouseEnter={(e) => e.currentTarget.style.background="var(--bg2)"}
                        onMouseLeave={(e) => e.currentTarget.style.background="transparent"}>
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Configuración colapsable */}
      <div style={{ flex:1, overflowY:"auto" }}>
        <button
          onClick={() => setShowConfig(v => !v)}
          style={{ width:"100%", padding:"10px 16px", background:"transparent", border:"none", borderBottom:"1px solid var(--border)", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em" }}>
          Configuración
          <span style={{ fontSize:14, transform: showConfig ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}>▾</span>
        </button>

        {showConfig && (
          <div style={{ padding:"12px 16px" }}>
            {esReposicion && (
              <div className="input-group">
                <label className="input-label">Depósito destino</label>
                <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={{ fontSize:12, height:32 }}>
                  <option value="">— seleccionar —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Método de pago</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                {PAGOS.map((p) => (
                  <button key={p} onClick={() => setPayMethod(p)}
                    style={{ padding:"4px 10px", borderRadius:4, fontSize:11, fontFamily:"var(--font-mono)", cursor:"pointer",
                      border:"1px solid var(--border)",
                      background: payMethod===p ? "var(--accent)" : "transparent",
                      color:      payMethod===p ? "#fff"          : "var(--text-dim)",
                    }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {!esReposicion && (
              <div className="input-group">
                <label className="input-label">Tipo de precio</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {PRECIOS.map((p) => (
                    <button key={p} onClick={() => setPriceType(p)}
                      style={{ padding:"4px 10px", borderRadius:4, fontSize:11, fontFamily:"var(--font-mono)", cursor:"pointer",
                        border:"1px solid var(--border)",
                        background: priceType===p ? "var(--accent-dim)" : "transparent",
                        color:      priceType===p ? "var(--accent)"     : "var(--text-dim)",
                      }}>
                      {PRECIO_LBL[p]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Vendedor</label>
              <select className="select" value={vendedor} onChange={(e) => setVendedor(e.target.value)} style={{ fontSize:12, height:32 }}>
                <option value="">— ninguno —</option>
                {vendedores.map((v) => <option key={v.id} value={v.nombre}>{v.nombre}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Observaciones</label>
              <input className="input" value={textoLibre} onChange={(e) => setTextoLibre(e.target.value)} placeholder="Texto libre..." style={{ fontSize:12, height:32 }} />
            </div>
          </div>
        )}
      </div>

      {/* Resumen y botones */}
      <div style={{ padding:"12px 16px", borderTop:"1px solid var(--border)", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, padding:"8px 10px", background:"var(--bg3)", borderRadius:6 }}>
          <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-dim)" }}>
            {itemCount} ítem{itemCount !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize:15, fontFamily:"var(--font-mono)", fontWeight:800, color:"var(--accent)" }}>
            {esConsumidorFinal && divisa === "USD" ? "USD " : "$"}{fmt(total)}
          </span>
        </div>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}
          style={{ width:"100%", fontSize:14, padding:"11px", marginBottom:6 }}>
          {saving ? "Guardando..." : isEditing ? "✓ Guardar cambios" : "✓ Cerrar comprobante"}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} style={{ width:"100%", fontSize:13 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────
export default function Comprobantes() {
  const { user } = useAuth();
  const vendedores = useVendedores();
  const [comprobantes, setComprobantes] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [creating,     setCreating]     = useState(false);
  const [editingId,    setEditingId]    = useState(null); // id del comprobante en edición

  const [from,        setFrom]        = useState(today());
  const [to,          setTo]          = useState(today());
  const [appliedFrom, setAppliedFrom] = useState(today());
  const [appliedTo,   setAppliedTo]   = useState(today());
  const filterDirty = from !== appliedFrom || to !== appliedTo;

  // Form state
  const [tipo,       setTipo]       = useState("Presupuesto");
  const [payMethod,  setPayMethod]  = useState("Contado");
  const [priceType,  setPriceType]  = useState("precio_1");
  const [vendedor,   setVendedor]   = useState("");
  const [textoLibre, setTextoLibre] = useState("");

  const [esConsumidorFinal,     setEsConsumidorFinal]     = useState(false);
  const [consumidorFinalNombre, setConsumidorFinalNombre] = useState("");
  const [divisa,                setDivisa]                = useState("ARS");

  const [custQuery,   setCustQuery]   = useState("");
  const [custResults, setCustResults] = useState([]);
  const [custSel,     setCustSel]     = useState(null);

  const [provQuery,   setProvQuery]   = useState("");
  const [provResults, setProvResults] = useState([]);
  const [provSel,     setProvSel]     = useState(null);

  const [warehouses,  setWarehouses]  = useState([]);
  const [warehouseId, setWarehouseId] = useState("");

  const [items,     setItems]     = useState([]);
  const [prodSel,   setProdSel]   = useState(null);
  const [itemQty,   setItemQty]   = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDesc,  setItemDesc]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [lastPrice, setLastPrice] = useState(null);

  const qtyRef = useRef(null);
  const { addToast, ToastContainer } = useToast();

  const esReposicion          = tipo === "Reposicion";
  const admiteConsumidorFinal = TIPOS_CON_CONSUMIDOR_FINAL.includes(tipo);
  const isEditing             = !!editingId;
  const total                 = items.reduce((a, it) => a + it.quantity * it.unit_price, 0);

  // ── Carga ─────────────────────────────────────────────────────
  const loadAll = async (f = appliedFrom, t = appliedTo) => {
    setLoading(true);
    try { const { data } = await getComprobantes(f, t); setComprobantes(data); }
    catch { addToast("Error cargando comprobantes", "error"); }
    setLoading(false);
  };

  const applyFilter = () => { setAppliedFrom(from); setAppliedTo(to); loadAll(from, to); };
  useEffect(() => { loadAll(today(), today()); }, []);

  useEffect(() => { if (!admiteConsumidorFinal) setEsConsumidorFinal(false); }, [tipo, admiteConsumidorFinal]);

  useEffect(() => {
    if (esReposicion && warehouses.length === 0) {
      getWarehouses().then(({ data }) => setWarehouses(data)).catch(() => {});
    }
  }, [esReposicion]);

  useEffect(() => {
    if (!custQuery.trim() || esReposicion || esConsumidorFinal) { setCustResults([]); return; }
    const t = setTimeout(async () => {
      try { const { data } = await searchCustomers(custQuery); setCustResults(data); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [custQuery, esReposicion, esConsumidorFinal]);

  useEffect(() => {
    if (!provQuery.trim() || !esReposicion) { setProvResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await searchProveedores(provQuery);
        setProvResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [provQuery, esReposicion]);

  useEffect(() => {
    if (prodSel) {
      const prices = prodSel?.prices || prodSel?.product_prices || [];
      const found  = prices.find((p) => p.price_type === priceType);
      setItemPrice(found ? String(Number(found.price)) : "");
    }
  }, [priceType, prodSel]);

  const fetchLastPrice = useCallback(async (productId) => {
    if (!custSel?.id || !productId || esReposicion || esConsumidorFinal) { setLastPrice(null); return; }
    try { const { data } = await getLastSalePrice(custSel.id, productId); setLastPrice(data || null); }
    catch { setLastPrice(null); }
  }, [custSel, esReposicion, esConsumidorFinal]);

  const selectCust = (c) => { setCustSel(c); setCustQuery(""); setCustResults([]); setLastPrice(null); };
  const selectProv = (p) => { setProvSel(p); setProvQuery(""); setProvResults([]); };

  const toggleConsumidorFinal = (val) => {
    setEsConsumidorFinal(val);
    if (val) { setCustSel(null); setCustQuery(""); setCustResults([]); setLastPrice(null); }
    else     { setConsumidorFinalNombre(""); setDivisa("ARS"); }
  };

  const handleProdSelect = ({ product, price }) => {
    setProdSel(product);
    setItemDesc(product.name);
    setItemPrice(price > 0 ? String(price) : "");
    if (!esConsumidorFinal) fetchLastPrice(product.id);
    setTimeout(() => qtyRef.current?.focus(), 50);
  };

  const confirmItem = () => {
    if (!prodSel)                         { addToast("Seleccioná un producto", "error"); return; }
    if (!itemQty || Number(itemQty) <= 0) { addToast("Ingresá una cantidad válida", "error"); return; }
    setItems((prev) => [...prev, {
      product_id:  prodSel.id,
      code:        prodSel.code || "",
      name:        prodSel.name,
      description: itemDesc || prodSel.name,
      quantity:    Number(itemQty),
      unit_price:  Number(itemPrice) || 0,
    }]);
    setProdSel(null); setItemQty(""); setItemPrice(""); setItemDesc(""); setLastPrice(null);
  };

  const removeItem     = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const changeItemQty  = (i, q) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, quantity: q } : it));
  const changeItemPrice= (i, p) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, unit_price: p } : it));
  const changeItemDesc = (i, d) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, description: d } : it));

  // ── Crear ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (esReposicion) {
      if (!provSel)     { addToast("Seleccioná un proveedor", "error"); return; }
      if (!warehouseId) { addToast("Seleccioná el depósito de destino", "error"); return; }
    } else if (!esConsumidorFinal) {
      if (!custSel)     { addToast("Seleccioná un cliente", "error"); return; }
    }
    if (items.length === 0) { addToast("Agregá al menos un producto", "error"); return; }

    setSaving(true);
    try {
      await createComprobante({
        customer_id:             esReposicion ? null : (esConsumidorFinal ? null : custSel.id),
        supplier_id:             esReposicion ? provSel.id : null,
        warehouse_id:            esReposicion ? warehouseId : (user?.warehouse_id || null),
        user_id:                 user?.id || null,
        payment_method:          payMethod,
        tipo, vendedor, price_type: priceType, texto_libre: textoLibre,
        es_consumidor_final:     esConsumidorFinal,
        consumidor_final_nombre: esConsumidorFinal ? (consumidorFinalNombre || "Consumidor Final") : null,
        divisa:                  esConsumidorFinal ? divisa : "ARS",
        items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Comprobante creado", "success");
      setCreating(false); resetForm(); loadAll(appliedFrom, appliedTo);
    } catch { addToast("Error creando comprobante", "error"); }
    setSaving(false);
  };

  // ── Editar — abrir formulario con datos existentes ─────────────
  const handleOpenEdit = async (id) => {
    try {
      const { data: c } = await getComprobante(id);
      setEditingId(id);
      setCreating(true);
      setTipo(c.tipo || "Presupuesto");
      setVendedor(c.vendedor || "");
      setTextoLibre(c.texto_libre || "");
      setPriceType(c.price_type || "precio_1");

      const paymentMethod = c.payments?.[0]?.method || "Contado";
      setPayMethod(paymentMethod);

      setEsConsumidorFinal(!!c.es_consumidor_final);
      setConsumidorFinalNombre(c.consumidor_final_nombre || "");
      setDivisa(c.divisa || "ARS");

      if (c.customer_id && c.customer_name) {
        setCustSel({ id: c.customer_id, name: c.customer_name });
      }
      if (c.supplier_id && c.supplier_name) {
        setProvSel({ id: c.supplier_id, name: c.supplier_name });
      }
      if (c.warehouse_id) {
        setWarehouseId(c.warehouse_id);
        if (warehouses.length === 0) {
          const { data: wh } = await getWarehouses();
          setWarehouses(wh);
        }
      }

      setItems((c.items || []).map((it) => ({
        product_id:  it.product_id,
        code:        it.product_code || it.code || "",
        name:        it.product_name || it.name || "",
        description: it.product_name || it.name || "",
        quantity:    it.quantity,
        unit_price:  Number(it.unit_price),
      })));
    } catch { addToast("Error cargando comprobante", "error"); }
  };

  // ── Guardar edición ────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (items.length === 0) { addToast("Agregá al menos un producto", "error"); return; }
    setSaving(true);
    try {
      await updateComprobante(editingId, {
        vendedor, texto_libre: textoLibre, price_type: priceType,
        payment_method: payMethod,
        items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Comprobante actualizado", "success");
      setCreating(false); setEditingId(null); resetForm(); loadAll(appliedFrom, appliedTo);
    } catch (err) { addToast(err?.response?.data?.message || "Error actualizando", "error"); }
    setSaving(false);
  };

  const resetForm = () => {
    setTipo("Presupuesto"); setPayMethod("Contado"); setPriceType("precio_1");
    setVendedor(""); setTextoLibre("");
    setCustSel(null); setCustQuery(""); setCustResults([]);
    setProvSel(null); setProvQuery(""); setProvResults([]);
    setWarehouseId("");
    setItems([]); setProdSel(null); setItemQty(""); setItemPrice(""); setItemDesc("");
    setLastPrice(null); setEditingId(null);
    setEsConsumidorFinal(false); setConsumidorFinalNombre(""); setDivisa("ARS");
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este comprobante? Se revertirá el stock y la cuenta corriente.")) return;
    try {
      await deleteComprobante(id);
      addToast("Eliminado y stock revertido", "success");
      loadAll(appliedFrom, appliedTo);
    } catch (err) { addToast(err?.response?.data?.message || "Error eliminando", "error"); }
  };

  const openDetail = async (id) => {
    try { const { data } = await getComprobante(id); setSelected(data); }
    catch { addToast("Error cargando", "error"); }
  };

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <>
      <ToastContainer />

      {!creating ? (
        /* ── LISTADO ── */
        <>
          <div style={{ display:"flex", gap:10, marginBottom:24, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>DESDE</span>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width:150 }} />
              <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>HASTA</span>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width:150 }} />
              {filterDirty && <button className="btn btn-primary btn-sm" onClick={applyFilter}>Filtrar</button>}
            </div>
            <div style={{ flex:1 }} />
            <button className="btn btn-primary" style={{ fontSize:15, padding:"10px 22px" }}
              onClick={() => { setCreating(true); resetForm(); }}>
              + Nuevo comprobante
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Comprobantes</span>
              <span className="badge badge-info">{comprobantes.length}</span>
            </div>
            {loading ? <div className="empty">Cargando...</div> : comprobantes.length === 0 ? (
              <div className="empty">No hay comprobantes</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Tipo</th><th>Cliente / Proveedor</th><th>Vendedor</th><th>Total</th><th>Pago</th><th>Estado</th><th>Fecha</th><th></th></tr>
                  </thead>
                  <tbody>
                    {comprobantes.map((c) => (
                      <tr key={c.id}>
                        <td><span className="badge badge-accent">{c.tipo || "Presupuesto"}</span></td>
                        <td style={{ fontSize:14 }}>
                          {c.customer_name || c.supplier_name || (c.es_consumidor_final ? (c.consumidor_final_nombre || "Consumidor Final") : "—")}
                          {c.es_consumidor_final && (
                            <span style={{ marginLeft:6, fontSize:10, fontFamily:"var(--font-mono)", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:3, padding:"1px 5px", color:"var(--text-dim)" }}>
                              {c.divisa || "ARS"}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>{c.vendedor || "—"}</td>
                        <td style={{ fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", fontSize:14 }}>
                          {c.divisa === "USD" ? "USD " : "$"}{fmt(c.total)}
                        </td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>{c.payment_method || "—"}</td>
                        <td><span className="badge badge-success">{c.status}</span></td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR") : "—"}
                        </td>
                        <td>
                          <div style={{ display:"flex", gap:6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openDetail(c.id)}>Ver</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleOpenEdit(c.id)}>✏️</button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal detalle */}
          {selected && (
            <div className="modal-overlay" onClick={() => setSelected(null)}>
              <div className="modal" style={{ maxWidth:600 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title">{selected.tipo || "Comprobante"} — {selected.id?.slice(0,8)}…</span>
                  <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                </div>
                <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
                  <span className="badge badge-success">{selected.status}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:14, color:"var(--accent)", fontWeight:700 }}>
                    Total: {selected.divisa === "USD" ? "USD " : "$"}{fmt(selected.total)}
                  </span>
                  {selected.customer_name && <span style={{ fontSize:13, color:"var(--text-muted)" }}>{selected.customer_name}</span>}
                  {selected.supplier_name && <span style={{ fontSize:13, color:"var(--text-muted)" }}>Prov: {selected.supplier_name}</span>}
                  {selected.warehouse_name && <span style={{ fontSize:13, color:"var(--text-muted)" }}>Dep: {selected.warehouse_name}</span>}
                  {selected.vendedor && <span style={{ fontSize:13, color:"var(--text-muted)" }}>Vend: {selected.vendedor}</span>}
                  {selected.price_type && <span style={{ fontSize:12, color:"var(--text-dim)" }}>{PRECIO_LBL[selected.price_type]}</span>}
                </div>
                {selected.texto_libre && (
                  <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 14px", marginBottom:14, fontSize:13, color:"var(--text-muted)" }}>
                    {selected.texto_libre}
                  </div>
                )}
                {/* Tabla de items */}
                {selected.items?.length > 0 ? (
                  <div style={{ border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", marginBottom:10 }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                      <thead>
                        <tr style={{ background:"var(--bg3)", borderBottom:"2px solid var(--border)" }}>
                          {["Código","Producto","Cant.","P.Unit.","Total"].map((h, i) => (
                            <th key={h} style={{ padding:"7px 10px", fontFamily:"var(--font-mono)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--text-dim)", textAlign: i > 1 ? "right" : "left" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selected.items.map((it, i) => (
                          <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                            <td style={{ padding:"7px 10px", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)" }}>{it.product_code || it.code || "—"}</td>
                            <td style={{ padding:"7px 10px", fontSize:13 }}>{it.product_name || it.name || "—"}</td>
                            <td style={{ padding:"7px 10px", fontFamily:"var(--font-mono)", fontSize:13, textAlign:"right" }}>{it.quantity}</td>
                            <td style={{ padding:"7px 10px", fontFamily:"var(--font-mono)", fontSize:13, textAlign:"right", color:"var(--text-muted)" }}>${fmt(it.unit_price)}</td>
                            <td style={{ padding:"7px 10px", fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, textAlign:"right", color:"var(--accent)" }}>
                              ${fmt(it.quantity * Number(it.unit_price))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background:"var(--bg3)", borderTop:"2px solid var(--border)" }}>
                          <td colSpan={4} style={{ padding:"8px 10px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-muted)" }}>TOTAL</td>
                          <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:15, fontWeight:800, color:"var(--accent)" }}>
                            {selected.divisa === "USD" ? "USD " : "$"}{fmt(selected.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : <div className="empty">Sin items</div>}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── NUEVO / EDITAR COMPROBANTE ── */
        <div style={{ display:"flex", height:"calc(100vh - 56px)", margin:"-28px", overflow:"hidden" }}>

          <LeftPanel
            tipo={tipo} setTipo={setTipo}
            payMethod={payMethod} setPayMethod={setPayMethod}
            priceType={priceType} setPriceType={setPriceType}
            vendedor={vendedor} setVendedor={setVendedor}
            textoLibre={textoLibre} setTextoLibre={setTextoLibre}
            esReposicion={esReposicion} admiteConsumidorFinal={admiteConsumidorFinal}
            esConsumidorFinal={esConsumidorFinal} toggleConsumidorFinal={toggleConsumidorFinal}
            consumidorFinalNombre={consumidorFinalNombre} setConsumidorFinalNombre={setConsumidorFinalNombre}
            divisa={divisa} setDivisa={setDivisa}
            custSel={custSel} custQuery={custQuery} setCustQuery={setCustQuery}
            custResults={custResults} selectCust={selectCust} setCustSel={setCustSel}
            provSel={provSel} provQuery={provQuery} setProvQuery={setProvQuery}
            provResults={provResults} selectProv={selectProv} setProvSel={setProvSel}
            warehouses={warehouses} warehouseId={warehouseId} setWarehouseId={setWarehouseId}
            vendedores={vendedores} lastPrice={lastPrice} user={user}
            onSave={isEditing ? handleSaveEdit : handleCreate}
            onCancel={() => { setCreating(false); resetForm(); }}
            saving={saving} isEditing={isEditing}
            total={total} itemCount={items.length}
          />

          {/* Panel central */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--bg)" }}>
            <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
              {items.length === 0 ? (
                <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text-dim)", gap:14 }}>
                  <span style={{ fontSize:48 }}>🧾</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:13 }}>Buscá un producto abajo para agregar</span>
                </div>
              ) : (
                <>
                  {/* Header de columnas */}
                  <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 90px 110px 36px", gap:8, padding:"0 0 8px", borderBottom:"2px solid var(--border)", marginBottom:2 }}>
                    {["Código","Descripción","Cant.","Precio",""].map((h) => (
                      <div key={h} style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</div>
                    ))}
                  </div>
                  {items.map((it, i) => (
                    <ItemRow key={i} item={it} idx={i}
                      onRemove={removeItem}
                      onChangeQty={changeItemQty}
                      onChangePrice={changeItemPrice}
                      onChangeDesc={changeItemDesc}
                    />
                  ))}
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:20, paddingTop:14, borderTop:"2px solid var(--border)" }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Total</div>
                      <div style={{ fontSize:28, fontFamily:"var(--font-mono)", fontWeight:800, color:"var(--accent)" }}>
                        {esConsumidorFinal && divisa === "USD" ? "USD " : "$"}{fmt(total)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Barra de búsqueda */}
            <div style={{ borderTop:"2px solid var(--border)", background:"var(--bg2)", padding:"12px 24px 14px", flexShrink:0 }}>
              {prodSel && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ padding:"8px 12px", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700 }}>{prodSel.code}</span>
                    <span style={{ fontSize:13, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{prodSel.name}</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent)", fontWeight:700, flexShrink:0 }}>
                      {esConsumidorFinal && divisa === "USD" ? "USD " : "$"}{fmt(Number(itemPrice || 0))}
                    </span>
                    <span style={{ fontSize:11, color:"var(--text-dim)", flexShrink:0 }}>← ingresá cantidad</span>
                  </div>
                  {lastPrice && custSel && (
                    <div style={{ marginTop:5, padding:"5px 10px", background:"rgba(255,200,0,0.08)", border:"1px solid rgba(255,200,0,0.25)", borderRadius:5, fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ color:"rgba(255,200,0,0.8)" }}>⏱</span>
                      <span>Última venta a <strong style={{ color:"var(--text)" }}>{custSel.name}</strong>:</span>
                      <span style={{ color:"var(--accent)", fontWeight:700 }}>${fmt(lastPrice.unit_price)}</span>
                      <span style={{ color:"var(--text-dim)" }}>el {new Date(lastPrice.created_at).toLocaleDateString("es-AR")}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", whiteSpace:"nowrap" }}>Desc:</div>
                <input className="input" style={{ flex:1, fontSize:13, height:34 }} placeholder="Enter si no modifica"
                  value={itemDesc} onChange={(e) => setItemDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmItem(); }} />
              </div>

              <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                <div style={{ flex:2, minWidth:0 }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Código o descripción</div>
                  <ProductSearchBar priceType={priceType} onSelect={handleProdSelect} autoFocus={!prodSel} dropUp />
                </div>
                <div style={{ flex:"0 0 100px" }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Cantidad</div>
                  <input ref={qtyRef} className="input"
                    style={{ height:38, fontSize:15, fontFamily:"var(--font-mono)", textAlign:"center", width:"100%" }}
                    placeholder="0" value={itemQty} onChange={(e) => setItemQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmItem(); }} />
                </div>
                <div style={{ flex:"0 0 120px" }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>
                    {PRECIO_LBL[priceType]}
                  </div>
                  <input className="input"
                    style={{ height:38, fontSize:15, fontFamily:"var(--font-mono)", color:"var(--accent)", fontWeight:700, width:"100%" }}
                    placeholder="0.00" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmItem(); }} />
                </div>
                <button className="btn btn-primary" onClick={confirmItem}
                  style={{ height:38, fontSize:13, padding:"0 18px", flexShrink:0 }}>
                  + Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
