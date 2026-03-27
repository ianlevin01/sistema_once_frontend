import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import { getCashMovements, createCashMovement } from "../utils/api";
import { useToast } from "../utils/useToast";

const SOURCES = ["venta", "gasto", "ajuste", "retiro", "ingreso manual", "otro"];
const EMPTY = { type: "ingreso", source: "venta", amount: "" };

export default function Cash() {
  const today = () => new Date().toISOString().slice(0, 10);

  const [movements, setMovements] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [from,        setFrom]        = useState(today());
  const [to,          setTo]          = useState(today());
  const [appliedFrom, setAppliedFrom] = useState(today());
  const [appliedTo,   setAppliedTo]   = useState(today());
  const filterDirty = from !== appliedFrom || to !== appliedTo;
  const { addToast, ToastContainer } = useToast();

  const load = async (f = appliedFrom, t = appliedTo) => {
    setLoading(true);
    try { const { data } = await getCashMovements(f, t); setMovements(data); }
    catch { addToast("Error cargando movimientos", "error"); }
    setLoading(false);
  };

  const applyFilter = () => {
    setAppliedFrom(from);
    setAppliedTo(to);
    load(from, to);
  };

  useEffect(() => { load(today(), today()); }, []);

  const totalIngreso = movements.filter((m) => m.type === "ingreso").reduce((a, m) => a + Number(m.amount), 0);
  const totalEgreso  = movements.filter((m) => m.type === "egreso" ).reduce((a, m) => a + Number(m.amount), 0);
  const saldo        = totalIngreso - totalEgreso;

  const handleSave = async () => {
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
      addToast("Ingresá un monto válido", "error"); return;
    }
    try {
      await createCashMovement({ ...form, amount: Number(form.amount) });
      addToast("Movimiento registrado", "success");
      setModal(false); setForm(EMPTY); load(appliedFrom, appliedTo);
    } catch { addToast("Error registrando movimiento", "error"); }
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <>
      <ToastContainer />

      {/* Filtro fechas */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
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
          <button className="btn btn-primary btn-sm" onClick={applyFilter}>Filtrar</button>
        )}
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Ingresos</div>
          <div className="stat-value success">${totalIngreso.toLocaleString("es-AR")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Egresos</div>
          <div className="stat-value danger">${totalEgreso.toLocaleString("es-AR")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Saldo</div>
          <div className={`stat-value ${saldo >= 0 ? "accent" : "danger"}`}>
            ${saldo.toLocaleString("es-AR")}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal(true); }}>
          + Nuevo movimiento
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Movimientos de caja</span>
          <span className="badge badge-info">{movements.length}</span>
        </div>

        {loading ? <div className="empty">Cargando...</div> : movements.length === 0 ? (
          <div className="empty">Sin movimientos</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Fuente</th><th>Monto</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className={`badge ${m.type === "ingreso" ? "badge-success" : "badge-danger"}`}>
                        {m.type}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{m.source || "—"}</td>
                    <td style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      color: m.type === "ingreso" ? "var(--success)" : "var(--danger)",
                    }}>
                      {m.type === "egreso" ? "−" : "+"}${Number(m.amount).toLocaleString("es-AR")}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {m.created_at ? new Date(m.created_at).toLocaleDateString("es-AR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title="Nuevo movimiento"
          onClose={() => setModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>Registrar</button>
            </>
          }
        >
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Tipo</label>
              <select className="select" value={form.type} onChange={f("type")}>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Fuente</label>
              <select className="select" value={form.source} onChange={f("source")}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Monto ($)</label>
            <input className="input" type="number" min="0" value={form.amount} onChange={f("amount")} placeholder="0.00" />
          </div>
        </Modal>
      )}
    </>
  );
}
