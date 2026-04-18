import { useState, useEffect, useRef } from "react";
import {
  getTransportRemitos, createTransportRemito, deleteTransportRemito,
  getTransportes, searchCustomers,
} from "../utils/api";
import { useToast } from "../utils/useToast";
import { printRemitoTransporte, printEtiquetasEnvio } from "../utils/printDoc";
import { useAuth } from "../utils/useAuth";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }) : "—";

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const nroRemito = (n) => `00001-${String(n || 0).padStart(8, "0")}`;

export default function RemitoTransporteTab() {
  const { user } = useAuth();
  const { addToast, ToastContainer } = useToast();

  // Lista — sin filtro de fecha por defecto para evitar problemas de zona horaria
  const [list,         setList]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [from,         setFrom]         = useState("");
  const [to,           setTo]           = useState("");
  const [appliedFrom,  setAppliedFrom]  = useState("");
  const [appliedTo,    setAppliedTo]    = useState("");
  const filterDirty = from !== appliedFrom || to !== appliedTo;

  // Transportes disponibles
  const [transportes, setTransportes] = useState([]);

  // Formulario
  const [creating, setCreating] = useState(false);

  // Cliente
  const [custQuery,   setCustQuery]   = useState("");
  const [custResults, setCustResults] = useState([]);
  const [custSel,     setCustSel]     = useState(null);
  const custTimer = useRef(null);

  // Campos
  const [transpId,  setTranspId]  = useState("");
  const [envia,     setEnvia]     = useState(user?.name || "");
  const [bultos,    setBultos]    = useState(1);
  const [valor,     setValor]     = useState("");
  const [saving,    setSaving]    = useState(false);

  const loadList = async (f = appliedFrom, t = appliedTo) => {
    setLoading(true);
    try {
      setList(await getTransportRemitos(f, t));
    } catch {
      addToast("Error al cargar remitos de transporte", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadTransportes = async () => {
    try { setTransportes(await getTransportes()); } catch { /* silencioso */ }
  };

  useEffect(() => { loadList(appliedFrom, appliedTo); }, [appliedFrom, appliedTo]);
  useEffect(() => { loadTransportes(); }, []);

  const applyFilter = () => { setAppliedFrom(from); setAppliedTo(to); };

  // Búsqueda de cliente
  useEffect(() => {
    if (!custQuery.trim()) { setCustResults([]); return; }
    clearTimeout(custTimer.current);
    custTimer.current = setTimeout(async () => {
      try {
        const { data } = await searchCustomers(custQuery);
        setCustResults(data || []);
      } catch { /* silencioso */ }
    }, 280);
    return () => clearTimeout(custTimer.current);
  }, [custQuery]);

  const selectCustomer = (c) => {
    setCustSel(c);
    setCustQuery(c.name);
    setCustResults([]);
    // Auto-fill transporte por razon_social (case insensitive)
    if (c.transporte && transportes.length) {
      const match = transportes.find(
        (t) => t.razon_social.toLowerCase() === c.transporte.toLowerCase()
      );
      if (match) setTranspId(match.id);
    }
  };

  const resetForm = () => {
    setCustSel(null); setCustQuery(""); setCustResults([]);
    setTranspId(""); setEnvia(user?.name || "");
    setBultos(1); setValor(""); setSaving(false);
  };

  const openNew  = () => { resetForm(); setCreating(true); };
  const cancelNew = () => { resetForm(); setCreating(false); };

  const save = async () => {
    if (!transpId) { addToast("Seleccioná un transporte", "error"); return; }
    if (!envia.trim()) { addToast("Indicá quién envía", "error"); return; }
    if (!bultos || Number(bultos) < 1) { addToast("Indicá la cantidad de bultos", "error"); return; }
    setSaving(true);
    try {
      await createTransportRemito({
        customer_id:   custSel?.id   || null,
        customer_name: custSel?.name || null,
        transporte_id: transpId,
        envia,
        bultos:  Number(bultos),
        valor:   valor ? Number(valor) : null,
      });
      addToast("Remito de transporte creado", "success");
      cancelNew();
      await loadList();
    } catch {
      addToast("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar este remito de transporte?")) return;
    try {
      await deleteTransportRemito(id);
      addToast("Eliminado", "success");
      await loadList();
    } catch {
      addToast("Error al eliminar", "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ToastContainer />

      {/* Filtros */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <span className="input-label">Desde</span>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 140 }} />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <span className="input-label">Hasta</span>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 140 }} />
        </div>
        <button
          className={`btn ${filterDirty ? "btn-primary" : "btn-ghost"}`}
          onClick={applyFilter}
          style={{ alignSelf: "flex-end" }}
        >
          Aplicar
        </button>
        <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={openNew}>
          + Nuevo remito de transporte
        </button>
      </div>

      {/* Formulario de creación */}
      {creating && (
        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--text)" }}>
            Nuevo remito de transporte
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {/* Cliente */}
            <div style={{ position: "relative" }}>
              <div className="input-label">Cliente (opcional)</div>
              <input
                className="input"
                value={custQuery}
                onChange={(e) => { setCustQuery(e.target.value); if (!e.target.value) setCustSel(null); }}
                placeholder="Buscar por nombre o CUIT..."
              />
              {custResults.length > 0 && (
                <div style={{
                  position: "absolute", zIndex: 50, top: "100%", left: 0, right: 0,
                  background: "var(--bg2)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,.15)",
                  maxHeight: 200, overflowY: "auto",
                }}>
                  {custResults.map((c) => (
                    <div
                      key={c.id}
                      onMouseDown={() => selectCustomer(c)}
                      style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg3)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = ""}
                    >
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      {c.document && <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>{c.document}</span>}
                      {c.transporte && <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 8 }}>🚚 {c.transporte}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transporte */}
            <div>
              <div className="input-label">Transporte *</div>
              <select
                className="select"
                value={transpId}
                onChange={(e) => setTranspId(e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {transportes.map((t) => (
                  <option key={t.id} value={t.id}>{t.razon_social}</option>
                ))}
              </select>
            </div>

            {/* Envía */}
            <div>
              <div className="input-label">Envía *</div>
              <input
                className="input"
                value={envia}
                onChange={(e) => setEnvia(e.target.value)}
                placeholder="Nombre de quien envía"
              />
            </div>

            {/* Bultos */}
            <div>
              <div className="input-label">Cantidad de bultos *</div>
              <input
                className="input"
                type="number"
                min={1}
                value={bultos}
                onChange={(e) => setBultos(e.target.value)}
              />
            </div>

            {/* Valor */}
            <div>
              <div className="input-label">Valor aproximado</div>
              <input
                className="input"
                type="number"
                min={0}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button className="btn btn-ghost" onClick={cancelNew}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>Cargando...</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
          No hay remitos de transporte en este período.
        </div>
      ) : (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg3)", borderBottom: "1px solid var(--border)" }}>
                {["N° Remito","Fecha","Cliente","Transporte","Envía","Bultos","Valor",""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < list.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12 }}>{nroRemito(r.numero)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12 }}>{fmtDate(r.created_at)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{r.customer_name || <span style={{ color: "var(--text-dim)" }}>—</span>}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13 }}>{r.transporte_nombre || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12 }}>{r.envia}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 13, textAlign: "right" }}>{r.bultos}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, textAlign: "right" }}>
                    {r.valor ? `$${fmtMoney(r.valor)}` : <span style={{ color: "var(--text-dim)" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: "4px 8px" }}
                        title="Imprimir remito"
                        onClick={() => printRemitoTransporte(r)}
                      >
                        🖨 Remito
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: "4px 8px" }}
                        title="Imprimir etiquetas de envío"
                        onClick={() => printEtiquetasEnvio(r)}
                      >
                        🏷 Etiquetas
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: "4px 8px", color: "var(--danger)" }}
                        onClick={() => remove(r.id)}
                      >
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
    </div>
  );
}
