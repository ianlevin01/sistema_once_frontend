import { useState, useEffect } from "react";
import { getTransportes, createTransporte, updateTransporte, deleteTransporte } from "../utils/api";
import { useToast } from "../utils/useToast";
import RemitoTransporteTab from "./RemitoTransporteTab";

const EMPTY = { codigo: "", razon_social: "", domicilio: "", telefono: "", email: "" };

export default function Transportes() {
  const [activeTab, setActiveTab] = useState("transportes");
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | objeto transporte
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const { addToast, ToastContainer } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      setList(await getTransportes());
    } catch {
      addToast("Error al cargar transportes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew  = () => { setForm(EMPTY); setEditing("new"); };
  const openEdit = (t) => { setForm({ codigo: t.codigo, razon_social: t.razon_social, domicilio: t.domicilio || "", telefono: t.telefono, email: t.email || "" }); setEditing(t); };
  const cancel   = () => { setEditing(null); setForm(EMPTY); };

  const save = async () => {
    if (!form.codigo.trim() || !form.razon_social.trim() || !form.telefono.trim()) {
      addToast("Código, razón social y teléfono son obligatorios", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") {
        await createTransporte(form);
        addToast("Transporte creado", "success");
      } else {
        await updateTransporte(editing.id, form);
        addToast("Transporte actualizado", "success");
      }
      cancel();
      await load();
    } catch {
      addToast("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar este transporte?")) return;
    try {
      await deleteTransporte(id);
      addToast("Eliminado", "success");
      await load();
    } catch {
      addToast("Error al eliminar", "error");
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const TABS = [
    { key: "transportes",       label: "Transportes" },
    { key: "remitos-transporte", label: "Remitos de Transporte" },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <ToastContainer />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Transportes</h2>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: "none", border: "none",
              borderBottom: activeTab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === t.key ? "var(--accent)" : "var(--text-muted)",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "remitos-transporte" && <RemitoTransporteTab />}

      {activeTab === "transportes" && (<>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo transporte</button>
      </div>

      {/* Formulario inline */}
      {editing && (
        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: 20, marginBottom: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--text)" }}>
            {editing === "new" ? "Nuevo transporte" : "Editar transporte"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div className="input-label">Código *</div>
              <input className="input" value={form.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="Ej: DALF" />
            </div>
            <div>
              <div className="input-label">Razón Social *</div>
              <input className="input" value={form.razon_social} onChange={(e) => set("razon_social", e.target.value)} placeholder="Ej: DON ALFREDO" />
            </div>
            <div>
              <div className="input-label">Teléfono *</div>
              <input className="input" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="Ej: (011) 4xxx-xxxx" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <div className="input-label">Domicilio</div>
              <input className="input" value={form.domicilio} onChange={(e) => set("domicilio", e.target.value)} placeholder="Dirección completa" />
            </div>
            <div>
              <div className="input-label">Email</div>
              <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="correo@transporte.com" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button className="btn btn-ghost" onClick={cancel}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>Cargando...</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
          No hay transportes. Creá el primero.
        </div>
      ) : (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg3)", borderBottom: "1px solid var(--border)" }}>
                {["Código","Razón Social","Domicilio","Teléfono","Email",""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: i < list.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12 }}>{t.codigo}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13 }}>{t.razon_social}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)" }}>{t.domicilio || "—"}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12 }}>{t.telefono}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)" }}>{t.email || "—"}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px", marginRight: 6 }} onClick={() => openEdit(t)}>Editar</button>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px", color: "var(--danger)" }} onClick={() => remove(t.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>)}
    </div>
  );
}
