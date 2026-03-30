import { useState, useEffect, useRef } from "react";
import {
  getRemitos, getRemito, createRemito, deleteRemito,
  searchCustomers,
} from "../utils/api";
import { useToast } from "../utils/useToast";
import ProductSearchBar from "../components/ProductSearchBar";

const WAREHOUSES = ["Alfred","Saldo","Oficina ML","Camarin","Salon Teatro","Oficina","Tertulia","Past 280","Peron Lejos"];
const PRECIOS    = ["precio_1","precio_2","precio_3","precio_4","precio_5","costo"];
const PRECIO_LBL = {
  precio_1:"Precio #1", precio_2:"Precio #2", precio_3:"Precio #3",
  precio_4:"Precio #4", precio_5:"Precio #5", costo:"Precio Costo",
};

const extractPrice = (product, priceType) => {
  const prices = product?.prices || product?.product_prices || [];
  const found  = prices.find((p) => p.price_type === priceType);
  return found ? Number(found.price) : 0;
};

export default function Remitos() {
  const today = () => new Date().toISOString().slice(0, 10);

  const [remitos,      setRemitos]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [creating,     setCreating]     = useState(false);
  const [from,         setFrom]         = useState(today());
  const [to,           setTo]           = useState(today());
  const [appliedFrom,  setAppliedFrom]  = useState(today());
  const [appliedTo,    setAppliedTo]    = useState(today());
  const filterDirty = from !== appliedFrom || to !== appliedTo;

  // Form
  const [origen,     setOrigen]     = useState("Alfred");
  const [destino,    setDestino]    = useState("Past 280");
  const [priceType,  setPriceType]  = useState("precio_1");
  const [sinPrecios, setSinPrecios] = useState(false);

  // Cliente
  const [custQuery,   setCustQuery]   = useState("");
  const [custResults, setCustResults] = useState([]);
  const [custSel,     setCustSel]     = useState(null);

  // Items
  const [items,       setItems]       = useState([]);
  const [prodSel,     setProdSel]     = useState(null);
  const [itemQty,     setItemQty]     = useState("");
  const [itemPrice,   setItemPrice]   = useState("");
  const [itemDesc,    setItemDesc]    = useState("");
  const [saving,      setSaving]      = useState(false);

  const qtyRef = useRef(null);
  const { addToast, ToastContainer } = useToast();

  const loadAll = async (f = appliedFrom, t = appliedTo) => {
    setLoading(true);
    try { const { data } = await getRemitos(f, t); setRemitos(data); }
    catch { addToast("Error cargando remitos", "error"); }
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

  const selectCust = (c) => { setCustSel(c); setCustQuery(""); setCustResults([]); };

  const handleProdSelect = ({ product, price }) => {
    setProdSel(product);
    setItemDesc(product.name);
    setItemPrice(price > 0 ? String(price) : "");
    setTimeout(() => qtyRef.current?.focus(), 50);
  };

  // Cuando cambia tipo de precio y hay producto seleccionado, actualizar precio
  useEffect(() => {
    if (prodSel) {
      const prices = prodSel?.prices || prodSel?.product_prices || [];
      const found  = prices.find((p) => p.price_type === priceType);
      setItemPrice(found ? String(Number(found.price)) : "");
    }
  }, [priceType, prodSel]);

  const confirmItem = () => {
    if (!prodSel)                        { addToast("Seleccioná un producto", "error"); return; }
    if (!itemQty || Number(itemQty) <= 0){ addToast("Ingresá cantidad válida", "error"); return; }
    setItems((prev) => [...prev, {
      product_id: prodSel.id,
      code:       prodSel.code || "",
      name:       prodSel.name,
      description:itemDesc || prodSel.name,
      quantity:   Number(itemQty),
      unit_price: Number(itemPrice) || 0,
    }]);
    setProdSel(null);
    setItemQty(""); setItemPrice(""); setItemDesc("");
  };

  const handleQtyKeyDown = (e) => { if (e.key === "Enter") confirmItem(); };
  const removeItem = (i) => setItems((prev) => prev.filter((_,idx) => idx !== i));
  const total = items.reduce((a, it) => a + it.quantity * it.unit_price, 0);

  const handleCreate = async () => {
    if (!origen || !destino)   { addToast("Seleccioná origen y destino", "error"); return; }
    if (items.length === 0)    { addToast("Agregá al menos un producto", "error"); return; }
    setSaving(true);
    try {
      await createRemito({
        origen, destino,
        user_id:    null, // TODO: reemplazar con el ID del usuario autenticado
        customer_id: custSel?.id || null,
        price_type:  priceType,
        items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Remito creado", "success");
      setCreating(false); resetForm(); loadAll();
    } catch { addToast("Error creando remito", "error"); }
    setSaving(false);
  };

  const resetForm = () => {
    setOrigen("Alfred"); setDestino("Past 280"); setPriceType("precio_1");
    setSinPrecios(false); setCustSel(null); setCustQuery(""); setItems([]);
    setProdSel(null); setItemQty(""); setItemPrice(""); setItemDesc("");
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este remito?")) return;
    try { await deleteRemito(id); addToast("Eliminado", "success"); loadAll(appliedFrom, appliedTo); }
    catch { addToast("Error eliminando", "error"); }
  };

  const openDetail = async (id) => {
    try { const { data } = await getRemito(id); setSelected(data); }
    catch { addToast("Error cargando", "error"); }
  };

  // ─────────────────────────────────────────
  return (
    <>
      <ToastContainer />

      {!creating ? (
        /* ── LISTADO ── */
        <>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <label style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Desde</label>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                style={{ fontSize:13, padding:"6px 10px", width:150 }} />
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <label style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Hasta</label>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)}
                style={{ fontSize:13, padding:"6px 10px", width:150 }} />
            </div>
            {filterDirty && (
              <button className="btn btn-primary btn-sm" onClick={applyFilter}>
                Filtrar
              </button>
            )}
            <div style={{ marginLeft:"auto" }}>
              <button className="btn btn-primary" style={{ fontSize:15, padding:"10px 22px" }}
                onClick={() => { setCreating(true); resetForm(); }}>
                + Nuevo remito
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Remitos</span>
              <span className="badge badge-info">{remitos.length}</span>
            </div>
            {loading ? <div className="empty">Cargando...</div> : remitos.length === 0 ? (
              <div className="empty">No hay remitos</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>#</th><th>Origen</th><th>Destino</th><th>Cliente</th><th>Estado</th><th>Items</th><th>Fecha</th><th></th></tr>
                  </thead>
                  <tbody>
                    {remitos.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)" }}>{r.id.slice(0,8)}…</td>
                        <td style={{ fontSize:14, color:"var(--accent)", fontFamily:"var(--font-mono)", fontWeight:600 }}>{r.origen || "—"}</td>
                        <td style={{ fontSize:14, color:"var(--info)",   fontFamily:"var(--font-mono)", fontWeight:600 }}>{r.destino || "—"}</td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>{r.customer_name || "—"}</td>
                        <td><span className="badge badge-accent">{r.status}</span></td>
                        <td style={{ fontFamily:"var(--font-mono)", fontSize:13 }}>{r.items?.length ?? "—"}</td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>
                          {r.created_at ? new Date(r.created_at).toLocaleDateString("es-AR") : "—"}
                        </td>
                        <td>
                          <div style={{ display:"flex", gap:6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openDetail(r.id)}>Ver</button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(r.id)}>🗑️</button>
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
              <div className="modal" style={{ maxWidth:520 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title">Remito {selected.id?.slice(0,8)}…</span>
                  <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                </div>
                <div style={{ display:"flex", gap:10, marginBottom:14 }}>
                  <span className="badge badge-accent">{selected.status}</span>
                  {selected.origen && <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent)", fontWeight:700 }}>{selected.origen}</span>}
                  {selected.destino && <><span style={{ color:"var(--text-dim)" }}>→</span><span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--info)", fontWeight:700 }}>{selected.destino}</span></>}
                </div>
                {selected.items?.length > 0 ? (
                  <div className="items-list">
                    {selected.items.map((it, i) => (
                      <div key={i} className="item-row">
                        <span className="item-name">{it.product_id}</span>
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
        /* ── NUEVO REMITO ── */
        <div style={{ display:"flex", height:"calc(100vh - 56px)", margin:"-28px", overflow:"hidden" }}>

          {/* ── Columna izquierda ── */}
          <div style={{ width:300, flexShrink:0, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", background:"var(--bg2)", overflow:"hidden" }}>

            {/* Origen / Destino */}
            <div style={{ padding:"20px 18px 16px", borderBottom:"1px solid var(--border)", flex:"0 0 auto" }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:11, fontWeight:700, color:"var(--accent)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14 }}>
                Nuevo Remito
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Origen</div>
                  <div style={{ border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", background:"var(--bg3)" }}>
                    {WAREHOUSES.map((w) => (
                      <div key={w} onClick={() => setOrigen(w)}
                        style={{ padding:"7px 10px", fontSize:13, cursor:"pointer",
                          background: origen===w ? "var(--accent-dim)" : "transparent",
                          color:      origen===w ? "var(--accent)"     : "var(--text-muted)",
                          borderLeft: `3px solid ${origen===w ? "var(--accent)" : "transparent"}`,
                          borderBottom:"1px solid var(--border)",
                          fontWeight: origen===w ? 700 : 400,
                        }}>
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Destino</div>
                  <div style={{ border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", background:"var(--bg3)" }}>
                    {WAREHOUSES.map((w) => (
                      <div key={w} onClick={() => setDestino(w)}
                        style={{ padding:"7px 10px", fontSize:13, cursor:"pointer",
                          background: destino===w ? "var(--info-dim)"  : "transparent",
                          color:      destino===w ? "var(--info)"      : "var(--text-muted)",
                          borderLeft: `3px solid ${destino===w ? "var(--info)" : "transparent"}`,
                          borderBottom:"1px solid var(--border)",
                          fontWeight: destino===w ? 700 : 400,
                        }}>
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Cliente + Precio */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", borderBottom:"1px solid var(--border)" }}>
              {/* Cliente */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Cliente (opcional)</div>
                {custSel ? (
                  <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600 }}>{custSel.name}</span>
                    <button onClick={() => setCustSel(null)} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:16 }}>✕</button>
                  </div>
                ) : (
                  <>
                    <div className="search-bar">
                      <span className="search-icon">🔍</span>
                      <input placeholder="Nombre..." value={custQuery} onChange={(e) => setCustQuery(e.target.value)} style={{ fontSize:13 }} />
                    </div>
                    {custResults.length > 0 && (
                      <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, maxHeight:130, overflowY:"auto", marginTop:6 }}>
                        {custResults.map((c) => (
                          <div key={c.id} onClick={() => selectCust(c)}
                            style={{ padding:"9px 12px", fontSize:13, cursor:"pointer", borderBottom:"1px solid var(--border)" }}
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

              {/* Tipo precio */}
              <div>
                <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Precio</div>
                <div style={{ border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", background:"var(--bg3)" }}>
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

              <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:14 }}>
                <input type="checkbox" id="sinp" checked={sinPrecios} onChange={(e) => setSinPrecios(e.target.checked)} style={{ accentColor:"var(--accent)", width:16, height:16 }} />
                <label htmlFor="sinp" style={{ fontSize:13, color:"var(--text-muted)", cursor:"pointer" }}>Imprimir sin precios</label>
              </div>
            </div>

            {/* Botones */}
            <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:10 }}>
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

            {/* Resumen */}
            <div style={{ padding:"14px 28px", borderBottom:"1px solid var(--border)", background:"var(--bg2)", flexShrink:0, display:"flex", alignItems:"center", gap:16 }}>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, color:"var(--accent)" }}>{origen}</span>
              <span style={{ color:"var(--text-dim)", fontSize:18 }}>→</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, color:"var(--info)" }}>{destino}</span>
              {custSel && <span style={{ fontSize:13, color:"var(--text-muted)", marginLeft:16 }}>Cliente: {custSel.name}</span>}
              <span style={{ marginLeft:"auto", fontSize:13, fontFamily:"var(--font-mono)", color:"var(--text-dim)" }}>{PRECIO_LBL[priceType]}</span>
            </div>

            {/* Lista items */}
            <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
              {items.length === 0 ? (
                <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text-dim)", gap:14 }}>
                  <span style={{ fontSize:52 }}>📦</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:13 }}>Buscá un producto abajo para agregar</span>
                </div>
              ) : (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 80px 120px 36px", gap:12, padding:"0 0 10px", borderBottom:"2px solid var(--border)", marginBottom:4 }}>
                    {["Código","Descripción","Cant.",sinPrecios?"":"Total",""].map((h) => (
                      <div key={h} style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</div>
                    ))}
                  </div>
                  {items.map((it, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"90px 1fr 80px 120px 36px", gap:12, padding:"13px 0", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent)" }}>{it.code || "—"}</span>
                      <span style={{ fontSize:14 }}>{it.description || it.name}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--text-muted)", textAlign:"right" }}>×{it.quantity}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, color: sinPrecios ? "var(--text-dim)" : "var(--accent)", textAlign:"right" }}>
                        {sinPrecios ? "—" : `$${(it.quantity * it.unit_price).toLocaleString("es-AR")}`}
                      </span>
                      <button onClick={() => removeItem(i)} style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", fontSize:18 }}>✕</button>
                    </div>
                  ))}
                  {!sinPrecios && (
                    <div style={{ display:"flex", justifyContent:"flex-end", marginTop:24, paddingTop:16, borderTop:"2px solid var(--border)" }}>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Total</div>
                        <div style={{ fontSize:32, fontFamily:"var(--font-mono)", fontWeight:800, color:"var(--accent)" }}>
                          ${total.toLocaleString("es-AR")}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Barra inferior ── */}
            <div style={{ borderTop:"2px solid var(--border)", background:"var(--bg2)", padding:"18px 28px", flexShrink:0 }}>
              <div style={{ display:"flex", gap:14, alignItems:"flex-end", marginBottom:12 }}>
                <div style={{ flex:2 }}>
                  <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Código o descripción</div>
                  <ProductSearchBar
                    priceType={priceType}
                    onSelect={handleProdSelect}
                    autoFocus={!prodSel}
                  />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Cantidad</div>
                  <input ref={qtyRef} className="input"
                    style={{ height:44, fontSize:16, fontFamily:"var(--font-mono)", textAlign:"center" }}
                    placeholder="0" value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    onKeyDown={handleQtyKeyDown} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>
                    Precio ({PRECIO_LBL[priceType]})
                  </div>
                  <input className="input"
                    style={{ height:44, fontSize:16, fontFamily:"var(--font-mono)", color:"var(--accent)", fontWeight:700 }}
                    placeholder="0.00" value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    onKeyDown={handleQtyKeyDown} />
                </div>
                <button className="btn btn-primary" onClick={confirmItem}
                  style={{ height:44, fontSize:14, padding:"0 24px", flexShrink:0 }}>
                  + Agregar
                </button>
              </div>

              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap" }}>Descripción:</div>
                <input className="input" style={{ flex:1, fontSize:14, height:40 }}
                  placeholder="Presione Enter si no modifica"
                  value={itemDesc} onChange={(e) => setItemDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmItem(); }} />
              </div>

              {prodSel && (
                <div style={{ marginTop:10, padding:"10px 14px", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent)", fontWeight:700 }}>{prodSel.code}</span>
                  <span style={{ fontSize:14, color:"var(--text)", flex:1 }}>{prodSel.name}</span>
                  {!sinPrecios && <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent)", fontWeight:700 }}>
                    ${Number(itemPrice||0).toLocaleString("es-AR")}
                  </span>}
                  <span style={{ fontSize:12, color:"var(--text-dim)" }}>← ingresá cantidad y Enter</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
