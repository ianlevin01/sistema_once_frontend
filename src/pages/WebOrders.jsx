import { useState, useEffect, useRef } from "react";
import { useToast } from "../utils/useToast";
import api, { searchCustomers, createComprobante } from "../utils/api";
import { useVendedores } from "../utils/useVendedores";
import { useAuth } from "../utils/useAuth";
import ProductSearchBar from "../components/ProductSearchBar";
import { calcGanancia, getTasa } from "../utils/calcGanancia";
import { printWebOrderPDF } from "../utils/printDoc";

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

const today = () => new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });

// ─────────────────────────────────────────────────────────────
// Modal de EDICIÓN — misma estructura visual que PresModal
// Recibe el pedido a editar y callbacks
// ─────────────────────────────────────────────────────────────
function EditModal({ order, onClose, onSaved, addToast }) {
  const vendedores = useVendedores();

  // Campos del pedido (datos de cliente y observaciones)
  const [customerName,  setCustomerName]  = useState(order.customer_name  || "");
  const [customerEmail, setCustomerEmail] = useState(order.customer_email || "");
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone || "");
  const [customerCity,  setCustomerCity]  = useState(order.customer_city  || "");
  const [observaciones, setObservaciones] = useState(order.observaciones  || "");

  // Items editables
  const [items,     setItems]     = useState(
    (order.items || []).map((i) => ({ ...i }))
  );

  // Producto nuevo a agregar
  const [prodSel,   setProdSel]   = useState(null);
  const [itemQty,   setItemQty]   = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDesc,  setItemDesc]  = useState("");
  const [priceType, setPriceType] = useState("precio_1");

  const [saving, setSaving] = useState(false);
  const qtyRef = useRef(null);

  // Cuando cambia tipo de precio, actualiza precio del producto seleccionado
  useEffect(() => {
    if (prodSel) {
      const prices = prodSel?.prices || prodSel?.product_prices || [];
      const found  = prices.find((p) => p.price_type === priceType);
      setItemPrice(found ? String(Math.ceil(Number(found.price) * 100) / 100) : "");
    }
  }, [priceType, prodSel]);

  const handleProdSelect = ({ product, price }) => {
    setProdSel(product);
    setItemDesc(product.name);
    setItemPrice(price > 0 ? String(price) : "");
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
    setProdSel(null); setItemQty(""); setItemPrice(""); setItemDesc("");
  };

  const updateItem = (i, key, val) =>
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  const removeItem = (i) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const totalCalc = items.reduce((a, it) => a + Number(it.quantity) * Number(it.unit_price), 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/web-orders/${order.id}`, {
        customer_name:  customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_city:  customerCity,
        observaciones,
        items,
      });
      addToast("Pedido actualizado", "success");
      onSaved(data);
      onClose();
    } catch {
      addToast("Error guardando", "error");
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth:900, width:"96vw", maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink:0 }}>
          <span className="modal-title">✏️ Editar pedido — {order.customer_name}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>

          {/* ── Columna izquierda: datos del cliente ── */}
          <div style={{ width:240, flexShrink:0, borderRight:"1px solid var(--border)", background:"var(--bg2)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

            <div style={{ padding:"12px 14px 10px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>
                Datos del cliente
              </div>
            </div>

            {/* Campos — scroll interno */}
            <div style={{ padding:"12px 14px", flex:1, overflowY:"auto" }}>
              {[
                ["Nombre",   customerName,  setCustomerName],
                ["Email",    customerEmail, setCustomerEmail],
                ["Teléfono", customerPhone, setCustomerPhone],
                ["Ciudad",   customerCity,  setCustomerCity],
              ].map(([label, val, setter]) => (
                <div className="input-group" key={label}>
                  <label className="input-label">{label}</label>
                  <input
                    className="input"
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    style={{ fontSize:12 }}
                  />
                </div>
              ))}
              <div className="input-group">
                <label className="input-label">Observaciones</label>
                <textarea
                  className="input"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  style={{ fontSize:12, resize:"vertical" }}
                />
              </div>

              {/* Tipo de precio para agregar productos */}
              <div className="input-group" style={{ marginTop:8 }}>
                <label className="input-label">Precio al agregar</label>
                <select className="select" value={priceType} onChange={(e) => setPriceType(e.target.value)} style={{ fontSize:12 }}>
                  {PRECIOS.map((p) => <option key={p} value={p}>{PRECIO_LBL[p]}</option>)}
                </select>
              </div>
            </div>

            {/* Botones — siempre al fondo */}
            <div style={{ padding:"12px 14px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ width:"100%", fontSize:13, padding:"10px" }}
              >
                {saving ? "Guardando..." : "✓ Guardar cambios"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={onClose}
                style={{ width:"100%", fontSize:13 }}
              >
                Cancelar
              </button>
            </div>
          </div>

          {/* ── Panel central: items ── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Lista de items */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
              {items.length === 0 ? (
                <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text-dim)", gap:10 }}>
                  <span style={{ fontSize:40 }}>📦</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:12 }}>Sin productos</span>
                </div>
              ) : (
                <>
                  {/* Headers */}
                  <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 80px 100px 90px 30px", gap:8, padding:"0 0 8px", borderBottom:"2px solid var(--border)", marginBottom:4 }}>
                    {["Código","Descripción","Cant.","Precio","Total",""].map((h) => (
                      <div key={h} style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</div>
                    ))}
                  </div>

                  {/* Filas editables */}
                  {items.map((it, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 80px 100px 90px 30px", gap:8, padding:"8px 0", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
                      {/* Código */}
                      <input
                        className="input"
                        style={{ fontFamily:"var(--font-mono)", fontSize:11, height:30, color:"var(--accent)" }}
                        value={it.code || ""}
                        onChange={(e) => updateItem(i, "code", e.target.value)}
                      />
                      {/* Nombre */}
                      <input
                        className="input"
                        style={{ fontSize:12, height:30 }}
                        value={it.name || ""}
                        onChange={(e) => updateItem(i, "name", e.target.value)}
                      />
                      {/* Cantidad */}
                      <input
                        className="input"
                        type="number"
                        style={{ fontSize:12, fontFamily:"var(--font-mono)", textAlign:"center", height:30 }}
                        value={it.quantity}
                        onChange={(e) => updateItem(i, "quantity", e.target.value)}
                      />
                      {/* Precio unit */}
                      <input
                        className="input"
                        type="number"
                        style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--accent)", height:30 }}
                        value={it.unit_price || 0}
                        onChange={(e) => updateItem(i, "unit_price", e.target.value)}
                      />
                      {/* Total fila */}
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"var(--accent)", textAlign:"right" }}>
                        ${(Number(it.quantity) * Number(it.unit_price || 0)).toLocaleString("es-AR")}
                      </span>
                      {/* Eliminar */}
                      <button
                        onClick={() => removeItem(i)}
                        style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", fontSize:16 }}
                      >✕</button>
                    </div>
                  ))}

                  {/* Total general */}
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16, paddingTop:12, borderTop:"2px solid var(--border)" }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Total</div>
                      <div style={{ fontSize:26, fontFamily:"var(--font-mono)", fontWeight:800, color:"var(--accent)" }}>
                        ${totalCalc.toLocaleString("es-AR")}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Barra para agregar producto nuevo ── */}
            <div style={{ borderTop:"2px solid var(--border)", background:"var(--bg2)", padding:"12px 20px 14px", flexShrink:0 }}>

              {/* Chip producto seleccionado */}
              {prodSel && (
                <div style={{ marginBottom:8, padding:"8px 12px", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700 }}>{prodSel.code}</span>
                  <span style={{ fontSize:13, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{prodSel.name}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700, flexShrink:0 }}>
                    ${Number(itemPrice||0).toLocaleString("es-AR")}
                  </span>
                  <span style={{ fontSize:11, color:"var(--text-dim)", flexShrink:0 }}>← cantidad</span>
                </div>
              )}

              {/* Descripción editable */}
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap" }}>Descripción:</div>
                <input
                  className="input"
                  style={{ flex:1, fontSize:13, height:34 }}
                  placeholder="Enter si no modifica"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmItem(); }}
                />
              </div>

              {/* Fila principal */}
              <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                <div style={{ flex:2, minWidth:0 }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Código o descripción</div>
                  <ProductSearchBar
                    priceType={priceType}
                    onSelect={handleProdSelect}
                    autoFocus={!prodSel}
                    dropUp
                  />
                </div>
                <div style={{ flex:"0 0 100px" }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Cantidad</div>
                  <input
                    ref={qtyRef}
                    className="input"
                    style={{ height:38, fontSize:14, fontFamily:"var(--font-mono)", textAlign:"center", width:"100%" }}
                    placeholder="0"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmItem(); }}
                  />
                </div>
                <div style={{ flex:"0 0 110px" }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Precio</div>
                  <input
                    className="input"
                    style={{ height:38, fontSize:14, fontFamily:"var(--font-mono)", color:"var(--accent)", fontWeight:700, width:"100%" }}
                    placeholder="0.00"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmItem(); }}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={confirmItem}
                  style={{ height:38, fontSize:13, padding:"0 16px", flexShrink:0 }}
                >
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
// Componente principal WebOrders
// ─────────────────────────────────────────────────────────────
export default function WebOrders() {
  const vendedores = useVendedores();
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [from,     setFrom]     = useState(today());
  const [to,       setTo]       = useState(today());
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);

  // editOrder: el pedido que se está editando en el modal
  const [editOrder, setEditOrder] = useState(null);

  const [saving,   setSaving]   = useState(false);
  const { addToast, ToastContainer } = useToast();
  const { user } = useAuth();
  const isVendedor = user?.role === "vendedor";

  // ── Estado del modal de presupuestar ──────────────────────────
  const [presModal,    setPresModal]    = useState(false);
  const [presTipo,     setPresTipo]     = useState("Presupuesto Web");
  const [presPayMethod,setPresPayMethod]= useState("Contado");
  const [presPriceType,setPresPriceType]= useState("precio_1");
  const [presVendedor, setPresVendedor] = useState("");
  const [presTexto,    setPresTexto]    = useState("");
  const [presCustSel,     setPresCustSel]     = useState(null);
  const [presCustQuery,   setPresCustQuery]   = useState("");
  const [presCustRes,     setPresCustRes]     = useState([]);
  const [presNoCCWarning, setPresNoCCWarning] = useState(false);
  const [presItems,       setPresItems]       = useState([]);
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
      try { const { data } = await searchCustomers(presCustQuery, true); setPresCustRes(data); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [presCustQuery, presModal]);

  useEffect(() => {
    if (presProdSel) {
      const prices = presProdSel?.prices || presProdSel?.product_prices || [];
      const found  = prices.find((p) => p.price_type === presPriceType);
      setPresItemPrice(found ? String(Math.ceil(Number(found.price) * 100) / 100) : "");
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

  const setColor = async (id, color) => {
    try {
      await api.patch(`/web-orders/${id}/color`, { color });
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, color } : o));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, color }));
    } catch { addToast("Error cambiando color", "error"); }
  };

  const toggleReservado = async (id, current) => {
    try {
      await api.patch(`/web-orders/${id}/reservado`, { reservado: !current });
      const { data: refreshed } = await api.get(`/web-orders/${id}`);
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, ...refreshed } : o));
      if (selected?.id === id) setSelected(refreshed);
      addToast(!current ? "Pedido reservado" : "Reserva cancelada", "success");
    } catch { addToast("Error", "error"); }
  };

  const openDetail = async (o) => {
    try {
      const { data } = await api.get(`/web-orders/${o.id}`);
      setSelected(data);
    } catch { addToast("Error cargando pedido", "error"); }
  };

  // ── Abrir modal de edición ────────────────────────────────────
  const openEdit = () => {
    if (!selected) return;
    setEditOrder(selected);
  };

  // Callback cuando se guarda desde el EditModal
  const handleEditSaved = (updatedOrder) => {
    setSelected(updatedOrder);
    setOrders((prev) => prev.map((o) => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
    setEditOrder(null);
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

  const presupuestar = () => {
    if (!selected) return;
    const itemsPre = (selected.items || []).map((i) => ({
      product_id:  i.product_id || null,
      code:        i.code || "",
      name:        i.name,
      description: i.name,
      quantity:    i.quantity,
      unit_price:  Number(i.unit_price || 0),
    }));
    setPresItems(itemsPre);
    setPresNoCCWarning(false);
    if (selected.customer_id) {
      setPresCustSel({ id: selected.customer_id, name: selected.customer_name });
      // Verificar si el cliente tiene CC
      searchCustomers(selected.customer_name || "", true).then(({ data }) => {
        const hasCC = data.some((c) => c.id === selected.customer_id);
        setPresNoCCWarning(!hasCC);
      }).catch(() => {});
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

  const presSelectCust = (c) => { setPresCustSel(c); setPresCustQuery(""); setPresCustRes([]); setPresNoCCWarning(false); };

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
        user_id:        null,
        payment_method: presPayMethod,
        tipo:           presTipo,
        vendedor:       presVendedor,
        price_type:     presPriceType,
        texto_libre:    presTexto,
        web_order_id:   selected?.id,
        items: presItems.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Presupuesto Web creado", "success");
      setPresModal(false); setPresNoCCWarning(false);
      if (selected) setColor(selected.id, "green");
    } catch { addToast("Error creando presupuesto", "error"); }
    setPresSaving(false);
  };

  const printPDF = () => {
    if (!selected) return;
    printWebOrderPDF(selected);
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <ToastContainer />

      {/* ── MODAL EDITAR ──────────────────────────────────────── */}
      {editOrder && (
        <EditModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={handleEditSaved}
          addToast={addToast}
        />
      )}

      {/* ── MODAL PRESUPUESTAR ──────────────────────────────── */}
      {presModal && (
        <div className="modal-overlay" onClick={() => { setPresModal(false); setPresNoCCWarning(false); }}>
          <div className="modal" style={{ maxWidth:900, width:"96vw", maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column" }}
            onClick={(e) => e.stopPropagation()}>

            <div className="modal-header" style={{ flexShrink:0 }}>
              <span className="modal-title">🧾 Presupuesto Web — {selected?.customer_name}</span>
              <button className="modal-close" onClick={() => { setPresModal(false); setPresNoCCWarning(false); }}>✕</button>
            </div>

            <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>
              <div style={{ width:240, flexShrink:0, borderRight:"1px solid var(--border)", background:"var(--bg2)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
                <div style={{ padding:"14px 14px 10px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Tipo</div>
                  <div style={{ padding:"8px 10px", borderRadius:4, fontSize:13, background:"var(--accent-dim)", color:"var(--accent)", borderLeft:"3px solid var(--accent)", fontWeight:600 }}>
                    Presupuesto Web
                  </div>
                </div>

                <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Cliente</div>
                  {presCustSel ? (
                    <>
                      <div style={{
                        background: presNoCCWarning ? "rgba(234,179,8,.10)" : "var(--accent-dim)",
                        border: `1px solid ${presNoCCWarning ? "#ca8a04" : "var(--accent)"}`,
                        borderRadius:6, padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between",
                      }}>
                        <span style={{ fontSize:13, color: presNoCCWarning ? "#92400e" : "var(--accent)", fontWeight:600 }}>{presCustSel.name}</span>
                        <button onClick={() => { setPresCustSel(null); setPresNoCCWarning(false); }} style={{ background:"none", border:"none", color: presNoCCWarning ? "#92400e" : "var(--accent)", cursor:"pointer", fontSize:14 }}>✕</button>
                      </div>
                      {presNoCCWarning && (
                        <div style={{ marginTop:5, padding:"5px 8px", background:"rgba(234,179,8,.10)", border:"1px solid #ca8a04", borderRadius:4, fontSize:10, color:"#92400e", lineHeight:1.5 }}>
                          ⚠️ Sin CC registrada. Podés usarlo igual o ✕ para buscar uno con CC.
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="search-bar" style={{ height:36 }}>
                        <span className="search-icon">🔍</span>
                        <input placeholder="Buscar con CC..." value={presCustQuery}
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

                <div style={{ padding:"12px 14px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
                  <button className="btn btn-primary" onClick={presHandleCreate} disabled={presSaving}
                    style={{ width:"100%", fontSize:13, padding:"10px" }}>
                    {presSaving ? "Guardando..." : "✓ Cerrar presupuesto"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setPresModal(false); setPresNoCCWarning(false); }}
                    style={{ width:"100%", fontSize:13 }}>Cancelar</button>
                </div>
              </div>

              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
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

                <div style={{ borderTop:"2px solid var(--border)", background:"var(--bg2)", padding:"12px 20px 14px", flexShrink:0 }}>
                  {presProdSel && (
                    <div style={{ marginBottom:8, padding:"8px 12px", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700 }}>{presProdSel.code}</span>
                      <span style={{ fontSize:13, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{presProdSel.name}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700, flexShrink:0 }}>
                        ${Number(presItemPrice||0).toLocaleString("es-AR")}
                      </span>
                      <span style={{ fontSize:11, color:"var(--text-dim)", flexShrink:0 }}>← cantidad</span>
                    </div>
                  )}
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                    <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap" }}>Descripción:</div>
                    <input className="input" style={{ flex:1, fontSize:13, height:34 }} placeholder="Enter si no modifica"
                      value={presItemDesc} onChange={(e) => setPresItemDesc(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") presConfirmItem(); }} />
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                    <div style={{ flex:2, minWidth:0 }}>
                      <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Código o descripción</div>
                      <ProductSearchBar
                        priceType={presPriceType}
                        onSelect={presHandleProdSelect}
                        autoFocus={!presProdSel}
                        dropUp
                      />
                    </div>
                    <div style={{ flex:"0 0 100px" }}>
                      <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Cantidad</div>
                      <input ref={presQtyRef} className="input" style={{ height:38, fontSize:14, fontFamily:"var(--font-mono)", textAlign:"center", width:"100%" }}
                        placeholder="0" value={presItemQty} onChange={(e) => setPresItemQty(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") presConfirmItem(); }} />
                    </div>
                    <div style={{ flex:"0 0 110px" }}>
                      <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Precio</div>
                      <input className="input" style={{ height:38, fontSize:14, fontFamily:"var(--font-mono)", color:"var(--accent)", fontWeight:700, width:"100%" }}
                        placeholder="0.00" value={presItemPrice} onChange={(e) => setPresItemPrice(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") presConfirmItem(); }} />
                    </div>
                    <button className="btn btn-primary" onClick={presConfirmItem}
                      style={{ height:38, fontSize:13, padding:"0 16px", flexShrink:0 }}>+ Agregar</button>
                  </div>
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
                      {o.order_id && (
                        <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", opacity:0.7 }}>
                          NP vinculada
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
                    {new Date(o.created_at).toLocaleString("es-AR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit", timeZone: "America/Argentina/Buenos_Aires" })}
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
                  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-dim)" }}>
                      PEDIDO WEB #{selected.numero}
                    </span>
                    {selected.order_id && (
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)", fontWeight:700 }}>
                        NOTA DE PEDIDO VINCULADA
                      </span>
                    )}
                  </div>
                  <button onClick={() => setSelected(null)}
                    style={{ background:"none", border:"none", color:"var(--text-dim)", cursor:"pointer", fontSize:18 }}>✕</button>
                </div>

                {!isVendedor && (
                  <>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <button className={`btn btn-sm ${selected.reservado ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => toggleReservado(selected.id, selected.reservado)}>
                        {selected.reservado ? "🔒 Reservado" : "🔓 Reservar"}
                      </button>
                      {/* Botón editar — ahora abre el modal */}
                      <button className="btn btn-ghost btn-sm" onClick={openEdit}>✏️ Editar</button>
                      <button className="btn btn-ghost btn-sm" onClick={printPDF}>🖨️ PDF</button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(selected.id)}>🗑️</button>
                    </div>
                    <div style={{ marginTop:10 }}>
                      <button className="btn btn-primary btn-sm" onClick={presupuestar}
                        style={{ width:"100%", fontSize:13 }}>
                        → Presupuestar
                      </button>
                    </div>
                    <div style={{ display:"flex", gap:5, marginTop:10 }}>
                      {COLORS.map((c) => (
                        <div key={c.value} onClick={() => setColor(selected.id, c.value)}
                          style={{
                            flex:1, padding:"4px 0", textAlign:"center", borderRadius:4, cursor:"pointer", fontSize:10,
                            background: selected.color === c.value ? c.bg : "transparent",
                            border: `1px solid ${selected.color === c.value ? c.border : "var(--border)"}`,
                            color: selected.color === c.value ? c.text : "var(--text-dim)",
                            fontFamily:"var(--font-mono)", transition:"all 0.15s",
                          }}>
                          {c.label}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div style={{ flex:1, overflowY:"auto", padding:"16px 18px" }}>
                {/* VISTA DETALLE */}
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
                          {(selected.items||[]).map((it, i) => (
                            <tr key={i} style={{ borderBottom: i<(selected.items||[]).length-1?"1px solid var(--border)":"none" }}>
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

                  {/* Ganancia del vendedor */}
                  {isVendedor && (() => {
                    const items = selected.items || [];
                    const pctV  = Number(user?.pct_vendedor ?? 0);
                    const gananciaBruta = items.reduce((acc, it) => {
                      const precioVenta  = Number(it.unit_price || 0);
                      const precio1Aprox = pctV > 0 ? precioVenta / (1 + pctV / 100) : precioVenta;
                      return acc + (precioVenta - precio1Aprox) * it.quantity;
                    }, 0);
                    const tramo       = getTasa(gananciaBruta);
                    const gananciaReal = gananciaBruta * (tramo.tasa / 100);
                    return (
                      <div style={{ marginTop:12, padding:"12px 14px", background:"var(--success-dim)", border:"1px solid var(--success)", borderRadius:8 }}>
                        <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--success)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>
                          Tu ganancia en este pedido
                        </div>
                        <div style={{ fontSize:11, color:"var(--success)", opacity:0.8, marginBottom:6 }}>
                          {tramo.label} → {tramo.tasa}% de ${gananciaBruta.toLocaleString("es-AR",{minimumFractionDigits:2})}
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:11, color:"var(--success)", opacity:0.7 }}>({pctV}% de margen)</span>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:20, fontWeight:800, color:"var(--success)" }}>
                            ${gananciaReal.toLocaleString("es-AR",{minimumFractionDigits:2})}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ marginTop:12, fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)" }}>
                    {new Date(selected.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
