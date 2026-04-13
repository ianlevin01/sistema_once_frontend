import { useState, useEffect, useRef, useCallback } from "react";
import { searchCustomers, createComprobante, deleteComprobante, getListadoCaja, getCashMovements, getCobranzasCC } from "../utils/api";
import { useToast } from "../utils/useToast";
import { useAuth } from "../utils/useAuth";
import { useVendedores } from "../utils/useVendedores";
import ProductSearchBar from "../components/ProductSearchBar";
import { printComprobantePDF } from "../utils/printDoc";

// ── Constantes ────────────────────────────────────────────────
const PAGOS      = ["Contado","Cta Cte","Tarjeta","Banco","Mercado Pago","Cheque"];
const PRECIOS    = ["precio_1","precio_2","precio_3","precio_4","precio_5","costo"];
const PRECIO_LBL = {
  precio_1:"Precio #1", precio_2:"Precio #2", precio_3:"Precio #3",
  precio_4:"Precio #4", precio_5:"Precio #5", costo:"Precio Costo",
};

const today   = () => new Date().toISOString().slice(0, 10);
const fmt     = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-AR") : "—";
const fmtUSD  = (n) => `USD ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

// ── API helpers ───────────────────────────────────────────────
async function fetchWithAuth(url) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}
async function searchProveedores(q) {
  return fetchWithAuth(`/api/proveedores/search?q=${encodeURIComponent(q)}`);
}
async function getWarehouses() {
  return fetchWithAuth("/api/comprobantes/warehouses");
}
async function getLastPrice(customerId, productId) {
  return fetchWithAuth(`/api/comprobantes/last-price?customer_id=${customerId}&product_id=${productId}`)
    .catch(() => null);
}

// ── Skeleton ──────────────────────────────────────────────────
function SkeletonRow({ cols = 4 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding:"10px 12px" }}>
          <div style={{
            height:14, borderRadius:4,
            background:"linear-gradient(90deg,var(--bg3) 25%,var(--border) 50%,var(--bg3) 75%)",
            backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite",
            width: i===1 ? "70%" : i===0 ? "40%" : "55%",
          }} />
        </td>
      ))}
    </tr>
  );
}
function SkeletonCard({ rows=5, cols=4, title="" }) {
  return (
    <div className="card" style={{ marginBottom:24 }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div className="card-header">
        <span className="card-title">{title}</span>
        <div style={{ width:28, height:20, borderRadius:10, background:"var(--bg3)", animation:"shimmer 1.4s infinite", backgroundSize:"200% 100%", backgroundImage:"linear-gradient(90deg,var(--bg3) 25%,var(--border) 50%,var(--bg3) 75%)" }} />
      </div>
      <div className="table-wrap"><table><tbody>
        {Array.from({ length:rows }).map((_,i) => <SkeletonRow key={i} cols={cols} />)}
      </tbody></table></div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook modal presupuestar
// Recibe `user` para poder pasar warehouse_id al crear presupuesto
// ─────────────────────────────────────────────────────────────
function usePresModal({ addToast, onSuccess, vendedores = [], user }) {
  const [open,      setOpen]      = useState(false);
  const [source,    setSource]    = useState(null);
  const [tipo,      setTipo]      = useState("Presupuesto");
  const [payMethod, setPayMethod] = useState("Contado");
  const [priceType, setPriceType] = useState("precio_1");
  const [vendedor,  setVendedor]  = useState("");
  const [texto,     setTexto]     = useState("");
  const [custSel,   setCustSel]   = useState(null);
  const [custQuery, setCustQuery] = useState("");
  const [custRes,   setCustRes]   = useState([]);
  const [items,     setItems]     = useState([]);
  const [prodSel,   setProdSel]   = useState(null);
  const [itemQty,   setItemQty]   = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDesc,  setItemDesc]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [originalItems, setOriginalItems] = useState([]);
  const [provQuery,   setProvQuery]   = useState("");
  const [provResults, setProvResults] = useState([]);
  const [provSel,     setProvSel]     = useState(null);
  const [warehouses,  setWarehouses]  = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [lastPrice,   setLastPrice]   = useState(null);
  const qtyRef = useRef(null);
  const esReposicion = tipo === "Reposicion";

  useEffect(() => {
    if (!open || !custQuery.trim() || esReposicion) { setCustRes([]); return; }
    const t = setTimeout(async () => {
      try { const { data } = await searchCustomers(custQuery); setCustRes(data); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [custQuery, open, esReposicion]);

  useEffect(() => {
    if (!open || !provQuery.trim() || !esReposicion) { setProvResults([]); return; }
    const t = setTimeout(async () => {
      try { setProvResults(await searchProveedores(provQuery)); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [provQuery, open, esReposicion]);

  useEffect(() => {
    if (esReposicion && open && warehouses.length === 0) {
      getWarehouses().then(setWarehouses).catch(() => {});
    }
  }, [esReposicion, open]);

  useEffect(() => {
    if (prodSel) {
      const prices = prodSel?.prices || prodSel?.product_prices || [];
      const found  = prices.find((p) => p.price_type === priceType);
      setItemPrice(found ? String(Number(found.price)) : "");
    }
  }, [priceType, prodSel]);

  const fetchLastPrice = useCallback(async (productId) => {
    if (!custSel?.id || !productId || esReposicion) { setLastPrice(null); return; }
    try { setLastPrice(await getLastPrice(custSel.id, productId)); }
    catch { setLastPrice(null); }
  }, [custSel, esReposicion]);

  const openFor = (order) => {
    setSource(order);
    const itemsPre = (order.items || []).map((i) => ({
      product_id:  i.product_id || null,
      code:        i.code || "",
      name:        i.name || i.description || "",
      description: i.name || i.description || "",
      quantity:    i.quantity,
      unit_price:  Number(i.unit_price || 0),
    }));
    setOriginalItems(itemsPre);
    setItems(itemsPre);
    setCustSel(order.customer_id ? { id:order.customer_id, name:order.customer_name } : null);
    setCustQuery(order.customer_name || "");
    setTipo("Presupuesto"); setPayMethod("Contado"); setPriceType("precio_1");
    setVendedor(order.vendedor || ""); setTexto(order.texto_libre || "");
    setProdSel(null); setItemQty(""); setItemPrice(""); setItemDesc("");
    setProvSel(null); setProvQuery(""); setWarehouseId(""); setLastPrice(null);
    setOpen(true);
  };

  const selectCust = (c) => { setCustSel(c); setCustQuery(""); setCustRes([]); setLastPrice(null); };
  const selectProv = (p) => { setProvSel(p); setProvQuery(""); setProvResults([]); };

  const handleProdSelect = ({ product, price }) => {
    setProdSel(product);
    setItemDesc(product.name);
    setItemPrice(price > 0 ? String(price) : "");
    fetchLastPrice(product.id);
    setTimeout(() => qtyRef.current?.focus(), 50);
  };

  const confirmItem = () => {
    if (!prodSel)                         { addToast("Seleccioná un producto","error"); return; }
    if (!itemQty || Number(itemQty) <= 0) { addToast("Ingresá una cantidad válida","error"); return; }
    setItems((prev) => [...prev, {
      product_id:  prodSel.id, code:prodSel.code||"", name:prodSel.name,
      description: itemDesc||prodSel.name, quantity:Number(itemQty), unit_price:Number(itemPrice)||0,
    }]);
    setProdSel(null); setItemQty(""); setItemPrice(""); setItemDesc(""); setLastPrice(null);
  };

  const removeItem  = (i) => setItems((prev) => prev.filter((_,idx) => idx !== i));
  const totalCalc   = items.reduce((a,it) => a + it.quantity * it.unit_price, 0);

  const handleCreate = async () => {
    if (esReposicion) {
      if (!provSel)     { addToast("Seleccioná un proveedor","error"); return; }
      if (!warehouseId) { addToast("Seleccioná el depósito","error"); return; }
    } else {
      if (!custSel) { addToast("Seleccioná un cliente","error"); return; }
    }
    if (items.length === 0) { addToast("Agregá al menos un producto","error"); return; }
    setSaving(true);
    try {
      const currentIds   = new Set(items.map((i) => i.product_id).filter(Boolean));
      const removedItems = originalItems.filter((oi) => oi.product_id && !currentIds.has(oi.product_id));
      await createComprobante({
        customer_id:    esReposicion ? null : custSel.id,
        supplier_id:    esReposicion ? provSel.id : null,
        // Para reposición: warehouse elegido en el modal
        // Para presupuesto: warehouse del usuario logueado (igual que en Comprobantes.jsx)
        warehouse_id:   esReposicion ? warehouseId : (user?.warehouse_id || null),
        user_id:        user?.id || null,
        payment_method: payMethod,
        tipo, vendedor, price_type:priceType, texto_libre:texto,
        source_nota_id: source?.id || null,
        removed_items:  removedItems,
        items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Presupuesto creado","success");
      if (removedItems.length > 0) {
        addToast(`Nueva Nota de Pedido con ${removedItems.length} producto${removedItems.length>1?"s":""} eliminado${removedItems.length>1?"s":""}`, "info");
      }
      setOpen(false);
      onSuccess?.();
    } catch { addToast("Error creando presupuesto","error"); }
    setSaving(false);
  };

  return {
    open, setOpen, source, openFor,
    tipo, setTipo, payMethod, setPayMethod, priceType, setPriceType,
    vendedor, setVendedor, texto, setTexto,
    custSel, setCustSel, custQuery, setCustQuery, custRes, selectCust,
    provSel, setProvSel, provQuery, setProvQuery, provResults, selectProv,
    warehouses, warehouseId, setWarehouseId,
    items, removeItem, prodSel, handleProdSelect,
    itemQty, setItemQty, itemPrice, setItemPrice, itemDesc, setItemDesc,
    confirmItem, totalCalc, saving, handleCreate,
    qtyRef, vendedores, originalItems, lastPrice, esReposicion,
  };
}

// ─────────────────────────────────────────────────────────────
// Modal de presupuestar
// ─────────────────────────────────────────────────────────────
function PresModal({ m }) {
  if (!m.open) return null;
  const currentIds = new Set(m.items.map((i) => i.product_id).filter(Boolean));
  const removedNow = m.originalItems.filter((oi) => oi.product_id && !currentIds.has(oi.product_id));

  return (
    <div className="modal-overlay" onClick={() => m.setOpen(false)}>
      <div className="modal"
        style={{ maxWidth:900, width:"96vw", maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ flexShrink:0 }}>
          <span className="modal-title">🧾 Presupuestar — {m.source?.customer_name||"—"}</span>
          <button className="modal-close" onClick={() => m.setOpen(false)}>✕</button>
        </div>

        {removedNow.length > 0 && (
          <div style={{ padding:"10px 18px", background:"rgba(240,160,0,0.12)", borderBottom:"1px solid rgba(240,160,0,0.3)", flexShrink:0 }}>
            <span style={{ fontSize:12, color:"var(--accent)", fontFamily:"var(--font-mono)" }}>
              ⚠️ {removedNow.length} producto{removedNow.length>1?"s eliminados":" eliminado"} →
              nueva Nota con {removedNow.map((i) => i.name||i.description).join(", ")}
            </span>
          </div>
        )}

        <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>
          {/* Columna izquierda */}
          <div style={{ width:240, flexShrink:0, borderRight:"1px solid var(--border)", background:"var(--bg2)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Tipo</div>
              {["Presupuesto","Devolucion","Reposicion"].map((t) => (
                <div key={t} onClick={() => m.setTipo(t)}
                  style={{ padding:"7px 10px", borderRadius:4, cursor:"pointer", marginBottom:3, fontSize:13,
                    background: m.tipo===t ? "var(--accent-dim)" : "transparent",
                    color:      m.tipo===t ? "var(--accent)"     : "var(--text-muted)",
                    borderLeft: `3px solid ${m.tipo===t ? "var(--accent)" : "transparent"}`,
                    fontWeight: m.tipo===t ? 600 : 400,
                  }}>{t}</div>
              ))}
            </div>

            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
                {m.esReposicion ? "Proveedor" : "Cliente"}
              </div>
              {m.esReposicion ? (
                m.provSel ? (
                  <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600 }}>{m.provSel.name}</span>
                    <button onClick={() => m.setProvSel(null)} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:14 }}>✕</button>
                  </div>
                ) : (
                  <>
                    <div className="search-bar" style={{ height:36 }}>
                      <span className="search-icon">🔍</span>
                      <input placeholder="Nombre o CUIT..." value={m.provQuery} onChange={(e) => m.setProvQuery(e.target.value)} style={{ fontSize:12 }} />
                    </div>
                    {m.provResults.length > 0 && (
                      <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, maxHeight:120, overflowY:"auto", marginTop:6 }}>
                        {m.provResults.map((p) => (
                          <div key={p.id} onClick={() => m.selectProv(p)}
                            style={{ padding:"8px 10px", fontSize:13, cursor:"pointer", borderBottom:"1px solid var(--border)" }}
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
                m.custSel ? (
                  <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600 }}>{m.custSel.name}</span>
                    <button onClick={() => m.setCustSel(null)} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:14 }}>✕</button>
                  </div>
                ) : (
                  <>
                    <div className="search-bar" style={{ height:36 }}>
                      <span className="search-icon">🔍</span>
                      <input placeholder="Nombre o CUIT..." value={m.custQuery} onChange={(e) => m.setCustQuery(e.target.value)} style={{ fontSize:12 }} />
                    </div>
                    {m.custRes.length > 0 && (
                      <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, maxHeight:120, overflowY:"auto", marginTop:6 }}>
                        {m.custRes.map((c) => (
                          <div key={c.id} onClick={() => m.selectCust(c)}
                            style={{ padding:"8px 10px", fontSize:13, cursor:"pointer", borderBottom:"1px solid var(--border)" }}
                            onMouseEnter={(e) => e.currentTarget.style.background="var(--bg2)"}
                            onMouseLeave={(e) => e.currentTarget.style.background="transparent"}>
                            {c.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )
              )}
            </div>

            <div style={{ padding:"12px 14px", flex:1, overflowY:"auto" }}>
              {m.esReposicion && (
                <div className="input-group">
                  <label className="input-label" style={{ fontSize:10 }}>Depósito destino</label>
                  <select className="select" value={m.warehouseId} onChange={(e) => m.setWarehouseId(e.target.value)} style={{ fontSize:12 }}>
                    <option value="">— seleccionar —</option>
                    {m.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )}
              <div className="input-group">
                <label className="input-label">Método de pago</label>
                <select className="select" value={m.payMethod} onChange={(e) => m.setPayMethod(e.target.value)} style={{ fontSize:12 }}>
                  {PAGOS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              {!m.esReposicion && (
                <div className="input-group">
                  <label className="input-label">Tipo de precio</label>
                  <select className="select" value={m.priceType} onChange={(e) => m.setPriceType(e.target.value)} style={{ fontSize:12 }}>
                    {PRECIOS.map((p) => <option key={p} value={p}>{PRECIO_LBL[p]}</option>)}
                  </select>
                </div>
              )}
              <div className="input-group">
                <label className="input-label">Vendedor</label>
                <select className="select" value={m.vendedor} onChange={(e) => m.setVendedor(e.target.value)} style={{ fontSize:12 }}>
                  <option value="">— seleccionar —</option>
                  {m.vendedores.map((v) => <option key={v.id} value={v.nombre}>{v.nombre}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Observaciones</label>
                <input className="input" value={m.texto} onChange={(e) => m.setTexto(e.target.value)} placeholder="Texto libre..." style={{ fontSize:12 }} />
              </div>
            </div>

            <div style={{ padding:"12px 14px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
              <button className="btn btn-primary" onClick={m.handleCreate} disabled={m.saving} style={{ width:"100%", fontSize:13, padding:"10px" }}>
                {m.saving ? "Guardando..." : "✓ Cerrar presupuesto"}
              </button>
              <button className="btn btn-ghost" onClick={() => m.setOpen(false)} style={{ width:"100%", fontSize:13 }}>Cancelar</button>
            </div>
          </div>

          {/* Panel central */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
              {m.items.length === 0 ? (
                <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text-dim)", gap:10 }}>
                  <span style={{ fontSize:40 }}>🧾</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:12 }}>Sin productos aún</span>
                </div>
              ) : (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 70px 110px 30px", gap:10, padding:"0 0 8px", borderBottom:"2px solid var(--border)", marginBottom:4 }}>
                    {["Código","Descripción","Cant.","Total",""].map((h) => (
                      <div key={h} style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</div>
                    ))}
                  </div>
                  {m.items.map((it,i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 70px 110px 30px", gap:10, padding:"10px 0", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)" }}>{it.code||"—"}</span>
                      <span style={{ fontSize:13 }}>{it.description||it.name}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)", textAlign:"right" }}>×{it.quantity}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color:"var(--accent)", textAlign:"right" }}>
                        ${(it.quantity*it.unit_price).toLocaleString("es-AR")}
                      </span>
                      <button onClick={() => m.removeItem(i)} style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", fontSize:16 }}>✕</button>
                    </div>
                  ))}
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16, paddingTop:12, borderTop:"2px solid var(--border)" }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Total</div>
                      <div style={{ fontSize:26, fontFamily:"var(--font-mono)", fontWeight:800, color:"var(--accent)" }}>
                        ${m.totalCalc.toLocaleString("es-AR")}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Barra de ingreso */}
            <div style={{ borderTop:"2px solid var(--border)", background:"var(--bg2)", padding:"12px 20px 14px", flexShrink:0 }}>
              {m.prodSel && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ padding:"8px 12px", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700 }}>{m.prodSel.code}</span>
                    <span style={{ fontSize:13, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.prodSel.name}</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700, flexShrink:0 }}>
                      ${Number(m.itemPrice||0).toLocaleString("es-AR")}
                    </span>
                    <span style={{ fontSize:11, color:"var(--text-dim)", flexShrink:0 }}>← cantidad</span>
                  </div>
                  {m.lastPrice && m.custSel && !m.esReposicion && (
                    <div style={{ marginTop:5, padding:"5px 10px", background:"rgba(255,200,0,0.08)", border:"1px solid rgba(255,200,0,0.25)", borderRadius:5, fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ color:"rgba(255,200,0,0.8)" }}>⏱</span>
                      <span>Última venta a <strong style={{ color:"var(--text)" }}>{m.custSel.name}</strong>:</span>
                      <span style={{ color:"var(--accent)", fontWeight:700 }}>${Number(m.lastPrice.unit_price).toLocaleString("es-AR")}</span>
                      <span style={{ color:"var(--text-dim)" }}>el {new Date(m.lastPrice.created_at).toLocaleDateString("es-AR")}</span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", whiteSpace:"nowrap" }}>Descripción:</div>
                <input className="input" style={{ flex:1, fontSize:13, height:34 }} placeholder="Enter si no modifica"
                  value={m.itemDesc} onChange={(e) => m.setItemDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key==="Enter") m.confirmItem(); }} />
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                <div style={{ flex:2, minWidth:0 }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Código o descripción</div>
                  <ProductSearchBar priceType={m.priceType} onSelect={m.handleProdSelect} autoFocus={!m.prodSel} dropUp />
                </div>
                <div style={{ flex:"0 0 100px" }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Cantidad</div>
                  <input ref={m.qtyRef} className="input"
                    style={{ height:38, fontSize:14, fontFamily:"var(--font-mono)", textAlign:"center", width:"100%" }}
                    placeholder="0" value={m.itemQty} onChange={(e) => m.setItemQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key==="Enter") m.confirmItem(); }} />
                </div>
                <div style={{ flex:"0 0 110px" }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Precio</div>
                  <input className="input"
                    style={{ height:38, fontSize:14, fontFamily:"var(--font-mono)", color:"var(--accent)", fontWeight:700, width:"100%" }}
                    placeholder="0.00" value={m.itemPrice} onChange={(e) => m.setItemPrice(e.target.value)}
                    onKeyDown={(e) => { if (e.key==="Enter") m.confirmItem(); }} />
                </div>
                <button className="btn btn-primary" onClick={m.confirmItem}
                  style={{ height:38, fontSize:13, padding:"0 16px", flexShrink:0 }}>
                  + Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers cobranzas
// ─────────────────────────────────────────────────────────────
const METODOS_LABEL = ["Efectivo","Cheque","Depósito","Tarjeta","Mercpago"];

function SeccionCobranzas({ cobranzas, divisa }) {
  const filtered = cobranzas.filter((c) => (c.divisa_cobro ?? "ARS") === divisa);
  if (filtered.length === 0) return null;

  const titulo = divisa === "USD" ? "Cobranzas en DÓLARES" : "Cobranzas en PESOS";
  const fmtVal = (n) => divisa === "USD"
    ? `USD ${Number(n||0).toLocaleString("es-AR",{minimumFractionDigits:2})}`
    : `$${fmt(n)}`;
  const getMontoDisplay = (c) => Number(c.monto_original ?? c.monto ?? 0);

  const totalPorMetodo = METODOS_LABEL.reduce((acc, m) => {
    acc[m] = filtered.filter((c) => c.metodo_pago === m).reduce((a, c) => a + getMontoDisplay(c), 0);
    return acc;
  }, {});
  const total = filtered.reduce((a, c) => a + getMontoDisplay(c), 0);

  return (
    <div className="card" style={{ marginBottom:24 }}>
      <div className="card-header">
        <span className="card-title">{titulo}</span>
        <span className="badge badge-info">{filtered.length}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Cliente</th><th>Concepto</th>
              <th style={{ textAlign:"right" }}>Efectivo</th>
              <th style={{ textAlign:"right" }}>Cheque</th>
              <th style={{ textAlign:"right" }}>Depósito</th>
              <th style={{ textAlign:"right" }}>Tarjeta</th>
              <th style={{ textAlign:"right" }}>Mercpago</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const monto = getMontoDisplay(c);
              return (
                <tr key={c.id}>
                  <td style={{ fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(c.created_at)}</td>
                  <td>
                    <div style={{ fontSize:14, fontWeight:500 }}>{c.customer_name||"—"}</div>
                    {c.concepto && c.concepto !== "Cobranza" && (
                      <div style={{ fontSize:12, color:"var(--text-dim)" }}>{c.concepto}</div>
                    )}
                  </td>
                  <td style={{ fontSize:12, color:"var(--text-dim)", fontFamily:"var(--font-mono)" }}>
                    {c.order_id ? <span style={{ color:"var(--accent)" }}>{c.order_id.slice(-5)}</span> : "—"}
                  </td>
                  {METODOS_LABEL.map((met) => (
                    <td key={met} style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", fontSize:14 }}>
                      {c.metodo_pago === met ? fmtVal(monto) : ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ borderTop:"2px solid var(--border)", padding:"16px 20px", background:"var(--bg2)", display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
        {METODOS_LABEL.map((met) => {
          const t = totalPorMetodo[met];
          if (!t) return null;
          return (
            <div key={met} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 16px", textAlign:"center", minWidth:130 }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{met}</div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:800, color:"var(--accent)" }}>{fmtVal(t)}</div>
            </div>
          );
        })}
        <div style={{ marginLeft:"auto", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"10px 20px", textAlign:"center" }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Total {divisa}</div>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:22, fontWeight:800, color:"var(--accent)" }}>{fmtVal(total)}</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sección reposiciones (ARS o USD)
// ─────────────────────────────────────────────────────────────
function SeccionReposiciones({ reposiciones, divisa }) {
  const filtered = reposiciones.filter((r) => (r.divisa || "ARS") === divisa);
  if (filtered.length === 0) return null;

  const titulo = divisa === "USD" ? "Reposiciones en DÓLARES" : "Reposiciones en PESOS";
  const fmtVal = (n) => divisa === "USD" ? fmtUSD(n) : `$${fmt(n)}`;
  const total  = filtered.reduce((a, r) => a + Number(r.total || 0), 0);

  return (
    <div className="card" style={{ marginBottom:24 }}>
      <div className="card-header">
        <span className="card-title">{titulo}</span>
        <span className="badge badge-info">{filtered.length}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Proveedor</th><th>Depósito</th>
              <th>Vendedor</th><th style={{ textAlign:"right" }}>Total {divisa}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(r.created_at)}</td>
                <td style={{ fontSize:14 }}>{r.supplier_name || r.customer_name || "—"}</td>
                <td style={{ fontSize:13, color:"var(--text-muted)" }}>{r.warehouse_name || "—"}</td>
                <td style={{ fontSize:13, color:"var(--text-muted)" }}>{r.vendedor || "—"}</td>
                <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", fontSize:14 }}>
                  {fmtVal(r.total)}
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => printComprobantePDF({ ...r, tipo:"Reposicion" })}
                    title="Imprimir">🖨️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ borderTop:"2px solid var(--border)", padding:"14px 20px", background:"var(--bg2)", display:"flex", justifyContent:"flex-end" }}>
        <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"10px 20px", textAlign:"center" }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>
            Total Reposiciones {divisa}
          </div>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:20, fontWeight:800, color:"var(--accent)" }}>
            {fmtVal(total)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────
export default function CajaListado() {
  const [from, setFrom] = useState(today());
  const [to,   setTo]   = useState(today());
  const [loading, setLoading] = useState(false);

  const [presupuestos, setPresupuestos] = useState([]);
  const [reposiciones, setReposiciones] = useState([]);
  const [notasPedido,  setNotasPedido]  = useState([]);
  const [remitos,      setRemitos]      = useState([]);
  const [cashMovs,     setCashMovs]     = useState([]);
  const [cobranzas,    setCobranzas]    = useState([]);

  const { addToast, ToastContainer } = useToast();
  const { user } = useAuth();
  const vendedores = useVendedores();
  // Pasamos `user` al hook para que tenga warehouse_id al crear presupuesto
  const presModal  = usePresModal({ addToast, onSuccess: load, vendedores, user });

  async function load() {
    setLoading(true);
    try {
      const [listadoRes, cashRes, cobranzasRes] = await Promise.all([
        getListadoCaja(from, to),
        getCashMovements(from, to),
        getCobranzasCC(from, to),
      ]);

      const data = listadoRes.data;
      setPresupuestos(data.presupuestos  || []);
      setReposiciones(data.reposiciones  || []);
      setNotasPedido(data.notasPedido    || []);
      setRemitos(data.remitos            || []);
      setCashMovs(cashRes.data           || []);
      setCobranzas(cobranzasRes.data     || []);

    } catch { addToast("Error cargando listado", "error"); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Totales resumen de caja ───────────────────────────────────
  const METODOS_COLS = ["Efectivo","Cta Cte","Tarjeta","Por Banco","Mercado Pago","Cheques"];
  const metodoKey = (m) => {
    if (!m) return "Efectivo";
    const l = m.toLowerCase();
    if (l.includes("banco"))                           return "Por Banco";
    if (l.includes("tarjeta"))                         return "Tarjeta";
    if (l.includes("cta") || l.includes("corriente"))  return "Cta Cte";
    if (l.includes("mercado"))                         return "Mercado Pago";
    if (l.includes("cheque"))                          return "Cheques";
    return "Efectivo";
  };

  // ── Separar presupuestos por divisa ──────────────────────────
  const presARS = presupuestos.filter((p) => (p.divisa || "ARS") === "ARS");
  const presUSD = presupuestos.filter((p) => (p.divisa || "ARS") === "USD");

  // ── Separar cash movements manuales por divisa ────────────────
  const cashMovsManuales    = cashMovs.filter((mv) => !mv.reference_id);
  const cashMovsManualesARS = cashMovsManuales.filter((mv) => (mv.divisa || "ARS") === "ARS");
  const cashMovsManualesUSD = cashMovsManuales.filter((mv) => (mv.divisa || "ARS") === "USD");

  // ── Totales ARS ───────────────────────────────────────────────
  const ventasPorMetodo   = METODOS_COLS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
  const entradasPorMetodo = METODOS_COLS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
  const salidasPorMetodo  = METODOS_COLS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});

  presARS.forEach((p) => {
    const col = metodoKey(p.payment_method);
    ventasPorMetodo[col] = (ventasPorMetodo[col] || 0) + Number(p.total || 0);
  });

  cashMovsManualesARS.forEach((mv) => {
    const col = metodoKey(mv.source);
    if (mv.type === "ingreso") entradasPorMetodo[col] = (entradasPorMetodo[col] || 0) + Number(mv.amount || 0);
    else                       salidasPorMetodo[col]  = (salidasPorMetodo[col]  || 0) + Number(mv.amount || 0);
  });

  // ── Totales USD ───────────────────────────────────────────────
  const ventasUSDPorMetodo   = METODOS_COLS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
  const entradasUSDPorMetodo = METODOS_COLS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
  const salidasUSDPorMetodo  = METODOS_COLS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});

  presUSD.forEach((p) => {
    const col = metodoKey(p.payment_method);
    ventasUSDPorMetodo[col] = (ventasUSDPorMetodo[col] || 0) + Number(p.total || 0);
  });

  cashMovsManualesUSD.forEach((mv) => {
    const col = metodoKey(mv.source);
    if (mv.type === "ingreso") entradasUSDPorMetodo[col] = (entradasUSDPorMetodo[col] || 0) + Number(mv.amount || 0);
    else                       salidasUSDPorMetodo[col]  = (salidasUSDPorMetodo[col]  || 0) + Number(mv.amount || 0);
  });

  const METODOS_COBRANZA_MAP = {
    "Efectivo":"Efectivo","Cheque":"Cheques","Depósito":"Por Banco",
    "Tarjeta":"Tarjeta","Mercpago":"Mercado Pago",
  };

  const cobranzasARS = cobranzas.filter((c) => (c.divisa_cobro ?? "ARS") === "ARS");
  const cobranzasPorMetodo = METODOS_COLS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
  cobranzasARS.forEach((c) => {
    const col = METODOS_COBRANZA_MAP[c.metodo_pago] || "Efectivo";
    cobranzasPorMetodo[col] = (cobranzasPorMetodo[col] || 0) + Number(c.monto_original ?? c.monto ?? 0);
  });

  const cobranzasUSD = cobranzas.filter((c) => (c.divisa_cobro ?? "ARS") === "USD");
  const cobranzasUSDPorMetodo = METODOS_COLS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
  cobranzasUSD.forEach((c) => {
    const col = METODOS_COBRANZA_MAP[c.metodo_pago] || "Efectivo";
    cobranzasUSDPorMetodo[col] = (cobranzasUSDPorMetodo[col] || 0) + Number(c.monto_original ?? c.monto ?? 0);
  });

  const totalVentas       = Object.values(ventasPorMetodo).reduce((a, v) => a + v, 0);
  const totalEntradas     = Object.values(entradasPorMetodo).reduce((a, v) => a + v, 0);
  const totalSalidas      = Object.values(salidasPorMetodo).reduce((a, v) => a + v, 0);
  const totalCobranzasARS = cobranzasARS.reduce((a, c) => a + Number(c.monto_original ?? c.monto ?? 0), 0);
  const totalCobranzasUSD = cobranzasUSD.reduce((a, c) => a + Number(c.monto_original ?? c.monto ?? 0), 0);
  const totalPres         = presupuestos.reduce((a, p) => a + Number(p.total || 0), 0);

  const totalVentasUSD    = Object.values(ventasUSDPorMetodo).reduce((a, v) => a + v, 0);
  const totalEntradasUSD  = Object.values(entradasUSDPorMetodo).reduce((a, v) => a + v, 0);
  const totalSalidasUSD   = Object.values(salidasUSDPorMetodo).reduce((a, v) => a + v, 0);

  // Hay datos USD si alguna de estas cosas tiene valores
  const hayDatosUSD = cobranzasUSD.length > 0 || presUSD.length > 0 || cashMovsManualesUSD.length > 0;

  const handleDeleteNota = async (id) => {
    if (!confirm("¿Eliminar esta nota de pedido? Se liberará el stock en reserva.")) return;
    try {
      await deleteComprobante(id);
      setNotasPedido((prev) => prev.filter((n) => n.id !== id));
      addToast("Eliminado", "success");
    } catch { addToast("Error eliminando", "error"); }
  };

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <>
      <ToastContainer />
      <PresModal m={presModal} />

      {/* Filtros */}
      <div style={{ display:"flex", gap:10, marginBottom:24, alignItems:"center", flexWrap:"wrap" }}>
        <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>DESDE</span>
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width:140 }} />
        <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>HASTA</span>
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width:140 }} />
        <button className="btn btn-ghost" onClick={load}>Filtrar</button>
      </div>

      {loading ? (
        <>
          <SkeletonCard title="Presupuestos"  rows={4} cols={6} />
          <SkeletonCard title="Reposiciones"  rows={3} cols={5} />
          <SkeletonCard title="Reservas"      rows={3} cols={4} />
          <SkeletonCard title="Cobranzas"     rows={3} cols={8} />
          <SkeletonCard title="Remitos"       rows={3} cols={5} />
        </>
      ) : (
        <>
          {/* ── PRESUPUESTOS EN PESOS ── */}
          {presARS.length > 0 && (
            <div className="card" style={{ marginBottom:24 }}>
              <div className="card-header">
                <span className="card-title">Presupuestos en PESOS</span>
                <span className="badge badge-info">{presARS.length}</span>
                <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", padding:"2px 8px", background:"var(--bg3)", borderRadius:4, border:"1px solid var(--border)" }}>🪙 ARS</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th><th>Fecha</th><th>Cliente</th>
                      <th>Vendedor</th><th>Método de pago</th>
                      <th style={{ textAlign:"right" }}>Total ARS</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {presARS.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span className="badge badge-accent" style={{
                            background: p.tipo==="Presupuesto Web" ? "rgba(100,200,100,0.15)" : undefined,
                            color:      p.tipo==="Presupuesto Web" ? "var(--success)"         : undefined,
                            border:     p.tipo==="Presupuesto Web" ? "1px solid var(--success)":undefined,
                          }}>
                            {p.tipo||"Presupuesto"}
                          </span>
                        </td>
                        <td style={{ fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(p.created_at)}</td>
                        <td style={{ fontSize:14 }}>{p.customer_name||"—"}</td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>{p.vendedor||"—"}</td>
                        <td>
                          <span style={{ fontSize:12, fontFamily:"var(--font-mono)", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:4, padding:"2px 8px" }}>
                            {p.payment_method||"—"}
                          </span>
                        </td>
                        <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", fontSize:14 }}>
                          ${fmt(p.total)}
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => printComprobantePDF(p)} title="Imprimir">🖨️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ borderTop:"2px solid var(--border)", padding:"16px 20px", background:"var(--bg2)" }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>
                  Facturación por método de pago
                </div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
                  {Object.entries(
                    presARS.reduce((acc, p) => {
                      const met = p.payment_method || "Sin método";
                      acc[met] = (acc[met] || 0) + Number(p.total || 0);
                      return acc;
                    }, {})
                  ).map(([met, total]) => (
                    <div key={met} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 16px", textAlign:"center", minWidth:140 }}>
                      <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{met}</div>
                      <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:800, color:"var(--accent)" }}>${fmt(total)}</div>
                    </div>
                  ))}
                  <div style={{ marginLeft:"auto", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"10px 20px", textAlign:"center" }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Total ARS</div>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:22, fontWeight:800, color:"var(--accent)" }}>${fmt(presARS.reduce((a,p) => a + Number(p.total||0), 0))}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PRESUPUESTOS EN DÓLARES ── */}
          {presUSD.length > 0 && (
            <div className="card" style={{ marginBottom:24 }}>
              <div className="card-header">
                <span className="card-title">Presupuestos en DÓLARES</span>
                <span className="badge badge-info">{presUSD.length}</span>
                <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--success)", padding:"2px 8px", background:"rgba(52,211,153,0.1)", borderRadius:4, border:"1px solid var(--success)" }}>💵 USD</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th><th>Fecha</th><th>Cliente</th>
                      <th>Vendedor</th><th>Método de pago</th>
                      <th style={{ textAlign:"right" }}>Total USD</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {presUSD.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span className="badge badge-accent" style={{
                            background: p.tipo==="Presupuesto Web" ? "rgba(100,200,100,0.15)" : undefined,
                            color:      p.tipo==="Presupuesto Web" ? "var(--success)"         : undefined,
                            border:     p.tipo==="Presupuesto Web" ? "1px solid var(--success)":undefined,
                          }}>
                            {p.tipo||"Presupuesto"}
                          </span>
                        </td>
                        <td style={{ fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(p.created_at)}</td>
                        <td style={{ fontSize:14 }}>{p.customer_name||"—"}</td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>{p.vendedor||"—"}</td>
                        <td>
                          <span style={{ fontSize:12, fontFamily:"var(--font-mono)", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:4, padding:"2px 8px" }}>
                            {p.payment_method||"—"}
                          </span>
                        </td>
                        <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--success)", fontSize:14 }}>
                          {fmtUSD(p.total)}
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => printComprobantePDF(p)} title="Imprimir">🖨️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ borderTop:"2px solid var(--border)", padding:"16px 20px", background:"var(--bg2)" }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>
                  Facturación por método de pago
                </div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
                  {Object.entries(
                    presUSD.reduce((acc, p) => {
                      const met = p.payment_method || "Sin método";
                      acc[met] = (acc[met] || 0) + Number(p.total || 0);
                      return acc;
                    }, {})
                  ).map(([met, total]) => (
                    <div key={met} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 16px", textAlign:"center", minWidth:140 }}>
                      <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{met}</div>
                      <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:800, color:"var(--success)" }}>{fmtUSD(total)}</div>
                    </div>
                  ))}
                  <div style={{ marginLeft:"auto", background:"rgba(52,211,153,0.1)", border:"1px solid var(--success)", borderRadius:6, padding:"10px 20px", textAlign:"center" }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--success)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Total USD</div>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:22, fontWeight:800, color:"var(--success)" }}>{fmtUSD(presUSD.reduce((a,p) => a + Number(p.total||0), 0))}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── REPOSICIONES ARS ── */}
          <SeccionReposiciones reposiciones={reposiciones} divisa="ARS" />

          {/* ── REPOSICIONES USD ── */}
          <SeccionReposiciones reposiciones={reposiciones} divisa="USD" />

          {/* ── RESERVAS — siempre todas, sin filtro de fecha ── */}
          {notasPedido.length > 0 && (
            <div className="card" style={{ marginBottom:24 }}>
              <div className="card-header">
                <span className="card-title">Reservas (Notas de Pedido)</span>
                <span className="badge badge-info">{notasPedido.length}</span>
                <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", padding:"2px 8px", background:"var(--bg3)", borderRadius:4, border:"1px solid var(--border)" }}>
                  Todas — sin filtro de fecha
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th><th>Fecha</th><th>Cliente</th>
                      <th style={{ textAlign:"right" }}>Importe</th><th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notasPedido.map((n) => (
                      <tr key={n.id}>
                        <td>
                          <span className="badge badge-accent" style={{
                            background: n.tipo==="Nota de Pedido Web" ? "rgba(100,200,100,0.15)" : undefined,
                            color:      n.tipo==="Nota de Pedido Web" ? "var(--success)"         : undefined,
                            border:     n.tipo==="Nota de Pedido Web" ? "1px solid var(--success)":undefined,
                          }}>
                            {n.tipo === "Nota de Pedido Web" ? "Web" : "Manual"}
                          </span>
                        </td>
                        <td style={{ fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(n.created_at)}</td>
                        <td style={{ fontSize:14 }}>{n.customer_name||"—"}</td>
                        <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", fontSize:14 }}>
                          ${fmt(n.total)}
                        </td>
                        <td>
                          <div style={{ display:"flex", gap:6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => printComprobantePDF(n)} title="Imprimir">🖨️</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => presModal.openFor(n)}>→ Presupuesto</button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteNota(n.id)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── COBRANZAS EN PESOS ── */}
          <SeccionCobranzas cobranzas={cobranzas} divisa="ARS" />

          {/* ── COBRANZAS EN DÓLARES ── */}
          <SeccionCobranzas cobranzas={cobranzas} divisa="USD" />

          {/* ── REMITOS ── */}
          {remitos.length > 0 && (
            <div className="card" style={{ marginBottom:24 }}>
              <div className="card-header">
                <span className="card-title">Remitos</span>
                <span className="badge badge-info">{remitos.length}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Origen</th><th>Destino</th><th>Vendedor</th><th style={{ textAlign:"right" }}>Importe</th><th></th></tr>
                  </thead>
                  <tbody>
                    {remitos.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(r.created_at)}</td>
                        <td style={{ fontSize:13 }}>{r.origen||"—"}</td>
                        <td style={{ fontSize:13 }}>{r.destino||"—"}</td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>{r.vendedor||"—"}</td>
                        <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", fontSize:14 }}>
                          ${fmt(r.total)}
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => printComprobantePDF({...r, tipo:"Remito"})}>🖨️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── RESUMEN DE CAJA (ARS) ── */}
          {(() => {
            const efectivoResultante =
              (ventasPorMetodo["Efectivo"]    || 0)
            + (cobranzasPorMetodo["Efectivo"] || 0)
            + (entradasPorMetodo["Efectivo"]  || 0)
            - (salidasPorMetodo["Efectivo"]   || 0);

            const thStyle = { padding:"10px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em" };
            const tdVal   = (val, color) => ({ padding:"11px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:13, color: val ? color||"var(--text)" : "var(--text-dim)" });
            const tdLabel = { padding:"11px 16px", fontWeight:700, fontSize:13, color:"var(--text)", whiteSpace:"nowrap" };
            const rows = [
              { label:"Total ventas",      data:ventasPorMetodo,    color:"var(--text)",    sign:"",  total:totalVentas,       totalColor:"var(--accent)"  },
              { label:"Total Cobranzas",   data:cobranzasPorMetodo, color:"var(--success)", sign:"",  total:totalCobranzasARS, totalColor:"var(--success)" },
              { label:"Salidas por Caja",  data:salidasPorMetodo,   color:"var(--danger)",  sign:"-", total:totalSalidas,      totalColor:"var(--danger)"  },
              { label:"Entradas por Caja", data:entradasPorMetodo,  color:"var(--success)", sign:"",  total:totalEntradas,     totalColor:"var(--success)" },
            ];

            return (
              <div className="card" style={{ marginTop:24 }}>
                <div className="card-header">
                  <span className="card-title">Resumen de Caja</span>
                  <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", padding:"2px 8px", background:"var(--bg3)", borderRadius:4, border:"1px solid var(--border)" }}>
                    🪙 ARS
                  </span>
                  <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-dim)" }}>
                    {from===to ? from : `${from} al ${to}`}
                  </span>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr style={{ background:"var(--bg3)", borderBottom:"2px solid var(--border)" }}>
                        <th style={{ padding:"10px 16px", textAlign:"left", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", minWidth:180 }}></th>
                        {METODOS_COLS.map((m) => <th key={m} style={thStyle}>{m}</th>)}
                        <th style={{ ...thStyle, color:"var(--accent)" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ label, data, color, sign, total, totalColor }) => (
                        <tr key={label} style={{ borderBottom:"1px solid var(--border)" }}>
                          <td style={tdLabel}>{label}</td>
                          {METODOS_COLS.map((m) => (
                            <td key={m} style={tdVal(data[m], color)}>
                              {data[m] ? `${sign}$${fmt(data[m])}` : "—"}
                            </td>
                          ))}
                          <td style={{ padding:"11px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:totalColor }}>
                            {sign}${fmt(total)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background:"var(--bg3)", borderTop:"2px solid var(--border)" }}>
                        <td style={{ ...tdLabel, color:"var(--accent)", fontSize:14 }}>Efectivo Resultante</td>
                        <td style={{ padding:"13px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:800, fontSize:16, color: efectivoResultante>=0 ? "var(--success)" : "var(--danger)" }}>
                          ${fmt(efectivoResultante)}
                        </td>
                        {METODOS_COLS.slice(1).map((m) => <td key={m} />)}
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ── RESUMEN DE CAJA (USD) ── */}
          {hayDatosUSD && (() => {
            const efectivoResultanteUSD =
              (ventasUSDPorMetodo["Efectivo"]    || 0)
            + (cobranzasUSDPorMetodo["Efectivo"] || 0)
            + (entradasUSDPorMetodo["Efectivo"]  || 0)
            - (salidasUSDPorMetodo["Efectivo"]   || 0);

            const thStyle = { padding:"10px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em" };
            const tdVal   = (val, color) => ({ padding:"11px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:13, color: val ? color||"var(--text)" : "var(--text-dim)" });
            const tdLabel = { padding:"11px 16px", fontWeight:700, fontSize:13, color:"var(--text)", whiteSpace:"nowrap" };
            const rows = [
              { label:"Total ventas",      data:ventasUSDPorMetodo,    color:"var(--text)",    sign:"",  total:totalVentasUSD,   totalColor:"var(--accent)"  },
              { label:"Total Cobranzas",   data:cobranzasUSDPorMetodo, color:"var(--success)", sign:"",  total:totalCobranzasUSD, totalColor:"var(--success)" },
              { label:"Salidas por Caja",  data:salidasUSDPorMetodo,   color:"var(--danger)",  sign:"-", total:totalSalidasUSD,  totalColor:"var(--danger)"  },
              { label:"Entradas por Caja", data:entradasUSDPorMetodo,  color:"var(--success)", sign:"",  total:totalEntradasUSD, totalColor:"var(--success)" },
            ];
            return (
              <div className="card" style={{ marginTop:16 }}>
                <div className="card-header">
                  <span className="card-title">Resumen de Caja</span>
                  <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--success)", padding:"2px 8px", background:"rgba(52,211,153,0.1)", borderRadius:4, border:"1px solid var(--success)" }}>
                    💵 USD
                  </span>
                  <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-dim)" }}>
                    {from===to ? from : `${from} al ${to}`}
                  </span>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr style={{ background:"var(--bg3)", borderBottom:"2px solid var(--border)" }}>
                        <th style={{ padding:"10px 16px", textAlign:"left", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", minWidth:180 }}></th>
                        {METODOS_COLS.map((m) => <th key={m} style={thStyle}>{m}</th>)}
                        <th style={{ ...thStyle, color:"var(--success)" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ label, data, color, sign, total, totalColor }) => (
                        <tr key={label} style={{ borderBottom:"1px solid var(--border)" }}>
                          <td style={tdLabel}>{label}</td>
                          {METODOS_COLS.map((m) => (
                            <td key={m} style={tdVal(data[m], color)}>
                              {data[m] ? `${sign}${fmtUSD(data[m])}` : "—"}
                            </td>
                          ))}
                          <td style={{ padding:"11px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:totalColor }}>
                            {sign}{fmtUSD(total)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background:"var(--bg3)", borderTop:"2px solid var(--border)" }}>
                        <td style={{ ...tdLabel, color:"var(--success)", fontSize:14 }}>Efectivo Resultante</td>
                        <td style={{ padding:"13px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:800, fontSize:16, color: efectivoResultanteUSD>=0 ? "var(--success)" : "var(--danger)" }}>
                          {fmtUSD(efectivoResultanteUSD)}
                        </td>
                        {METODOS_COLS.slice(1).map((m) => <td key={m} />)}
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </>
  );
}
