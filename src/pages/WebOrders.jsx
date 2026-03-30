import { useState, useEffect, useRef } from "react";
import { useToast } from "../utils/useToast";
import api, { searchCustomers, createComprobante } from "../utils/api";
import { useVendedores } from "../utils/useVendedores";
import ProductSearchBar from "../components/ProductSearchBar";

const COLORS = [
  { value:"pending", label:"Sin marcar",  bg:"var(--bg3)",           border:"var(--border)",  text:"var(--text-muted)" },
  { value:"green",   label:"Confirmado",  bg:"var(--success-dim)",   border:"var(--success)", text:"var(--success)"    },
  { value:"yellow",  label:"En proceso",  bg:"rgba(240,192,64,.12)", border:"var(--accent)",  text:"var(--accent)"     },
  { value:"red",     label:"Problema",    bg:"var(--danger-dim)",    border:"var(--danger)",  text:"var(--danger)"     },
];
const COLOR_MAP = Object.fromEntries(COLORS.map((c) => [c.value, c]));

const PAGOS   = ["Contado","Cta Cte","Tarjeta","Banco","Mercado Pago","Cheque"];
const PRECIOS = ["precio_1","precio_2","precio_3","precio_4","precio_5","costo"];
const PRECIO_LBL = {
  precio_1:"Precio #1", precio_2:"Precio #2", precio_3:"Precio #3",
  precio_4:"Precio #4", precio_5:"Precio #5", costo:"Precio Costo",
};

const extractPrice = (product, priceType) => {
  const prices = product?.prices || product?.product_prices || [];
  const found  = prices.find((p) => p.price_type === priceType);
  return found ? Number(found.price) : 0;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function WebOrders() {
  const vendedores = useVendedores();
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [from,     setFrom]     = useState(today());
  const [to,       setTo]       = useState(today());
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);
  const [editing,  setEditing]  = useState(false);
  const [form,     setForm]     = useState(null);
  const [saving,   setSaving]   = useState(false);
  const { addToast, ToastContainer } = useToast();

  // ── Estado del modal de presupuestar ──────────────────────────
  const [presModal,    setPresModal]    = useState(false);
  const [presTipo,     setPresTipo]     = useState("Presupuesto Web");
  const [presPayMethod,setPresPayMethod]= useState("Contado");
  const [presPriceType,setPresPriceType]= useState("precio_1");
  const [presVendedor, setPresVendedor] = useState("");
  const [presTexto,    setPresTexto]    = useState("");
  const [presCustSel,  setPresCustSel]  = useState(null);
  const [presCustQuery,setPresCustQuery]= useState("");
  const [presCustRes,  setPresCustRes]  = useState([]);
  const [presItems,    setPresItems]    = useState([]);
  const [presProdSel,  setPresProdSel]  = useState(null);
  const [presItemQty,  setPresItemQty]  = useState("");
  const [presItemPrice,setPresItemPrice]= useState("");
  const [presItemDesc, setPresItemDesc] = useState("");
  const [presSaving,   setPresSaving]   = useState(false);

  const presQtyRef = useRef(null);

  // ── Buscar cliente en modal presupuesto ───────────────────────
  useEffect(() => {
    if (!presModal || !presCustQuery.trim()) { setPresCustRes([]); return; }
    const t = setTimeout(async () => {
      try { const { data } = await searchCustomers(presCustQuery); setPresCustRes(data); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [presCustQuery, presModal]);

  // ── Cuando cambia tipo de precio, actualizar precio del prod seleccionado
  useEffect(() => {
    if (presProdSel) {
      const prices = presProdSel?.prices || presProdSel?.product_prices || [];
      const found  = prices.find((p) => p.price_type === presPriceType);
      setPresItemPrice(found ? String(Number(found.price)) : "");
    }
  }, [presPriceType, presProdSel]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/web-orders", { params: { from, to, search: search || undefined } });
      setOrders(data);
    } catch { addToast("Error cargando pedidos", "error"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalGeneral = orders
    .filter((o) => !o.tildado)
    .reduce((a, o) => a + Number(o.total || 0), 0);

  // ── Cambiar color ──────────────────────────────────────────────
  const setColor = async (id, color) => {
    try {
      await api.patch(`/web-orders/${id}/color`, { color });
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, color } : o));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, color }));
    } catch { addToast("Error cambiando color", "error"); }
  };

  // ── Reservar ───────────────────────────────────────────────────
  const toggleReservado = async (id, current) => {
    try {
      await api.patch(`/web-orders/${id}/reservado`, { reservado: !current });
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, reservado: !current } : o));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, reservado: !current }));
      addToast(!current ? "Pedido reservado" : "Reserva cancelada", "success");
    } catch { addToast("Error", "error"); }
  };

  // ── Abrir detalle ──────────────────────────────────────────────
  const openDetail = async (o) => {
    try {
      const { data } = await api.get(`/web-orders/${o.id}`);
      setSelected(data); setEditing(false);
    } catch { addToast("Error cargando pedido", "error"); }
  };

  // ── Edición ────────────────────────────────────────────────────
  const openEdit = () => {
    setForm({
      customer_name:  selected.customer_name  || "",
      customer_email: selected.customer_email || "",
      customer_phone: selected.customer_phone || "",
      customer_city:  selected.customer_city  || "",
      observaciones:  selected.observaciones  || "",
      items: (selected.items || []).map((i) => ({ ...i })),
    });
    setEditing(true);
  };

  const updateItem = (i, key, val) =>
    setForm((p) => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [key]: val } : it) }));
  const removeFormItem = (i) =>
    setForm((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const addFormItem = () =>
    setForm((p) => ({ ...p, items: [...p.items, { code:"", name:"", quantity:1, unit_price:0 }] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/web-orders/${selected.id}`, form);
      setSelected(data);
      setOrders((prev) => prev.map((o) => o.id === data.id ? { ...o, ...data } : o));
      setEditing(false);
      addToast("Pedido actualizado", "success");
    } catch { addToast("Error guardando", "error"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este pedido?")) return;
    try {
      await api.delete(`/web-orders/${id}`);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      if (selected?.id === id) setSelected(null);
      addToast("Pedido eliminado", "success");
    } catch { addToast("Error eliminando", "error"); }
  };

  // ── Presupuestar: abre modal con datos prellenados ─────────────
  const presupuestar = () => {
    if (!selected) return;
    // Precargar items del pedido web
    const itemsPre = (selected.items || []).map((i) => ({
      product_id:  i.product_id || null,
      code:        i.code || "",
      name:        i.name,
      description: i.name,
      quantity:    i.quantity,
      unit_price:  Number(i.unit_price || 0),
    }));
    setPresItems(itemsPre);
    // Precargar cliente si existe en el sistema
    if (selected.customer_id) {
      setPresCustSel({ id: selected.customer_id, name: selected.customer_name });
    } else {
      setPresCustSel(null);
      setPresCustQuery(selected.customer_name || "");
    }
    setPresTipo("Presupuesto Web");
    setPresPayMethod("Contado");
    setPresPriceType("precio_1");
    setPresVendedor("");
    setPresTexto(selected.observaciones || "");
    setPresProdSel(null);
    setPresItemQty("");
    setPresItemPrice("");
    setPresItemDesc("");
    setPresModal(true);
  };

  // ── Acciones dentro del modal de presupuesto ──────────────────
  const presSelectCust = (c) => { setPresCustSel(c); setPresCustQuery(""); setPresCustRes([]); };

  const presHandleProdSelect = ({ product, price }) => {
    setPresProdSel(product);
    setPresItemDesc(product.name);
    setPresItemPrice(price > 0 ? String(price) : "");
    setTimeout(() => presQtyRef.current?.focus(), 50);
  };

  const presConfirmItem = () => {
    if (!presProdSel) { addToast("Seleccioná un producto", "error"); return; }
    if (!presItemQty || Number(presItemQty) <= 0) { addToast("Ingresá una cantidad válida", "error"); return; }
    setPresItems((prev) => [...prev, {
      product_id:  presProdSel.id,
      code:        presProdSel.code || "",
      name:        presProdSel.name,
      description: presItemDesc || presProdSel.name,
      quantity:    Number(presItemQty),
      unit_price:  Number(presItemPrice) || 0,
    }]);
    setPresProdSel(null);
    setPresItemQty(""); setPresItemPrice(""); setPresItemDesc("");
  };

  const presRemoveItem = (i) => setPresItems((prev) => prev.filter((_, idx) => idx !== i));

  const presTotal = presItems.reduce((a, it) => a + it.quantity * it.unit_price, 0);

  const presHandleCreate = async () => {
    if (!presCustSel)          { addToast("Seleccioná un cliente", "error"); return; }
    if (presItems.length === 0){ addToast("Agregá al menos un producto", "error"); return; }
    setPresSaving(true);
    try {
      await createComprobante({
        customer_id:    presCustSel.id,
        user_id:        null, // TODO: reemplazar con el ID del usuario autenticado
        payment_method: presPayMethod,
        tipo:           presTipo,
        vendedor:       presVendedor,
        price_type:     presPriceType,
        texto_libre:    presTexto,
        web_order_id:   selected?.id,
        items: presItems.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Presupuesto Web creado", "success");
      setPresModal(false);
      // Marcar el pedido con color verde (confirmado) automáticamente
      if (selected) setColor(selected.id, "green");
    } catch { addToast("Error creando presupuesto", "error"); }
    setPresSaving(false);
  };

  // ── PDF ────────────────────────────────────────────────────────
  const printPDF = () => {
    if (!selected) return;
    const win = window.open("", "_blank");
    const items = selected.items || [];
    const total = items.reduce((a, i) => a + i.quantity * Number(i.unit_price || 0), 0);
    win.document.write(`
      <html><head><title>Pedido #${selected.numero || selected.id.slice(0,8)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; font-size: 14px; }
        h2   { margin-bottom: 4px; }
        p    { margin: 2px 0; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th   { text-align: left; border-bottom: 2px solid #000; padding: 8px 10px; font-size: 12px; text-transform: uppercase; }
        td   { padding: 8px 10px; border-bottom: 1px solid #eee; }
        .total { text-align: right; margin-top: 16px; font-size: 18px; font-weight: bold; }
      </style></head><body>
      <h2>Pedido N° ${selected.numero || "—"}</h2>
      <p><b>${selected.customer_name}</b></p>
      ${selected.customer_city  ? `<p>${selected.customer_city}</p>` : ""}
      ${selected.customer_phone ? `<p>Tel: ${selected.customer_phone}</p>` : ""}
      ${selected.customer_email ? `<p>${selected.customer_email}</p>` : ""}
      ${selected.observaciones  ? `<p style="margin-top:8px;color:#333">${selected.observaciones}</p>` : ""}
      <table>
        <thead><tr><th>Código</th><th>Producto</th><th>Cantidad</th><th style="text-align:right">Precio unit.</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>
          ${items.map((i) => `
            <tr>
              <td>${i.code || "—"}</td>
              <td>${i.name}</td>
              <td>${i.quantity}</td>
              <td style="text-align:right">$${Number(i.unit_price||0).toLocaleString("es-AR",{minimumFractionDigits:2})}</td>
              <td style="text-align:right">$${(i.quantity*Number(i.unit_price||0)).toLocaleString("es-AR",{minimumFractionDigits:2})}</td>
            </tr>`).join("")}
        </tbody>
        <tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold;padding-top:12px">TOTAL</td>
          <td style="text-align:right;font-weight:bold;padding-top:12px">$${total.toLocaleString("es-AR",{minimumFractionDigits:2})}</td></tr></tfoot>
      </table>
      </body></html>`);
    win.document.close();
    win.print();
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <ToastContainer />

      {/* ── MODAL PRESUPUESTAR ──────────────────────────────── */}
      {presModal && (
        <div className="modal-overlay" onClick={() => setPresModal(false)}>
          <div className="modal" style={{ maxWidth:900, width:"96vw", maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column" }}
            onClick={(e) => e.stopPropagation()}>

            <div className="modal-header" style={{ flexShrink:0 }}>
              <span className="modal-title">🧾 Presupuesto Web — {selected?.customer_name}</span>
              <button className="modal-close" onClick={() => setPresModal(false)}>✕</button>
            </div>

            <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>

              {/* Columna izquierda: config */}
              <div style={{ width:240, flexShrink:0, borderRight:"1px solid var(--border)", background:"var(--bg2)", display:"flex", flexDirection:"column", overflowY:"auto" }}>

                {/* Tipo — fijo en Presupuesto Web */}
                <div style={{ padding:"14px 14px 10px", borderBottom:"1px solid var(--border)" }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Tipo</div>
                  <div style={{ padding:"8px 10px", borderRadius:4, fontSize:13, background:"var(--accent-dim)", color:"var(--accent)", borderLeft:"3px solid var(--accent)", fontWeight:600 }}>
                    Presupuesto Web
                  </div>
                </div>

                {/* Cliente */}
                <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Cliente</div>
                  {presCustSel ? (
                    <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600 }}>{presCustSel.name}</span>
                      <button onClick={() => setPresCustSel(null)} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:14 }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="search-bar" style={{ height:36 }}>
                        <span className="search-icon">🔍</span>
                        <input placeholder="Nombre o CUIT..." value={presCustQuery}
                          onChange={(e) => setPresCustQuery(e.target.value)} style={{ fontSize:12 }} />
                      </div>
                      {presCustRes.length > 0 && (
                        <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, maxHeight:120, overflowY:"auto", marginTop:6 }}>
                          {presCustRes.map((c) => (
                            <div key={c.id} onClick={() => presSelectCust(c)}
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

                {/* Config */}
                <div style={{ padding:"12px 14px", flex:1, overflowY:"auto" }}>
                  <div className="input-group">
                    <label className="input-label">Método de pago</label>
                    <select className="select" value={presPayMethod} onChange={(e) => setPresPayMethod(e.target.value)} style={{ fontSize:12 }}>
                      {PAGOS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Tipo de precio</label>
                    <select className="select" value={presPriceType} onChange={(e) => setPresPriceType(e.target.value)} style={{ fontSize:12 }}>
                      {PRECIOS.map((p) => <option key={p} value={p}>{PRECIO_LBL[p]}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Vendedor</label>
                    <select className="select" value={presVendedor} onChange={(e) => setPresVendedor(e.target.value)} style={{ fontSize:12 }}>
                      <option value="">— seleccionar —</option>
                      {vendedores.map((v) => <option key={v.id} value={v.nombre}>{v.nombre}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Observaciones</label>
                    <input className="input" value={presTexto} onChange={(e) => setPresTexto(e.target.value)}
                      placeholder="Texto libre..." style={{ fontSize:12 }} />
                  </div>
                </div>

                {/* Botones */}
                <div style={{ padding:"12px 14px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:8 }}>
                  <button className="btn btn-primary" onClick={presHandleCreate} disabled={presSaving}
                    style={{ width:"100%", fontSize:13, padding:"10px" }}>
                    {presSaving ? "Guardando..." : "✓ Cerrar presupuesto"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setPresModal(false)}
                    style={{ width:"100%", fontSize:13 }}>Cancelar</button>
                </div>
              </div>

              {/* Panel central: items */}
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

                {/* Lista de items */}
                <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
                  {presItems.length === 0 ? (
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
                      {presItems.map((it, i) => (
                        <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 70px 110px 30px", gap:10, padding:"11px 0", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
                          <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)" }}>{it.code || "—"}</span>
                          <span style={{ fontSize:13 }}>{it.description || it.name}</span>
                          <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)", textAlign:"right" }}>×{it.quantity}</span>
                          <span style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color:"var(--accent)", textAlign:"right" }}>
                            ${(it.quantity * it.unit_price).toLocaleString("es-AR")}
                          </span>
                          <button onClick={() => presRemoveItem(i)}
                            style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", fontSize:16 }}>✕</button>
                        </div>
                      ))}
                      <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16, paddingTop:12, borderTop:"2px solid var(--border)" }}>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Total</div>
                          <div style={{ fontSize:26, fontFamily:"var(--font-mono)", fontWeight:800, color:"var(--accent)" }}>
                            ${presTotal.toLocaleString("es-AR")}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Barra de ingreso de productos */}
                <div style={{ borderTop:"2px solid var(--border)", background:"var(--bg2)", padding:"14px 20px", flexShrink:0 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"flex-end", marginBottom:8 }}>
                    <div style={{ flex:2 }}>
                      <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Código o descripción</div>
                      <ProductSearchBar
                        priceType={presPriceType}
                        onSelect={presHandleProdSelect}
                        autoFocus={!presProdSel}
                      />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Cantidad</div>
                      <input ref={presQtyRef} className="input" style={{ height:40, fontSize:14, fontFamily:"var(--font-mono)", textAlign:"center" }}
                        placeholder="0" value={presItemQty} onChange={(e) => setPresItemQty(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") presConfirmItem(); }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Precio</div>
                      <input className="input" style={{ height:40, fontSize:14, fontFamily:"var(--font-mono)", color:"var(--accent)", fontWeight:700 }}
                        placeholder="0.00" value={presItemPrice} onChange={(e) => setPresItemPrice(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") presConfirmItem(); }} />
                    </div>
                    <button className="btn btn-primary" onClick={presConfirmItem}
                      style={{ height:40, fontSize:13, padding:"0 18px", flexShrink:0 }}>+ Agregar</button>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap" }}>Descripción:</div>
                    <input className="input" style={{ flex:1, fontSize:13, height:36 }} placeholder="Enter si no modifica"
                      value={presItemDesc} onChange={(e) => setPresItemDesc(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") presConfirmItem(); }} />
                  </div>
                  {presProdSel && (
                    <div style={{ marginTop:8, padding:"8px 12px", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700 }}>{presProdSel.code}</span>
                      <span style={{ fontSize:13, color:"var(--text)", flex:1 }}>{presProdSel.name}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700 }}>
                        ${Number(presItemPrice||0).toLocaleString("es-AR")}
                      </span>
                      <span style={{ fontSize:11, color:"var(--text-dim)" }}>← cantidad y Enter</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CABECERA Y FILTROS ─────────────────────────────────── */}
      <div style={{ display:"flex", gap:10, marginBottom:20, alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>DESDE</span>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width:140 }} />
          <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>HASTA</span>
          <input className="input" type="date" value={to}   onChange={(e) => setTo(e.target.value)}   style={{ width:140 }} />
          <div className="search-bar" style={{ width:180 }}>
            <span className="search-icon">🔍</span>
            <input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") load(); }} style={{ fontSize:13 }} />
          </div>
          <button className="btn btn-ghost" onClick={load}>Filtrar</button>
        </div>
        <div style={{ flex:1 }} />
        {!orders.every((o) => o.tildado) && (
          <div style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent)", fontWeight:700 }}>
            Total: ${totalGeneral.toLocaleString("es-AR", { minimumFractionDigits:2 })}
          </div>
        )}
      </div>

      {/* ── LAYOUT: lista + detalle ───────────────────────────── */}
      <div style={{ display:"flex", gap:16, height:"calc(100vh - 160px)", overflow:"hidden" }}>

        {/* Lista de pedidos */}
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8 }}>
          {loading ? (
            <div className="empty">Cargando...</div>
          ) : orders.length === 0 ? (
            <div className="empty">No hay pedidos para este período</div>
          ) : (
            orders.map((o) => {
              const c = COLOR_MAP[o.color] || COLOR_MAP.pending;
              const isActive = selected?.id === o.id;
              return (
                <div key={o.id} onClick={() => openDetail(o)}
                  style={{
                    border: `1px solid ${isActive ? "var(--accent)" : c.border}`,
                    borderRadius:8, padding:"12px 14px", cursor:"pointer",
                    background: isActive ? "var(--accent-dim)" : c.bg,
                    transition:"all 0.15s",
                    opacity: o.tildado ? 0.45 : 1,
                  }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, fontWeight:700, color:"var(--text-dim)" }}>
                        #{o.numero}
                      </span>
                      {o.reservado && (
                        <span style={{ fontSize:10, fontFamily:"var(--font-mono)", background:"var(--accent)", color:"var(--bg)", borderRadius:3, padding:"1px 5px" }}>
                          RESERVADO
                        </span>
                      )}
                    </div>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:800, color: c.text }}>
                      ${Number(o.total||0).toLocaleString("es-AR")}
                    </span>
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:2 }}>{o.customer_name}</div>
                  {o.customer_city && (
                    <div style={{ fontSize:12, color:"var(--text-dim)" }}>📍 {o.customer_city}</div>
                  )}
                  <div style={{ fontSize:11, color:"var(--text-dim)", marginTop:4, fontFamily:"var(--font-mono)" }}>
                    {new Date(o.created_at).toLocaleString("es-AR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Panel detalle */}
        <div style={{
          width:360, flexShrink:0, border:"1px solid var(--border)", borderRadius:8,
          background:"var(--bg2)", display:"flex", flexDirection:"column", overflow:"hidden",
        }}>
          {!selected ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text-dim)", gap:12 }}>
              <span style={{ fontSize:48 }}>🌐</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:12 }}>Seleccioná un pedido</span>
            </div>
          ) : (
            <>
              {/* Header detalle */}
              <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)" }}>
                    PEDIDO #{selected.numero}
                  </span>
                  <button onClick={() => setSelected(null)}
                    style={{ background:"none", border:"none", color:"var(--text-dim)", cursor:"pointer", fontSize:18 }}>✕</button>
                </div>

                {/* Acciones */}
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  <button className={`btn btn-sm ${selected.reservado ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => toggleReservado(selected.id, selected.reservado)}>
                    {selected.reservado ? "🔒 Reservado" : "🔓 Reservar"}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={openEdit}>✏️ Editar</button>
                  <button className="btn btn-ghost btn-sm" onClick={printPDF}>🖨️ PDF</button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(selected.id)}>🗑️</button>
                </div>

                {/* Botón presupuestar */}
                <div style={{ marginTop:10 }}>
                  <button className="btn btn-primary btn-sm" onClick={presupuestar}
                    style={{ width:"100%", fontSize:13 }}>
                    → Presupuestar
                  </button>
                </div>

                {/* Colores */}
                <div style={{ display:"flex", gap:5, marginTop:10 }}>
                  {COLORS.map((c) => (
                    <div key={c.value} onClick={() => setColor(selected.id, c.value)}
                      style={{ flex:1, padding:"4px 0", textAlign:"center", borderRadius:4, cursor:"pointer", fontSize:10,
                        background: selected.color===c.value ? c.bg : "transparent",
                        border: `1px solid ${selected.color===c.value ? c.border : "var(--border)"}`,
                        color: selected.color===c.value ? c.text : "var(--text-dim)",
                        fontFamily:"var(--font-mono)", transition:"all 0.15s",
                      }}>
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cuerpo detalle / form edición */}
              <div style={{ flex:1, overflowY:"auto", padding:"16px 18px" }}>
                {editing ? (
                  /* FORM EDICIÓN */
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>Datos del cliente</div>
                    {[
                      ["Nombre",    "customer_name"],
                      ["Email",     "customer_email"],
                      ["Teléfono",  "customer_phone"],
                      ["Ciudad",    "customer_city"],
                      ["Obs.",      "observaciones"],
                    ].map(([label, key]) => (
                      <div className="input-group" key={key} style={{ marginBottom:0 }}>
                        <label className="input-label">{label}</label>
                        <input className="input" value={form[key]||""} onChange={(e)=>setForm((p)=>({...p,[key]:e.target.value}))} style={{ fontSize:13 }} />
                      </div>
                    ))}
                    <hr className="divider" />
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>Items</div>
                    {form.items.map((it, i) => (
                      <div key={i} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 12px", display:"flex", flexDirection:"column", gap:8 }}>
                        <div style={{ display:"flex", gap:8 }}>
                          <input className="input" style={{ width:70, fontSize:12, fontFamily:"var(--font-mono)" }}
                            placeholder="Código" value={it.code||""} onChange={(e)=>updateItem(i,"code",e.target.value)} />
                          <input className="input" style={{ flex:1, fontSize:13 }}
                            placeholder="Nombre" value={it.name||""} onChange={(e)=>updateItem(i,"name",e.target.value)} />
                          <button onClick={()=>removeFormItem(i)} style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", fontSize:16, flexShrink:0 }}>✕</button>
                        </div>
                        <div style={{ display:"flex", gap:8 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", marginBottom:2 }}>CANT.</div>
                            <input className="input" type="number" style={{ fontSize:13, fontFamily:"var(--font-mono)", textAlign:"center" }}
                              value={it.quantity} onChange={(e)=>updateItem(i,"quantity",e.target.value)} />
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", marginBottom:2 }}>PRECIO</div>
                            <input className="input" type="number" style={{ fontSize:13, fontFamily:"var(--font-mono)", color:"var(--accent)" }}
                              value={it.unit_price||0} onChange={(e)=>updateItem(i,"unit_price",e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button className="btn btn-ghost btn-sm" onClick={addFormItem} style={{ width:"100%" }}>+ Agregar item</button>
                    <div style={{ display:"flex", gap:8, marginTop:6 }}>
                      <button className="btn btn-ghost" onClick={()=>setEditing(false)} style={{ flex:1 }}>Cancelar</button>
                      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex:1 }}>
                        {saving ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* VISTA DETALLE */
                  <div>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:17, fontWeight:700, color:"var(--text)", marginBottom:4 }}>{selected.customer_name}</div>
                      {selected.customer_city  && <div style={{ fontSize:13, color:"var(--text-muted)" }}>📍 {selected.customer_city}</div>}
                      {selected.customer_phone && <div style={{ fontSize:13, color:"var(--text-muted)" }}>📞 {selected.customer_phone}</div>}
                      {selected.customer_email && <div style={{ fontSize:13, color:"var(--text-muted)" }}>✉️ {selected.customer_email}</div>}
                      {selected.observaciones  && (
                        <div style={{ marginTop:8, padding:"9px 12px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, fontSize:13, color:"var(--text-muted)", lineHeight:1.5 }}>
                          {selected.observaciones}
                        </div>
                      )}
                    </div>
                    <hr className="divider" />
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
                      Productos ({(selected.items||[]).length})
                    </div>
                    {(selected.items||[]).length === 0 ? (
                      <div className="empty">Sin productos</div>
                    ) : (
                      <div style={{ border:"1px solid var(--border)", borderRadius:6, overflow:"hidden" }}>
                        <table style={{ width:"100%", borderCollapse:"collapse" }}>
                          <thead>
                            <tr style={{ background:"var(--bg3)" }}>
                              {["Código","Producto","Cant.","Precio"].map((h,i) => (
                                <th key={h} style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--text-dim)", borderBottom:"1px solid var(--border)", textAlign: i>1?"right":"left" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selected.items.map((it, i) => (
                              <tr key={i} style={{ borderBottom: i<selected.items.length-1?"1px solid var(--border)":"none" }}>
                                <td style={{ padding:"7px 8px", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)" }}>{it.code||"—"}</td>
                                <td style={{ padding:"7px 8px", fontSize:12 }}>{it.name}</td>
                                <td style={{ padding:"7px 8px", fontFamily:"var(--font-mono)", fontSize:12, fontWeight:700, textAlign:"right" }}>{it.quantity}</td>
                                <td style={{ padding:"7px 8px", fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", textAlign:"right" }}>
                                  ${Number(it.unit_price||0).toLocaleString("es-AR",{minimumFractionDigits:2})}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background:"var(--bg3)", borderTop:"2px solid var(--border)" }}>
                              <td colSpan={3} style={{ padding:"8px 8px", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-muted)", textTransform:"uppercase" }}>Total</td>
                              <td style={{ padding:"8px 8px", fontFamily:"var(--font-mono)", fontSize:14, fontWeight:800, color:"var(--accent)", textAlign:"right" }}>
                                ${Number(selected.total||0).toLocaleString("es-AR",{minimumFractionDigits:2})}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                    <div style={{ marginTop:12, fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)" }}>
                      {new Date(selected.created_at).toLocaleString("es-AR")}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
