import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import {
  getComprobantes, getComprobante, createComprobante, deleteComprobante, searchCustomers, searchProducts,
} from "../utils/api";
import { useToast } from "../utils/useToast";

const PAYMENT_METHODS = ["Contado", "Cta Cte", "Tarjeta", "Banco", "Mercado Pago"];
const EMPTY_FORM = { customer_id: "", user_id: "00000000-0000-0000-0000-000000000001", payment_method: "Contado" };

export default function Comprobantes() {
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom]     = useState("");
  const [to, setTo]         = useState("");
  const [modal, setModal]   = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [items, setItems]   = useState([]);

  // customer search
  const [custQuery, setCustQuery]     = useState("");
  const [custResults, setCustResults] = useState([]);
  const [custName, setCustName]       = useState("");

  // product search
  const [prodQuery, setProdQuery]     = useState("");
  const [prodResults, setProdResults] = useState([]);
  const [qty, setQty]   = useState("");
  const [price, setPrice] = useState("");

  const { addToast, ToastContainer } = useToast();

  const loadAll = async () => {
    setLoading(true);
    try { const { data } = await getComprobantes(from, to); setComprobantes(data); }
    catch { addToast("Error cargando comprobantes", "error"); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!custQuery.trim()) { setCustResults([]); return; }
    const t = setTimeout(async () => {
      try { const { data } = await searchCustomers(custQuery); setCustResults(data); }
      catch {}
    }, 350);
    return () => clearTimeout(t);
  }, [custQuery]);

  useEffect(() => {
    if (!prodQuery.trim()) { setProdResults([]); return; }
    const t = setTimeout(async () => {
      try { const { data } = await searchProducts(prodQuery); setProdResults(data); }
      catch {}
    }, 350);
    return () => clearTimeout(t);
  }, [prodQuery]);

  const selectCustomer = (c) => {
    setForm((p) => ({ ...p, customer_id: c.id }));
    setCustName(c.name); setCustQuery(""); setCustResults([]);
  };

  const addItem = (product) => {
    if (!qty || isNaN(qty) || Number(qty) <= 0) { addToast("Cantidad inválida", "error"); return; }
    if (!price || isNaN(price)) { addToast("Precio inválido", "error"); return; }
    setItems((prev) => [
      ...prev,
      { product_id: product.id, name: product.name, code: product.code, quantity: Number(qty), unit_price: Number(price) },
    ]);
    setProdQuery(""); setProdResults([]); setQty(""); setPrice("");
  };

  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const total = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);

  const handleCreate = async () => {
    if (!form.customer_id) { addToast("Seleccioná un cliente", "error"); return; }
    if (items.length === 0) { addToast("Agregá al menos un producto", "error"); return; }
    try {
      await createComprobante({
        ...form,
        items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Comprobante creado", "success");
      setModal(null); setItems([]); setForm(EMPTY_FORM); setCustName("");
      loadAll();
    } catch { addToast("Error creando comprobante", "error"); }
  };

  const openDetail = async (id) => {
    try { const { data } = await getComprobante(id); setSelected(data); setModal("detail"); }
    catch { addToast("Error cargando comprobante", "error"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este comprobante?")) return;
    try { await deleteComprobante(id); addToast("Comprobante eliminado", "success"); loadAll(); }
    catch { addToast("Error eliminando comprobante", "error"); }
  };

  return (
    <>
      <ToastContainer />

      {/* Filters + new */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>DESDE</span>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 140 }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>HASTA</span>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 140 }} />
          <button className="btn btn-ghost" onClick={loadAll}>Filtrar</button>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => { setModal("new"); setItems([]); setForm(EMPTY_FORM); setCustName(""); }}>
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
                <tr><th>#</th><th>Total</th><th>Estado</th><th>Fecha</th><th></th></tr>
              </thead>
              <tbody>
                {comprobantes.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                      {c.id.slice(0, 8)}…
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 600 }}>
                      ${Number(c.total || 0).toLocaleString("es-AR")}
                    </td>
                    <td><span className="badge badge-success">{c.status}</span></td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR") : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
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

      {/* NUEVO COMPROBANTE */}
      {modal === "new" && (
        <Modal
          title="Nuevo comprobante"
          onClose={() => setModal(null)}
          footer={
            <>
              <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)" }}>
                Total: ${total.toLocaleString("es-AR")}
              </span>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate}>Confirmar venta</button>
            </>
          }
        >
          {/* Cliente */}
          <div className="input-group">
            <label className="input-label">Cliente {custName && <span style={{ color: "var(--accent)" }}>— {custName}</span>}</label>
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input placeholder="Buscar cliente..." value={custQuery} onChange={(e) => setCustQuery(e.target.value)} />
            </div>
            {custResults.length > 0 && (
              <div className="items-list">
                {custResults.slice(0, 5).map((c) => (
                  <div key={c.id} className="item-row" style={{ cursor: "pointer" }} onClick={() => selectCustomer(c)}>
                    <span className="item-name">{c.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{c.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">Método de pago</label>
            <select className="select" value={form.payment_method}
              onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <hr className="divider" />
          <div className="input-label" style={{ marginBottom: 8 }}>PRODUCTOS</div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div className="search-bar" style={{ flex: 1 }}>
              <span className="search-icon">🔍</span>
              <input placeholder="Código o nombre..." value={prodQuery} onChange={(e) => setProdQuery(e.target.value)} />
            </div>
            <input className="input" style={{ width: 70 }} placeholder="Cant." value={qty} onChange={(e) => setQty(e.target.value)} />
            <input className="input" style={{ width: 90 }} placeholder="$ Precio" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>

          {prodResults.length > 0 && (
            <div className="items-list" style={{ marginBottom: 10 }}>
              {prodResults.slice(0, 5).map((p) => (
                <div key={p.id} className="item-row" style={{ cursor: "pointer" }} onClick={() => addItem(p)}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", width: 70 }}>{p.code}</span>
                  <span className="item-name">{p.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>+ Agregar</span>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="items-list">
              {items.map((it, i) => (
                <div key={i} className="item-row">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", width: 60 }}>{it.code}</span>
                  <span className="item-name">{it.name}</span>
                  <span className="item-qty">×{it.quantity}</span>
                  <span className="item-price">${(it.quantity * it.unit_price).toLocaleString("es-AR")}</span>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(i)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* DETAIL */}
      {modal === "detail" && selected && (
        <Modal title={`Comprobante ${selected.id?.slice(0, 8)}…`} onClose={() => setModal(null)}>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <span className="badge badge-success">{selected.status}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)" }}>
              Total: ${Number(selected.total || 0).toLocaleString("es-AR")}
            </span>
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
        </Modal>
      )}
    </>
  );
}
