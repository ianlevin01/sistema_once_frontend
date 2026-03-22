import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import { searchProducts, createProduct, updateProduct, deleteProduct } from "../utils/api";
import { useToast } from "../utils/useToast";

const EMPTY = { name: "", code: "", description: "", category_id: "" };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const { addToast, ToastContainer } = useToast();

  const load = async (q = "") => {
    if (!q.trim()) { setProducts([]); return; }
    setLoading(true);
    try {
      const { data } = await searchProducts(q);
      setProducts(data);
    } catch { addToast("Error buscando productos", "error"); }
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => load(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const openNew  = () => { setForm(EMPTY); setEditId(null); setModal("form"); };
  const openEdit = (p) => {
    setForm({ name: p.name, code: p.code || "", description: p.description || "", category_id: "" });
    setEditId(p.id);
    setModal("form");
  };

  const handleSave = async () => {
    if (!form.name.trim()) { addToast("El nombre es obligatorio", "error"); return; }
    try {
      if (editId) {
        await updateProduct(editId, { name: form.name, description: form.description });
        addToast("Producto actualizado", "success");
      } else {
        await createProduct(form);
        addToast("Producto creado", "success");
      }
      setModal(null);
      load(query);
    } catch { addToast("Error guardando producto", "error"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await deleteProduct(id);
      addToast("Producto eliminado", "success");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch { addToast("Error eliminando producto", "error"); }
  };

  const f = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <>
      <ToastContainer />

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input
            placeholder="Buscar por nombre o código..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo producto</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Productos</span>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
            {products.length} resultado{products.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="empty">Buscando...</div>
        ) : products.length === 0 ? (
          <div className="empty">{query ? "Sin resultados" : "Ingresá un nombre o código para buscar"}</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>
                        {p.code || "—"}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{p.description || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(p)}>✏️</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(p.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === "form" && (
        <Modal
          title={editId ? "Editar producto" : "Nuevo producto"}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editId ? "Guardar cambios" : "Crear producto"}
              </button>
            </>
          }
        >
          <div className="input-group">
            <label className="input-label">Nombre *</label>
            <input className="input" value={form.name} onChange={f("name")} placeholder="Descripción del producto" />
          </div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Código</label>
              <input className="input" value={form.code} onChange={f("code")} placeholder="AV5847" />
            </div>
            <div className="input-group">
              <label className="input-label">Categoría ID</label>
              <input className="input" value={form.category_id} onChange={f("category_id")} placeholder="UUID" />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Descripción</label>
            <input className="input" value={form.description} onChange={f("description")} placeholder="Detalles adicionales" />
          </div>
        </Modal>
      )}
    </>
  );
}
