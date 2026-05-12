import { useState, useEffect, useRef } from "react";
import { getUsers, createUser, updateUser, deleteUser, getWarehouses, createWarehouse } from "../utils/api";
import { useToast } from "../utils/useToast";

const ROLES = ["admin", "superadmin", "vendedor", "deposito", "caja"];
const EMPTY  = { name: "", email: "", password: "", role: "vendedor", warehouse_id: "", active: true };

export default function Usuarios() {
  useEffect(() => { document.title = "Usuarios — Once"; }, []);
  const [users,      setUsers]      = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState(null);   // null | "new" | user object
  const [form,       setForm]       = useState(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [showPass,      setShowPass]      = useState(false);
  const [newWhName,     setNewWhName]     = useState("");
  const [creatingWh,    setCreatingWh]    = useState(false);
  const [showNewWh,     setShowNewWh]     = useState(false);
  const newWhInputRef = useRef(null);
  const { addToast, ToastContainer } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, whRes] = await Promise.all([getUsers(), getWarehouses()]);
      setUsers(usersRes.data);
      setWarehouses(whRes.data);
    } catch { addToast("Error cargando datos", "error"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm(EMPTY);
    setEditing("new");
    setShowPass(true);
  };

  const openEdit = (u) => {
    setForm({
      name:         u.name,
      email:        u.email || "",
      password:     "",
      role:         u.role,
      warehouse_id: u.warehouse_id || "",
      active:       u.active,
    });
    setEditing(u);
    setShowPass(false);
  };

  const handleSave = async () => {
    if (!form.name.trim())     { addToast("Nombre requerido", "error"); return; }
    if (!form.email.trim())    { addToast("Email requerido", "error"); return; }
    if (!form.role.trim())     { addToast("Rol requerido", "error"); return; }
    if (editing === "new" && !form.password.trim()) { addToast("Contraseña requerida", "error"); return; }

    setSaving(true);
    try {
      const payload = {
        name:         form.name.trim(),
        email:        form.email.trim(),
        role:         form.role,
        warehouse_id: form.warehouse_id || null,
        active:       form.active,
      };
      if (form.password.trim()) payload.password = form.password;

      if (editing === "new") {
        await createUser(payload);
        addToast("Usuario creado", "success");
      } else {
        await updateUser(editing.id, payload);
        addToast("Usuario actualizado", "success");
      }
      setEditing(null);
      await load();
    } catch (err) {
      addToast(err.response?.data?.message || "Error guardando", "error");
    }
    setSaving(false);
  };

  const handleDelete = async (u) => {
    if (!confirm(`¿Eliminar al usuario "${u.name}"?`)) return;
    try {
      await deleteUser(u.id);
      addToast("Eliminado", "success");
      await load();
    } catch { addToast("Error eliminando", "error"); }
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleShowNewWh = () => {
    setShowNewWh(true);
    setNewWhName("");
    setTimeout(() => newWhInputRef.current?.focus(), 50);
  };

  const handleCreateWarehouse = async () => {
    if (!newWhName.trim()) return;
    setCreatingWh(true);
    try {
      const res = await createWarehouse(newWhName.trim());
      const created = res.data;
      setWarehouses((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((p) => ({ ...p, warehouse_id: created.id }));
      setShowNewWh(false);
      setNewWhName("");
      addToast(`Depósito "${created.name}" creado`, "success");
    } catch (err) {
      addToast(err.response?.data?.message || "Error creando depósito", "error");
    }
    setCreatingWh(false);
  };

  const warehouseName = (id) => warehouses.find((w) => w.id === id)?.name || "—";

  const roleBadgeColor = (role) => {
    if (role === "admin")    return { background: "rgba(220,100,60,0.15)", color: "var(--danger)",  border: "1px solid rgba(220,100,60,0.3)" };
    if (role === "vendedor") return { background: "rgba(60,160,220,0.12)", color: "#60b0e8",        border: "1px solid rgba(60,160,220,0.3)" };
    return { background: "var(--bg3)", color: "var(--text-muted)", border: "1px solid var(--border)" };
  };

  return (
    <>
      <ToastContainer />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Sistema
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
            Gestión de Usuarios
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo usuario</button>
      </div>

      {/* Tabla de usuarios */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Usuarios del sistema</span>
          <span className="badge badge-info">{users.length}</span>
        </div>

        {loading ? (
          <div className="empty">Cargando...</div>
        ) : users.length === 0 ? (
          <div className="empty">No hay usuarios configurados</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Depósito asignado</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</td>
                    <td style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {u.email || "—"}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontFamily: "var(--font-mono)", padding: "3px 10px",
                        borderRadius: 4, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.06em", ...roleBadgeColor(u.role),
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {u.warehouse_name ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 14 }}>🏭</span>
                          {u.warehouse_name}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-dim)", fontSize: 12, fontFamily: "var(--font-mono)" }}>Sin asignar</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 4,
                        background: u.active ? "rgba(60,180,100,0.12)" : "var(--bg3)",
                        color:      u.active ? "var(--success)"         : "var(--text-dim)",
                        border:     u.active ? "1px solid rgba(60,180,100,0.3)" : "1px solid var(--border)",
                      }}>
                        {u.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>✏️ Editar</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(u)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{
        marginTop: 20, padding: "14px 18px",
        background: "rgba(60,160,220,0.06)", border: "1px solid rgba(60,160,220,0.2)",
        borderRadius: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7,
      }}>
        <strong style={{ color: "var(--text)" }}>💡 Cómo funciona el ingreso:</strong><br />
        Cada usuario tiene una contraseña única. Al ingresar al sistema, la contraseña determina automáticamente
        qué usuario eres y de qué <strong>depósito</strong> se descuenta el stock en los presupuestos.
        Para Reposiciones, el depósito se puede seleccionar manualmente.
      </div>

      {/* Modal formulario */}
      {editing !== null && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {editing === "new" ? "Nuevo usuario" : `Editar — ${editing.name}`}
              </span>
              <button className="modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">Nombre *</label>
                  <input className="input" value={form.name} onChange={f("name")} placeholder="Nombre del usuario" autoFocus />
                </div>
                <div className="input-group">
                  <label className="input-label">Email *</label>
                  <input className="input" type="email" value={form.email} onChange={f("email")} placeholder="usuario@mail.com" />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{editing === "new" ? "Contraseña *" : "Nueva contraseña"}</span>
                  {editing !== "new" && (
                    <button
                      onClick={() => setShowPass((v) => !v)}
                      style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11 }}>
                      {showPass ? "Ocultar" : "Cambiar contraseña"}
                    </button>
                  )}
                </label>
                {(editing === "new" || showPass) && (
                  <input
                    className="input"
                    type="password"
                    value={form.password}
                    onChange={f("password")}
                    placeholder={editing === "new" ? "Contraseña de acceso" : "Dejar vacío para no cambiar"}
                  />
                )}
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">Rol</label>
                  <select className="select" value={form.role} onChange={f("role")}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Depósito asignado</span>
                    {!showNewWh && (
                      <button
                        type="button"
                        onClick={handleShowNewWh}
                        style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11, padding: 0 }}
                      >
                        + Nuevo depósito
                      </button>
                    )}
                  </label>
                  {showNewWh ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        ref={newWhInputRef}
                        className="input"
                        value={newWhName}
                        onChange={(e) => setNewWhName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreateWarehouse(); if (e.key === "Escape") setShowNewWh(false); }}
                        placeholder="Nombre del depósito"
                        style={{ flex: 1 }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleCreateWarehouse}
                        disabled={creatingWh || !newWhName.trim()}
                      >
                        {creatingWh ? "..." : "Crear"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowNewWh(false)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <select className="select" value={form.warehouse_id} onChange={f("warehouse_id")}>
                      <option value="">— Sin asignar —</option>
                      {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {editing !== "new" && (
                <div className="input-group">
                  <label className="input-label">Estado</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[true, false].map((val) => (
                      <button
                        key={String(val)}
                        onClick={() => setForm((p) => ({ ...p, active: val }))}
                        style={{
                          padding: "7px 18px", borderRadius: 6, border: "1px solid var(--border)",
                          cursor: "pointer", fontSize: 13,
                          background: form.active === val ? "var(--accent)"      : "var(--bg3)",
                          color:      form.active === val ? "#fff"               : "var(--text-muted)",
                        }}
                      >
                        {val ? "Activo" : "Inactivo"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editing === "new" ? "Crear usuario" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
