import { useState, useEffect, useRef } from "react";
import {
  getComprobantes, getComprobante, createComprobante, deleteComprobante,
  searchCustomers,
} from "../utils/api";
import { useToast } from "../utils/useToast";
import { useVendedores } from "../utils/useVendedores";
import ProductSearchBar from "../components/ProductSearchBar";

const TIPOS      = ["Presupuesto","Devolucion","Nota de Pedido","Reposicion","Devol a proveedo"];
const PAGOS      = ["Contado","Cta Cte","Tarjeta","Banco","Mercado Pago","Cheque"];
const PRECIOS    = ["precio_1","precio_2","precio_3","precio_4","precio_5","costo"];
const ESCENARIOS = ["Escenario","Escenario A","Escenario B","Escenario C"];
const PRECIO_LBL = {
  precio_1:"Precio #1", precio_2:"Precio #2", precio_3:"Precio #3",
  precio_4:"Precio #4", precio_5:"Precio #5", costo:"Precio Costo",
};

const extractPrice = (product, priceType) => {
  const prices = product?.prices || product?.product_prices || [];
  const found  = prices.find((p) => p.price_type === priceType);
  return found ? Number(found.price) : 0;
};

export default function Comprobantes() {
  const vendedores = useVendedores();
  const [comprobantes, setComprobantes] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [creating,     setCreating]     = useState(false);
  const today = () => new Date().toISOString().slice(0, 10);
  const [from,        setFrom]        = useState(today());
  const [to,          setTo]          = useState(today());
  const [appliedFrom, setAppliedFrom] = useState(today());
  const [appliedTo,   setAppliedTo]   = useState(today());
  const filterDirty = from !== appliedFrom || to !== appliedTo;

  // Form
  const [tipo,       setTipo]       = useState("Presupuesto");
  const [payMethod,  setPayMethod]  = useState("Contado");
  const [priceType,  setPriceType]  = useState("precio_1");
  const [vendedor,   setVendedor]   = useState("");
  const [textoLibre, setTextoLibre] = useState("");
  const [escenario,  setEscenario]  = useState("Escenario");
  const [fecha,      setFecha]      = useState(new Date().toISOString().slice(0,10));

  // Cliente
  const [custQuery,   setCustQuery]   = useState("");
  const [custResults, setCustResults] = useState([]);
  const [custSel,     setCustSel]     = useState(null);

  // Items
  const [items,        setItems]        = useState([]);
  const [prodSel,      setProdSel]      = useState(null);
  const [itemQty,      setItemQty]      = useState("");
  const [itemPrice,    setItemPrice]    = useState("");
  const [itemDesc,     setItemDesc]     = useState("");
  const [saving,       setSaving]       = useState(false);

  const qtyRef = useRef(null);
  const { addToast, ToastContainer } = useToast();

  const loadAll = async (f = appliedFrom, t = appliedTo) => {
    setLoading(true);
    try { const { data } = await getComprobantes(f, t); setComprobantes(data); }
    catch { addToast("Error cargando comprobantes", "error"); }
    setLoading(false);
  };

  const applyFilter = () => {
    setAppliedFrom(from);
    setAppliedTo(to);
    loadAll(from, to);
  };

  useEffect(() => { loadAll(today(), today()); }, []);

  useEffect(() => {
    if (!custQuery.trim()) { setCustResults([]); return; }
    const t = setTimeout(async () => {
      try { const { data } = await searchCustomers(custQuery); setCustResults(data); }
      catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [custQuery]);

  useEffect(() => {
    if (prodSel) {
      const prices = prodSel?.prices || prodSel?.product_prices || [];
      const found  = prices.find((p) => p.price_type === priceType);
      setItemPrice(found ? String(Number(found.price)) : "");
    }
  }, [priceType, prodSel]);

  const selectCust = (c) => { setCustSel(c); setCustQuery(""); setCustResults([]); };

  const handleProdSelect = ({ product, price }) => {
    setProdSel(product);
    setItemDesc(product.name);
    setItemPrice(price > 0 ? String(price) : "");
    setTimeout(() => qtyRef.current?.focus(), 50);
  };

  const confirmItem = () => {
    if (!prodSel) { addToast("Seleccioná un producto", "error"); return; }
    if (!itemQty || Number(itemQty) <= 0) { addToast("Ingresá una cantidad válida", "error"); return; }
    setItems((prev) => [...prev, {
      product_id: prodSel.id,
      code:       prodSel.code || "",
      name:       prodSel.name,
      description:itemDesc || prodSel.name,
      quantity:   Number(itemQty),
      unit_price: Number(itemPrice) || 0,
    }]);
    setProdSel(null);
    setItemQty("");
    setItemPrice("");
    setItemDesc("");
  };

  const handleQtyKeyDown = (e) => {
    if (e.key === "Enter") confirmItem();
  };

  const removeItem = (i) => setItems((prev) => prev.filter((_,idx) => idx !== i));

  const total = items.reduce((a, it) => a + it.quantity * it.unit_price, 0);

  const handleCreate = async () => {
    if (!custSel)          { addToast("Seleccioná un cliente", "error"); return; }
    if (items.length === 0){ addToast("Agregá al menos un producto", "error"); return; }
    setSaving(true);
    try {
      await createComprobante({
        customer_id:    custSel.id,
        user_id:        null,
        payment_method: payMethod,
        tipo, vendedor, price_type: priceType,
        texto_libre: textoLibre, escenario,
        items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Comprobante creado", "success");
      setCreating(false); resetForm(); loadAll(appliedFrom, appliedTo);
    } catch { addToast("Error creando comprobante", "error"); }
    setSaving(false);
  };

  const resetForm = () => {
    setTipo("Presupuesto"); setPayMethod("Contado"); setPriceType("precio_1");
    setVendedor(""); setTextoLibre(""); setEscenario("Escenario");
    setCustSel(null); setCustQuery(""); setItems([]);
    setProdSel(null); setItemQty(""); setItemPrice(""); setItemDesc("");
    setFecha(new Date().toISOString().slice(0,10));
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este comprobante?")) return;
    try { await deleteComprobante(id); addToast("Eliminado", "success"); loadAll(); }
    catch { addToast("Error eliminando", "error"); }
  };

  const openDetail = async (id) => {
    try { const { data } = await getComprobante(id); setSelected(data); }
    catch { addToast("Error cargando", "error"); }
  };

  // ─────────────────────────────────────────
  return (
    <>
      <ToastContainer />

      {!creating ? (
        /* ── LISTADO ── */
        <>
          <div style={{ display:"flex", gap:10, marginBottom:24, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontSize:13, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>DESDE</span>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width:150 }} />
              <span style={{ fontSize:13, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>HASTA</span>
              <input className="input" type="date" value={to}   onChange={(e) => setTo(e.target.value)}   style={{ width:150 }} />
              {filterDirty && (
                <button className="btn btn-primary btn-sm" onClick={applyFilter}>Filtrar</button>
              )}
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
                    <tr><th>Tipo</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Pago</th><th>Estado</th><th>Fecha</th><th></th></tr>
                  </thead>
                  <tbody>
                    {comprobantes.map((c) => (
                      <tr key={c.id}>
                        <td><span className="badge badge-accent">{c.tipo || "Presupuesto"}</span></td>
                        <td style={{ fontSize:14 }}>{c.customer_name || "—"}</td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>{c.vendedor || "—"}</td>
                        <td style={{ fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", fontSize:14 }}>
                          ${Number(c.total||0).toLocaleString("es-AR")}
                        </td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>{c.payment_method || "—"}</td>
                        <td><span className="badge badge-success">{c.status}</span></td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR") : "—"}
                        </td>
                        <td>
                          <div style={{ display:"flex", gap:6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openDetail(c.id)}>Ver</button>
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

          {selected && (
            <div className="modal-overlay" onClick={() => setSelected(null)}>
              <div className="modal" style={{ maxWidth:560 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title">{selected.tipo || "Comprobante"} — {selected.id?.slice(0,8)}…</span>
                  <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                </div>
                <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
                  <span className="badge badge-success">{selected.status}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:14, color:"var(--accent)", fontWeight:700 }}>
                    Total: ${Number(selected.total||0).toLocaleString("es-AR")}
                  </span>
                  {selected.vendedor    && <span style={{ fontSize:13, color:"var(--text-muted)" }}>Vendedor: {selected.vendedor}</span>}
                  {selected.price_type  && <span style={{ fontSize:13, color:"var(--text-muted)" }}>{PRECIO_LBL[selected.price_type]}</span>}
                </div>
                {selected.texto_libre && (
                  <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 14px", marginBottom:14, fontSize:13, color:"var(--text-muted)" }}>
                    {selected.texto_libre}
                  </div>
                )}
                {selected.items?.length > 0 ? (
                  <div className="items-list">
                    {selected.items.map((it, i) => (
                      <div key={i} className="item-row">
                        <span className="item-name">{it.product_name || it.product_code || it.product_id}</span>
                        <span className="item-qty">×{it.quantity}</span>
                        <span className="item-price">${Number(it.unit_price).toLocaleString("es-AR")}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty">Sin items</div>}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── NUEVO COMPROBANTE ── */
        <div style={{ display:"flex", height:"calc(100vh - 56px)", margin:"-28px", overflow:"hidden" }}>

          {/* ── Columna izquierda: config ── */}
          <div style={{ width:280, flexShrink:0, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", background:"var(--bg2)", overflow:"hidden" }}>

            {/* Tipo de comprobante */}
            <div style={{ padding:"20px 18px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:11, fontWeight:700, color:"var(--accent)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14 }}>
                Nuevo Comprobante
              </div>
              {TIPOS.map((t) => (
                <div key={t} onClick={() => setTipo(t)}
                  style={{ padding:"9px 12px", borderRadius:4, cursor:"pointer", marginBottom:3, fontSize:14,
                    background: tipo===t ? "var(--accent-dim)" : "transparent",
                    color:      tipo===t ? "var(--accent)"     : "var(--text-muted)",
                    borderLeft: `3px solid ${tipo===t ? "var(--accent)" : "transparent"}`,
                    fontWeight: tipo===t ? 600 : 400,
                  }}>{t}</div>
              ))}
              <div style={{ marginTop:12, padding:"8px 12px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:4, fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-dim)" }}>
                Pasteur 280 · Local 11
              </div>
            </div>

            {/* Cliente */}
            <div style={{ padding:"16px 18px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Cliente</div>
              {custSel ? (
                <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600 }}>{custSel.name}</span>
                  <button onClick={() => setCustSel(null)} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:16 }}>✕</button>
                </div>
              ) : (
                <>
                  <div className="search-bar">
                    <span className="search-icon">🔍</span>
                    <input placeholder="Nombre o CUIT..." value={custQuery} onChange={(e) => setCustQuery(e.target.value)} style={{ fontSize:13 }} />
                  </div>
                  {custResults.length > 0 && (
                    <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, maxHeight:150, overflowY:"auto", marginTop:6 }}>
                      {custResults.map((c) => (
                        <div key={c.id} onClick={() => selectCust(c)}
                          style={{ padding:"9px 12px", fontSize:13, cursor:"pointer", borderBottom:"1px solid var(--border)", color:"var(--text)" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg2)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          {c.name}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Configuración: scroll interno */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", borderBottom:"1px solid var(--border)" }}>
              <div className="input-group">
                <label className="input-label">Método de pago</label>
                <select className="select" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={{ fontSize:13 }}>
                  {PAGOS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Tipo de precio</label>
                <div style={{ display:"flex", flexDirection:"column", gap:4, border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", background:"var(--bg3)" }}>
                  {PRECIOS.map((p) => (
                    <div key={p} onClick={() => setPriceType(p)}
                      style={{ padding:"8px 12px", fontSize:13, cursor:"pointer",
                        background: priceType===p ? "var(--accent-dim)" : "transparent",
                        color:      priceType===p ? "var(--accent)"     : "var(--text-muted)",
                        borderLeft: `3px solid ${priceType===p ? "var(--accent)" : "transparent"}`,
                        borderBottom:"1px solid var(--border)",
                        fontWeight: priceType===p ? 600 : 400,
                      }}>
                      {PRECIO_LBL[p]}
                    </div>
                  ))}
                </div>
              </div>

              <div className="input-group" style={{ marginTop:12 }}>
                <label className="input-label">Vendedor</label>
                <select className="select" value={vendedor} onChange={(e) => setVendedor(e.target.value)} style={{ fontSize:13 }}>
                  <option value="">— seleccionar —</option>
                  {vendedores.map((v) => <option key={v.id} value={v.nombre}>{v.nombre}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Escenario</label>
                <select className="select" value={escenario} onChange={(e) => setEscenario(e.target.value)} style={{ fontSize:13 }}>
                  {ESCENARIOS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Fecha</label>
                <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ fontSize:13 }} />
              </div>
              <div className="input-group">
                <label className="input-label">Texto libre</label>
                <input className="input" value={textoLibre} onChange={(e) => setTextoLibre(e.target.value)} placeholder="Observaciones..." style={{ fontSize:13 }} />
              </div>
            </div>

            {/* Botones — siempre visibles al fondo */}
            <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:10, flexShrink:0 }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}
                style={{ width:"100%", fontSize:14, padding:"12px" }}>
                {saving ? "Guardando..." : "✓ Cerrar comprobante"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setCreating(false); resetForm(); }}
                style={{ width:"100%", fontSize:14 }}>
                Cancelar
              </button>
            </div>
          </div>

          {/* ── Panel central: items ── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--bg)" }}>

            {/* Lista de items — ocupa el espacio disponible */}
            <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
              {items.length === 0 ? (
                <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text-dim)", gap:14 }}>
                  <span style={{ fontSize:52 }}>🧾</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:13 }}>Buscá un producto abajo para agregar</span>
                </div>
              ) : (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 80px 120px 36px", gap:12, padding:"0 0 10px", borderBottom:"2px solid var(--border)", marginBottom:4 }}>
                    {["Código","Descripción","Cant.","Total",""].map((h) => (
                      <div key={h} style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</div>
                    ))}
                  </div>
                  {items.map((it, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"90px 1fr 80px 120px 36px", gap:12, padding:"13px 0", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent)" }}>{it.code || "—"}</span>
                      <span style={{ fontSize:14 }}>{it.description || it.name}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--text-muted)", textAlign:"right" }}>×{it.quantity}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, color:"var(--accent)", textAlign:"right" }}>
                        ${(it.quantity * it.unit_price).toLocaleString("es-AR")}
                      </span>
                      <button onClick={() => removeItem(i)}
                        style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", fontSize:18, textAlign:"center" }}>✕</button>
                    </div>
                  ))}
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:24, paddingTop:16, borderTop:"2px solid var(--border)" }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Total</div>
                      <div style={{ fontSize:32, fontFamily:"var(--font-mono)", fontWeight:800, color:"var(--accent)" }}>
                        ${total.toLocaleString("es-AR")}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Barra de ingreso — altura fija, dropdown abre hacia ARRIBA ── */}
            <div style={{ borderTop:"2px solid var(--border)", background:"var(--bg2)", padding:"14px 28px 16px", flexShrink:0 }}>

              {/* Chip del producto seleccionado */}
              {prodSel && (
                <div style={{ marginBottom:10, padding:"9px 14px", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent)", fontWeight:700 }}>{prodSel.code}</span>
                  <span style={{ fontSize:14, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{prodSel.name}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent)", fontWeight:700, flexShrink:0 }}>
                    ${Number(itemPrice||0).toLocaleString("es-AR")}
                  </span>
                  <span style={{ fontSize:12, color:"var(--text-dim)", flexShrink:0 }}>← ingresá cantidad</span>
                </div>
              )}

              {/* Descripción */}
              <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap" }}>Descripción:</div>
                <input
                  className="input"
                  style={{ flex:1, fontSize:14, height:36 }}
                  placeholder="Enter si no modifica"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmItem(); }}
                />
              </div>

              {/* Fila principal: búsqueda + cantidad + precio + botón */}
              <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
                <div style={{ flex:2, minWidth:0 }}>
                  <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Código o descripción</div>
                  {/* dropUp=true: el dropdown se abre hacia arriba */}
                  <ProductSearchBar
                    priceType={priceType}
                    onSelect={handleProdSelect}
                    autoFocus={!prodSel}
                    dropUp
                  />
                </div>
                <div style={{ flex:"0 0 110px" }}>
                  <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Cantidad</div>
                  <input
                    ref={qtyRef}
                    className="input"
                    style={{ height:40, fontSize:16, fontFamily:"var(--font-mono)", textAlign:"center", width:"100%" }}
                    placeholder="0"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    onKeyDown={handleQtyKeyDown}
                  />
                </div>
                <div style={{ flex:"0 0 130px" }}>
                  <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>
                    {PRECIO_LBL[priceType]}
                  </div>
                  <input
                    className="input"
                    style={{ height:40, fontSize:16, fontFamily:"var(--font-mono)", color:"var(--accent)", fontWeight:700, width:"100%" }}
                    placeholder="0.00"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    onKeyDown={handleQtyKeyDown}
                  />
                </div>
                <button className="btn btn-primary"
                  onClick={confirmItem}
                  style={{ height:40, fontSize:14, padding:"0 20px", flexShrink:0 }}>
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
