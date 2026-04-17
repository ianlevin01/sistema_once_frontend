import { useState, useEffect, useRef } from "react";
import { searchCustomers, createCustomer, updateCustomer, deleteCustomer, openCuentaCorriente } from "../utils/api";
import { useToast } from "../utils/useToast";
import { useNavigate } from "react-router-dom";

const EMPTY = { name: "", document: "", phone: "", email: "", domicilio: "", codigo_postal: "", transporte: "", divisa: "ARS" };

export default function Clientes() {
  const [clientes, setClientes]   = useState([]);
  const [loading,  setLoading]    = useState(false);
  const [search,   setSearch]     = useState("");
  const [modal,    setModal]      = useState(null);
  const [form,     setForm]       = useState(EMPTY);
  const [editId,   setEditId]     = useState(null);
  const [saving,   setSaving]     = useState(false);
  const { addToast, ToastContainer } = useToast();
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  const doSearch = async (q) => {
    if (!q.trim()) { setClientes([]); return; }
    setLoading(true);
    try { const { data } = await searchCustomers(q, false); setClientes(data); }
    catch { addToast("Error buscando clientes", "error"); }
    finally { setLoading(false); }
  };

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 300);
  };

  const refreshSearch = () => doSearch(search);

  const openCrear = () => { setForm(EMPTY); setEditId(null); setModal("editar"); };
  const openEditar = (c) => {
    setForm({ name: c.name || "", document: c.document || "", phone: c.phone || "",
      email: c.email || "", domicilio: c.domicilio || "", codigo_postal: c.codigo_postal || "",
      transporte: c.transporte || "", divisa: c.divisa || "ARS" });
    setEditId(c.id);
    setModal("editar");
  };
  const closeModal = () => { setModal(null); setEditId(null); setForm(EMPTY); };

  const handleSave = async () => {
    if (!form.name.trim()) { addToast("Nombre requerido", "error"); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateCustomer(editId, form);
        addToast("Cliente actualizado", "success");
      } else {
        await createCustomer(form);
        addToast("Cliente creado", "success");
      }
      closeModal();
      await refreshSearch();
    } catch { addToast("Error guardando", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este cliente?")) return;
    try { await deleteCustomer(id); addToast("Eliminado", "success"); refreshSearch(); }
    catch { addToast("Error eliminando", "error"); }
  };

  const handleOpenCC = async (c) => {
    try {
      await openCuentaCorriente(c.id);
      addToast(`Cuenta corriente abierta para ${c.name}`, "success");
      await refreshSearch();
    } catch { addToast("Error abriendo cuenta corriente", "error"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ToastContainer />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Buscar por nombre o documento..."
          value={search}
          onChange={handleSearchChange}
          style={{ width: 280 }}
        />
        {search.trim() && !loading && (
          <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            {clientes.length} resultado{clientes.length !== 1 ? "s" : ""}
          </span>
        )}
        <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={openCrear}>
          + Nuevo cliente
        </button>
      </div>

      {/* Tabla */}
      {!search.trim() ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>Buscá un cliente por nombre o documento</div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>Buscando...</div>
      ) : clientes.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>No se encontraron clientes</div>
      ) : (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg3)", borderBottom: "1px solid var(--border)" }}>
                {["Nombre", "Documento", "Teléfono", "Email", "Cuenta Corriente", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < clientes.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13 }}>{c.name}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>{c.document || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12 }}>{c.phone || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12 }}>{c.email || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {c.tiene_cc ? (
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "var(--success-dim)", color: "var(--success)", fontWeight: 700, border: "1px solid var(--success)" }}>
                        ✓ Cuenta corriente
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Sin cuenta corriente</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {c.tiene_cc ? (
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }}
                          onClick={() => navigate("/cuenta-corriente")}>
                          Ver CC
                        </button>
                      ) : (
                        <button className="btn btn-primary" style={{ fontSize: 11, padding: "4px 8px" }}
                          onClick={() => handleOpenCC(c)}>
                          Abrir CC
                        </button>
                      )}
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }}
                        onClick={() => openEditar(c)}>
                        ✏️ Editar
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px", color: "var(--danger)" }}
                        onClick={() => handleDelete(c.id)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      {modal === "editar" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editId ? "Editar cliente" : "Nuevo cliente"}</span>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Nombre *", key: "name", full: true },
                { label: "Documento", key: "document" },
                { label: "Teléfono", key: "phone" },
                { label: "Email", key: "email" },
                { label: "Domicilio", key: "domicilio", full: true },
                { label: "Código Postal", key: "codigo_postal" },
                { label: "Transporte", key: "transporte" },
              ].map(({ label, key, full }) => (
                <div key={key} style={{ gridColumn: full ? "1 / -1" : undefined }}>
                  <div className="input-label">{label}</div>
                  <input className="input" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <div className="input-label">Divisa</div>
                <select className="select" value={form.divisa} onChange={(e) => setForm((f) => ({ ...f, divisa: e.target.value }))}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
