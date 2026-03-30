import { useState, useEffect, useRef } from "react";
import { searchCustomers, createComprobante, deleteComprobante, getListadoCaja, getCashMovements } from "../utils/api";
import { useToast } from "../utils/useToast";
import { useVendedores } from "../utils/useVendedores";
import ProductSearchBar from "../components/ProductSearchBar";

const PAGOS      = ["Contado","Cta Cte","Tarjeta","Banco","Mercado Pago","Cheque"];
const PRECIOS    = ["precio_1","precio_2","precio_3","precio_4","precio_5","costo"];
const PRECIO_LBL = {
  precio_1:"Precio #1", precio_2:"Precio #2", precio_3:"Precio #3",
  precio_4:"Precio #4", precio_5:"Precio #5", costo:"Precio Costo",
};
const METODOS_PAGO = ["Efectivo","Cta Cte","Tarjeta","Banco","Mercado Pago","Cheque"];

const extractPrice = (product, priceType) => {
  const prices = product?.prices || product?.product_prices || [];
  const found  = prices.find((p) => p.price_type === priceType);
  return found ? Number(found.price) : 0;
};

const today   = () => new Date().toISOString().slice(0, 10);
const fmt     = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-AR") : "—";

// ── Mini hook para modal de presupuestar una nota de pedido ─────
function usePresModal({ addToast, onSuccess, vendedores = [] }) {
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

  const qtyRef = useRef(null);

  useEffect(() => {
    if (!open || !custQuery.trim()) { setCustRes([]); return; }
    const t = setTimeout(async () => {
      try { const { data } = await searchCustomers(custQuery); setCustRes(data); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [custQuery, open]);

  useEffect(() => {
    if (prodSel) {
      const prices = prodSel?.prices || prodSel?.product_prices || [];
      const found  = prices.find((p) => p.price_type === priceType);
      setItemPrice(found ? String(Number(found.price)) : "");
    }
  }, [priceType, prodSel]);

  const openFor = (order) => {
    setSource(order);
    const itemsPre = (order.items || []).map((i) => ({
      product_id: i.product_id || null,
      code: i.code || "",
      name: i.name || i.description || "",
      description: i.name || i.description || "",
      quantity: i.quantity,
      unit_price: Number(i.unit_price || 0),
    }));
    setItems(itemsPre);
    setCustSel(order.customer_id ? { id: order.customer_id, name: order.customer_name } : null);
    setCustQuery(order.customer_name || "");
    setTipo("Presupuesto");
    setPayMethod("Contado");
    setPriceType("precio_1");
    setVendedor(order.vendedor || "");
    setTexto(order.texto_libre || "");
    setProdSel(null);
    setItemQty(""); setItemPrice(""); setItemDesc("");
    setOpen(true);
  };

  const selectCust = (c) => { setCustSel(c); setCustQuery(""); setCustRes([]); };

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
      code: prodSel.code || "",
      name: prodSel.name,
      description: itemDesc || prodSel.name,
      quantity: Number(itemQty),
      unit_price: Number(itemPrice) || 0,
    }]);
    setProdSel(null); setItemQty(""); setItemPrice(""); setItemDesc("");
  };

  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const totalCalc = items.reduce((a, it) => a + it.quantity * it.unit_price, 0);

  const handleCreate = async () => {
    if (!custSel)          { addToast("Seleccioná un cliente", "error"); return; }
    if (items.length === 0){ addToast("Agregá al menos un producto", "error"); return; }
    setSaving(true);
    try {
      await createComprobante({
        customer_id:    custSel.id,
        user_id:        null,
        payment_method: payMethod,
        tipo, vendedor, price_type: priceType, texto_libre: texto,
        items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Presupuesto creado", "success");
      setOpen(false);
      onSuccess && onSuccess();
    } catch { addToast("Error creando presupuesto", "error"); }
    setSaving(false);
  };

  return {
    open, setOpen, source, openFor,
    tipo, setTipo, payMethod, setPayMethod, priceType, setPriceType,
    vendedor, setVendedor, texto, setTexto,
    custSel, setCustSel, custQuery, setCustQuery, custRes, selectCust,
    items, removeItem, prodSel, handleProdSelect,
    itemQty, setItemQty, itemPrice, setItemPrice, itemDesc, setItemDesc,
    confirmItem, totalCalc, saving, handleCreate,
    qtyRef, vendedores,
  };
}

// ── Modal de presupuestar ──────────────────────────────────────
function PresModal({ m }) {
  if (!m.open) return null;
  return (
    <div className="modal-overlay" onClick={() => m.setOpen(false)}>
      <div
        className="modal"
        style={{ maxWidth:900, width:"96vw", maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink:0 }}>
          <span className="modal-title">🧾 Presupuestar — {m.source?.customer_name || "—"}</span>
          <button className="modal-close" onClick={() => m.setOpen(false)}>✕</button>
        </div>

        <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>

          {/* ── Columna izquierda ── */}
          <div style={{ width:240, flexShrink:0, borderRight:"1px solid var(--border)", background:"var(--bg2)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Tipo */}
            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Tipo de comprobante</div>
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

            {/* Cliente */}
            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Cliente</div>
              {m.custSel ? (
                <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600 }}>{m.custSel.name}</span>
                  <button onClick={() => m.setCustSel(null)} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:14 }}>✕</button>
                </div>
              ) : (
                <>
                  <div className="search-bar" style={{ height:36 }}>
                    <span className="search-icon">🔍</span>
                    <input placeholder="Nombre o CUIT..." value={m.custQuery}
                      onChange={(e) => m.setCustQuery(e.target.value)} style={{ fontSize:12 }} />
                  </div>
                  {m.custRes.length > 0 && (
                    <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, maxHeight:120, overflowY:"auto", marginTop:6 }}>
                      {m.custRes.map((c) => (
                        <div key={c.id} onClick={() => m.selectCust(c)}
                          style={{ padding:"8px 10px", fontSize:13, cursor:"pointer", borderBottom:"1px solid var(--border)" }}
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

            {/* Config — scroll interno */}
            <div style={{ padding:"12px 14px", flex:1, overflowY:"auto" }}>
              <div className="input-group">
                <label className="input-label">Método de pago</label>
                <select className="select" value={m.payMethod} onChange={(e) => m.setPayMethod(e.target.value)} style={{ fontSize:12 }}>
                  {PAGOS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Tipo de precio</label>
                <select className="select" value={m.priceType} onChange={(e) => m.setPriceType(e.target.value)} style={{ fontSize:12 }}>
                  {PRECIOS.map((p) => <option key={p} value={p}>{PRECIO_LBL[p]}</option>)}
                </select>
              </div>
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

            {/* Botones — siempre visibles al fondo */}
            <div style={{ padding:"12px 14px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
              <button className="btn btn-primary" onClick={m.handleCreate} disabled={m.saving}
                style={{ width:"100%", fontSize:13, padding:"10px" }}>
                {m.saving ? "Guardando..." : "✓ Cerrar presupuesto"}
              </button>
              <button className="btn btn-ghost" onClick={() => m.setOpen(false)} style={{ width:"100%", fontSize:13 }}>Cancelar</button>
            </div>
          </div>

          {/* ── Panel central: items ── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Lista de items */}
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
                  {m.items.map((it, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 70px 110px 30px", gap:10, padding:"10px 0", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)" }}>{it.code||"—"}</span>
                      <span style={{ fontSize:13 }}>{it.description||it.name}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)", textAlign:"right" }}>×{it.quantity}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color:"var(--accent)", textAlign:"right" }}>
                        ${(it.quantity * it.unit_price).toLocaleString("es-AR")}
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

            {/* ── Barra de ingreso — dropdown abre hacia ARRIBA ── */}
            <div style={{ borderTop:"2px solid var(--border)", background:"var(--bg2)", padding:"12px 20px 14px", flexShrink:0 }}>

              {/* Chip del producto seleccionado */}
              {m.prodSel && (
                <div style={{ marginBottom:8, padding:"8px 12px", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700 }}>{m.prodSel.code}</span>
                  <span style={{ fontSize:13, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.prodSel.name}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700, flexShrink:0 }}>
                    ${Number(m.itemPrice||0).toLocaleString("es-AR")}
                  </span>
                  <span style={{ fontSize:11, color:"var(--text-dim)", flexShrink:0 }}>← cantidad</span>
                </div>
              )}

              {/* Descripción */}
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", whiteSpace:"nowrap" }}>Descripción:</div>
                <input className="input" style={{ flex:1, fontSize:13, height:34 }} placeholder="Enter si no modifica"
                  value={m.itemDesc} onChange={(e) => m.setItemDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") m.confirmItem(); }} />
              </div>

              {/* Fila principal — ProductSearchBar con dropUp */}
              <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                <div style={{ flex:2, minWidth:0 }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Código o descripción</div>
                  <ProductSearchBar
                    priceType={m.priceType}
                    onSelect={m.handleProdSelect}
                    autoFocus={!m.prodSel}
                    dropUp
                  />
                </div>
                <div style={{ flex:"0 0 100px" }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Cantidad</div>
                  <input ref={m.qtyRef} className="input"
                    style={{ height:38, fontSize:14, fontFamily:"var(--font-mono)", textAlign:"center", width:"100%" }}
                    placeholder="0" value={m.itemQty}
                    onChange={(e) => m.setItemQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") m.confirmItem(); }} />
                </div>
                <div style={{ flex:"0 0 110px" }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Precio</div>
                  <input className="input"
                    style={{ height:38, fontSize:14, fontFamily:"var(--font-mono)", color:"var(--accent)", fontWeight:700, width:"100%" }}
                    placeholder="0.00" value={m.itemPrice}
                    onChange={(e) => m.setItemPrice(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") m.confirmItem(); }} />
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

// ── Componente principal ───────────────────────────────────────
export default function CajaListado() {
  const [from, setFrom] = useState(today());
  const [to,   setTo]   = useState(today());
  const [loading, setLoading] = useState(false);

  const [presupuestos, setPresupuestos] = useState([]);
  const [notasPedido,  setNotasPedido]  = useState([]);
  const [remitos,      setRemitos]      = useState([]);
  const [cashMovs,     setCashMovs]     = useState([]);

  const { addToast, ToastContainer } = useToast();
  const vendedores = useVendedores();

  const presModal = usePresModal({ addToast, onSuccess: load, vendedores });

  async function load() {
    setLoading(true);
    try {
      const [{ data }, cashRes] = await Promise.all([
        getListadoCaja(from, to),
        getCashMovements(from, to),
      ]);
      setPresupuestos(data.presupuestos || []);
      setNotasPedido(data.notasPedido  || []);
      setRemitos(data.remitos          || []);
      setCashMovs(cashRes.data         || []);
    } catch { addToast("Error cargando listado", "error"); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Totales por método de pago (solo presupuestos)
  const totalesPago = presupuestos.reduce((acc, p) => {
    const met = p.payment_method || "Sin método";
    acc[met] = (acc[met] || 0) + Number(p.total || 0);
    return acc;
  }, {});

  const totalGeneral = presupuestos.reduce((a, p) => a + Number(p.total || 0), 0);

  // Resumen de caja
  const METODOS_COLS = ["Efectivo","Cta Cte","Tarjeta","Por Banco","Mercado Pago","Cheques"];
  const metodoKey = (m) => {
    if (!m) return "Efectivo";
    const l = m.toLowerCase();
    if (l.includes("banco"))        return "Por Banco";
    if (l.includes("tarjeta"))      return "Tarjeta";
    if (l.includes("cta") || l.includes("corriente")) return "Cta Cte";
    if (l.includes("mercado"))      return "Mercado Pago";
    if (l.includes("cheque"))       return "Cheques";
    return "Efectivo";
  };

  const ventasPorMetodo = METODOS_COLS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
  presupuestos.forEach((p) => {
    const col = metodoKey(p.payment_method);
    ventasPorMetodo[col] = (ventasPorMetodo[col] || 0) + Number(p.total || 0);
  });

  const entradasPorMetodo = METODOS_COLS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
  const salidasPorMetodo  = METODOS_COLS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
  cashMovs.forEach((mv) => {
    const col = metodoKey(mv.source);
    if (mv.type === "ingreso") entradasPorMetodo[col] = (entradasPorMetodo[col] || 0) + Number(mv.amount || 0);
    else                       salidasPorMetodo[col]  = (salidasPorMetodo[col]  || 0) + Number(mv.amount || 0);
  });

  const totalVentas   = Object.values(ventasPorMetodo).reduce((a, v) => a + v, 0);
  const totalEntradas = Object.values(entradasPorMetodo).reduce((a, v) => a + v, 0);
  const totalSalidas  = Object.values(salidasPorMetodo).reduce((a, v) => a + v, 0);

  const handleDeleteNota = async (id) => {
    if (!confirm("¿Eliminar esta nota de pedido?")) return;
    try {
      await deleteComprobante(id);
      setNotasPedido((prev) => prev.filter((n) => n.id !== id));
      addToast("Eliminado", "success");
    } catch { addToast("Error eliminando", "error"); }
  };

  const printNotaPDF = (nota) => {
    const win = window.open("", "_blank");
    const items = nota.items || [];
    win.document.write(`
      <html><head><title>Nota de Pedido — ${nota.customer_name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; font-size: 14px; }
        h2 { margin-bottom: 4px; }
        p  { margin: 2px 0; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { text-align: left; border-bottom: 2px solid #000; padding: 7px 10px; font-size: 12px; text-transform: uppercase; }
        td { padding: 7px 10px; border-bottom: 1px solid #eee; }
      </style></head><body>
      <h2>Nota de Pedido</h2>
      <p><b>${nota.customer_name || "—"}</b></p>
      <p>Fecha: ${fmtDate(nota.created_at)}</p>
      ${nota.vendedor ? `<p>Vendedor: ${nota.vendedor}</p>` : ""}
      <table>
        <thead><tr><th>Código</th><th>Descripción</th><th>Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>
          ${items.map((i) => `<tr>
            <td>${i.code||"—"}</td><td>${i.name||i.description||"—"}</td>
            <td>${i.quantity}</td>
            <td style="text-align:right">$${fmt(i.unit_price)}</td>
            <td style="text-align:right">$${fmt(i.quantity*Number(i.unit_price||0))}</td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr>
          <td colspan="4" style="text-align:right;font-weight:bold;padding-top:10px">TOTAL</td>
          <td style="text-align:right;font-weight:bold;padding-top:10px">$${fmt(nota.total)}</td>
        </tr></tfoot>
      </table>
      </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <>
      <ToastContainer />
      <PresModal m={presModal} />

      {/* Filtros */}
      <div style={{ display:"flex", gap:10, marginBottom:24, alignItems:"center", flexWrap:"wrap" }}>
        <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>DESDE</span>
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width:140 }} />
        <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>HASTA</span>
        <input className="input" type="date" value={to}   onChange={(e) => setTo(e.target.value)}   style={{ width:140 }} />
        <button className="btn btn-ghost" onClick={load}>Filtrar</button>
        {loading && <span style={{ fontSize:13, color:"var(--text-dim)", fontFamily:"var(--font-mono)" }}>Cargando...</span>}
      </div>

      {/* ── SECCIÓN 1: PRESUPUESTOS ───────────────────────────── */}
      <div className="card" style={{ marginBottom:24 }}>
        <div className="card-header">
          <span className="card-title">Presupuestos</span>
          <span className="badge badge-info">{presupuestos.length}</span>
        </div>

        {presupuestos.length === 0 ? (
          <div className="empty">Sin presupuestos en este período</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Método de pago</th>
                  <th style={{ textAlign:"right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {presupuestos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="badge badge-accent" style={{
                        background: p.tipo === "Presupuesto Web" ? "rgba(100,200,100,0.15)" : undefined,
                        color:      p.tipo === "Presupuesto Web" ? "var(--success)" : undefined,
                        border:     p.tipo === "Presupuesto Web" ? "1px solid var(--success)" : undefined,
                      }}>
                        {p.tipo || "Presupuesto"}
                      </span>
                    </td>
                    <td style={{ fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(p.created_at)}</td>
                    <td style={{ fontSize:14 }}>{p.customer_name || "—"}</td>
                    <td style={{ fontSize:13, color:"var(--text-muted)" }}>{p.vendedor || "—"}</td>
                    <td>
                      <span style={{ fontSize:12, fontFamily:"var(--font-mono)", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:4, padding:"2px 8px" }}>
                        {p.payment_method || "—"}
                      </span>
                    </td>
                    <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", fontSize:14 }}>
                      ${fmt(p.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totales por método de pago */}
        {presupuestos.length > 0 && (
          <div style={{ borderTop:"2px solid var(--border)", padding:"16px 20px", background:"var(--bg2)" }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>
              Facturación por método de pago
            </div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
              {Object.entries(totalesPago).map(([met, total]) => (
                <div key={met} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 16px", textAlign:"center", minWidth:140 }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{met}</div>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:800, color:"var(--accent)" }}>${fmt(total)}</div>
                </div>
              ))}
              <div style={{ marginLeft:"auto", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"10px 20px", textAlign:"center" }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Total General</div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:22, fontWeight:800, color:"var(--accent)" }}>${fmt(totalGeneral)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SECCIÓN 2: NOTAS DE PEDIDO (RESERVAS) ────────────── */}
      <div className="card" style={{ marginBottom:24 }}>
        <div className="card-header">
          <span className="card-title">Reservas (Notas de Pedido)</span>
          <span className="badge badge-info">{notasPedido.length}</span>
        </div>

        {notasPedido.length === 0 ? (
          <div className="empty">Sin notas de pedido en este período</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th style={{ textAlign:"right" }}>Importe</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {notasPedido.map((n) => (
                  <tr key={n.id}>
                    <td style={{ fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(n.created_at)}</td>
                    <td style={{ fontSize:14 }}>{n.customer_name || "—"}</td>
                    <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", fontSize:14 }}>
                      ${fmt(n.total)}
                    </td>
                    <td>
                      <div style={{ display:"flex", gap:6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => printNotaPDF(n)} title="Imprimir">🖨️</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => presModal.openFor(n)} title="Presupuestar">→ Presupuesto</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteNota(n.id)} title="Eliminar">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECCIÓN 3: REMITOS ────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Remitos</span>
          <span className="badge badge-info">{remitos.length}</span>
        </div>

        {remitos.length === 0 ? (
          <div className="empty">Sin remitos en este período</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Vendedor</th>
                  <th style={{ textAlign:"right" }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {remitos.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(r.created_at)}</td>
                    <td style={{ fontSize:13 }}>{r.origen || "—"}</td>
                    <td style={{ fontSize:13 }}>{r.destino || "—"}</td>
                    <td style={{ fontSize:13, color:"var(--text-muted)" }}>{r.vendedor || "—"}</td>
                    <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", fontSize:14 }}>
                      ${fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECCIÓN 4: RESUMEN DE CAJA ───────────────────────── */}
      <div className="card" style={{ marginTop:24 }}>
        <div className="card-header">
          <span className="card-title">Resumen de Caja</span>
          <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-dim)" }}>
            {from === to ? from : `${from} al ${to}`}
          </span>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"var(--bg3)", borderBottom:"2px solid var(--border)" }}>
                <th style={{ padding:"10px 16px", textAlign:"left", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", width:180 }}></th>
                {METODOS_COLS.map((m) => (
                  <th key={m} style={{ padding:"10px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em" }}>{m}</th>
                ))}
                <th style={{ padding:"10px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                <td style={{ padding:"11px 16px", fontWeight:600, color:"var(--text)" }}>Total ventas</td>
                {METODOS_COLS.map((m) => (
                  <td key={m} style={{ padding:"11px 12px", textAlign:"right", fontFamily:"var(--font-mono)", color: ventasPorMetodo[m] ? "var(--text)" : "var(--text-dim)" }}>
                    {ventasPorMetodo[m] ? `$${fmt(ventasPorMetodo[m])}` : "—"}
                  </td>
                ))}
                <td style={{ padding:"11px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)" }}>${fmt(totalVentas)}</td>
              </tr>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                <td style={{ padding:"11px 16px", fontWeight:600, color:"var(--text)" }}>Entradas por Caja</td>
                {METODOS_COLS.map((m) => (
                  <td key={m} style={{ padding:"11px 12px", textAlign:"right", fontFamily:"var(--font-mono)", color: entradasPorMetodo[m] ? "var(--success)" : "var(--text-dim)" }}>
                    {entradasPorMetodo[m] ? `$${fmt(entradasPorMetodo[m])}` : "—"}
                  </td>
                ))}
                <td style={{ padding:"11px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--success)" }}>${fmt(totalEntradas)}</td>
              </tr>
              <tr style={{ borderBottom:"2px solid var(--border)" }}>
                <td style={{ padding:"11px 16px", fontWeight:600, color:"var(--text)" }}>Salidas por Caja</td>
                {METODOS_COLS.map((m) => (
                  <td key={m} style={{ padding:"11px 12px", textAlign:"right", fontFamily:"var(--font-mono)", color: salidasPorMetodo[m] ? "var(--danger)" : "var(--text-dim)" }}>
                    {salidasPorMetodo[m] ? `-$${fmt(salidasPorMetodo[m])}` : "—"}
                  </td>
                ))}
                <td style={{ padding:"11px 12px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--danger)" }}>-${fmt(totalSalidas)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
