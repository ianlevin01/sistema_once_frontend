import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import { searchCustomers, createCustomer, updateCustomer, deleteCustomer } from "../utils/api";
import { useToast } from "../utils/useToast";

const EMPTY = { name: "", type: "", document: "", phone: "", email: "" };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // null | 'new' | 'edit'
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const { addToast, ToastContainer } = useToast();

  const load = async (q = "") => {
    if (!q.trim()) { setCustomers([]); return; }
    setLoading(true);
    try {
      const { data } = await searchCustomers(q);
      setCustomers(data);
    } catch { addToast("Error buscando clientes", "error"); }
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => load(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const openNew  = () => { setForm(EMPTY); setEditId(null); setModal("form"); };
  const openEdit = (c)  => { setForm({ name: c.name, type: c.type || "", document: c.document || "", phone: c.phone || "", email: c.email || "" }); setEditId(c.id); setModal("form"); };

  const handleSave = async () => {
    if (!form.name.trim()) { addToast("El nombre es obligatorio", "error"); return; }
    try {
      if (editId) {
        await updateCustomer(editId, form);
        addToast("Cliente actualizado", "success");
      } else {
        await createCustomer(form);
        addToast("Cliente creado", "success");
      }
      setModal(null);
      load(query);
    } catch { addToast("Error guardando cliente", "error"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este cliente?")) return;
    try {
      await deleteCustomer(id);
      addToast("Cliente eliminado", "success");
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } catch { addToast("Error eliminando cliente", "error"); }
  };

  const f = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <>
      <ToastContainer />

      {/* Top row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input
            placeholder="Buscar por nombre o CUIT..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo cliente</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Clientes</span>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
            {customers.length} resultado{customers.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="empty">Buscando...</div>
        ) : customers.length === 0 ? (
          <div className="empty">{query ? "Sin resultados" : "Ingresá un nombre para buscar"}</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Documento</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td><span className="badge badge-info">{c.type || "—"}</span></td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{c.document || "—"}</td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.email || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(c)}>✏️</button>
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

      {modal === "form" && (
        <Modal
          title={editId ? "Editar cliente" : "Nuevo cliente"}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editId ? "Guardar cambios" : "Crear cliente"}
              </button>
            </>
          }
        >
          <div className="input-group">
            <label className="input-label">Nombre *</label>
            <input className="input" value={form.name} onChange={f("name")} placeholder="Nombre completo o razón social" />
          </div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Tipo</label>
              <select className="select" value={form.type} onChange={f("type")}>
                <option value="">Sin tipo</option>
                <option value="minorista">Minorista</option>
                <option value="mayorista">Mayorista</option>
                <option value="proveedor">Proveedor</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Documento / CUIT</label>
              <input className="input" value={form.document} onChange={f("document")} placeholder="20-12345678-9" />
            </div>
          </div>
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Teléfono</label>
              <input className="input" value={form.phone} onChange={f("phone")} placeholder="+54 11..." />
            </div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input className="input" type="email" value={form.email} onChange={f("email")} placeholder="correo@ejemplo.com" />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
