import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import { getRemitos, getRemito, createRemito, deleteRemito, searchProducts } from "../utils/api";
import { useToast } from "../utils/useToast";

const WAREHOUSES = ["Alfred", "Saldo", "Oficina ML", "Camarin", "Salon Teatro", "Oficina", "Tertulia", "Past 280", "Peron Lejos"];

const EMPTY_FORM = { origen: "", destino: "", user_id: "00000000-0000-0000-0000-000000000001" };

export default function Remitos() {
  const [remitos, setRemitos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | 'new' | 'detail'
  const [selected, setSelected] = useState(null);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [items, setItems]     = useState([]);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [qty, setQty]   = useState("");
  const [price, setPrice] = useState("");
  const { addToast, ToastContainer } = useToast();

  const loadAll = async () => {
    setLoading(true);
    try { const { data } = await getRemitos(); setRemitos(data); }
    catch { addToast("Error cargando remitos", "error"); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return; }
    const t = setTimeout(async () => {
      try { const { data } = await searchProducts(productQuery); setProductResults(data); }
      catch {}
    }, 350);
    return () => clearTimeout(t);
  }, [productQuery]);

  const addItem = (product) => {
    if (!qty || isNaN(qty) || Number(qty) <= 0) { addToast("Ingresá una cantidad válida", "error"); return; }
    setItems((prev) => [
      ...prev,
      { product_id: product.id, name: product.name, code: product.code, quantity: Number(qty), unit_price: Number(price) || 0 },
    ]);
    setProductQuery(""); setProductResults([]); setQty(""); setPrice("");
  };

  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    if (!form.origen || !form.destino) { addToast("Seleccioná origen y destino", "error"); return; }
    if (items.length === 0) { addToast("Agregá al menos un producto", "error"); return; }
    try {
      await createRemito({ ...form, items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })) });
      addToast("Remito creado", "success");
      setModal(null); setItems([]); setForm(EMPTY_FORM);
      loadAll();
    } catch { addToast("Error creando remito", "error"); }
  };

  const openDetail = async (id) => {
    try {
      const { data } = await getRemito(id);
      setSelected(data); setModal("detail");
    } catch { addToast("Error cargando remito", "error"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este remito?")) return;
    try { await deleteRemito(id); addToast("Remito eliminado", "success"); loadAll(); }
    catch { addToast("Error eliminando remito", "error"); }
  };

  return (
    <>
      <ToastContainer />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => { setModal("new"); setItems([]); setForm(EMPTY_FORM); }}>
          + Nuevo remito
        </button>
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
                <tr><th>#</th><th>Estado</th><th>Items</th><th></th></tr>
              </thead>
              <tbody>
                {remitos.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                      {r.id.slice(0, 8)}…
                    </td>
                    <td><span className="badge badge-accent">{r.status}</span></td>
                    <td>{r.items?.length ?? "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
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

      {/* NUEVO REMITO */}
      {modal === "new" && (
        <Modal
          title="Nuevo remito"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate}>Crear remito</button>
            </>
          }
        >
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Origen</label>
              <select className="select" value={form.origen} onChange={(e) => setForm((p) => ({ ...p, origen: e.target.value }))}>
                <option value="">Seleccionar</option>
                {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Destino</label>
              <select className="select" value={form.destino} onChange={(e) => setForm((p) => ({ ...p, destino: e.target.value }))}>
                <option value="">Seleccionar</option>
                {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>

          <hr className="divider" />
          <div className="input-label" style={{ marginBottom: 8 }}>AGREGAR PRODUCTOS</div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div className="search-bar" style={{ flex: 1 }}>
              <span className="search-icon">🔍</span>
              <input placeholder="Código o nombre..." value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
            </div>
            <input className="input" style={{ width: 70 }} placeholder="Cant." value={qty} onChange={(e) => setQty(e.target.value)} />
            <input className="input" style={{ width: 90 }} placeholder="Precio" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>

          {productResults.length > 0 && (
            <div className="items-list" style={{ marginBottom: 12 }}>
              {productResults.slice(0, 6).map((p) => (
                <div key={p.id} className="item-row" style={{ cursor: "pointer" }} onClick={() => addItem(p)}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", width: 70 }}>{p.code}</span>
                  <span className="item-name">{p.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>+ Agregar</span>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <>
              <div className="input-label" style={{ marginBottom: 6 }}>ITEMS ({items.length})</div>
              <div className="items-list">
                {items.map((it, i) => (
                  <div key={i} className="item-row">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", width: 60 }}>{it.code}</span>
                    <span className="item-name">{it.name}</span>
                    <span className="item-qty">×{it.quantity}</span>
                    <span className="item-price">${it.unit_price.toLocaleString("es-AR")}</span>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(i)}>✕</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}

      {/* DETAIL */}
      {modal === "detail" && selected && (
        <Modal title={`Remito ${selected.id?.slice(0, 8)}…`} onClose={() => setModal(null)}>
          <div style={{ marginBottom: 12 }}>
            <span className="badge badge-accent">{selected.status}</span>
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
