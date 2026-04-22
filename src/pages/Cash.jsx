import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import { getCashMovements, createCashMovement } from "../utils/api";
import { useToast } from "../utils/useToast";

const SOURCES = ["venta", "gasto", "ajuste", "retiro", "ingreso manual", "otro"];
const EMPTY = { type: "ingreso", source: "venta", amount: "", divisa: "ARS" };

export default function Cash() {
  const today = () => new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });

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

  // Separar movimientos por divisa para los totales
  const movsARS = movements.filter((m) => (m.divisa || "ARS") === "ARS");
  const movsUSD = movements.filter((m) => (m.divisa || "ARS") === "USD");

  const totalIngresoARS = movsARS.filter((m) => m.type === "ingreso").reduce((a, m) => a + Number(m.amount), 0);
  const totalEgresoARS  = movsARS.filter((m) => m.type === "egreso" ).reduce((a, m) => a + Number(m.amount), 0);
  const saldoARS        = totalIngresoARS - totalEgresoARS;

  const totalIngresoUSD = movsUSD.filter((m) => m.type === "ingreso").reduce((a, m) => a + Number(m.amount), 0);
  const totalEgresoUSD  = movsUSD.filter((m) => m.type === "egreso" ).reduce((a, m) => a + Number(m.amount), 0);
  const saldoUSD        = totalIngresoUSD - totalEgresoUSD;

  const fmtARS = (n) => `$${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  const fmtUSD = (n) => `USD ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

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

      {/* Stats ARS */}
      <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
        🪙 Pesos (ARS)
      </div>
      <div className="stats-row" style={{ marginBottom: movsUSD.length > 0 ? 20 : undefined }}>
        <div className="stat-card">
          <div className="stat-label">Ingresos ARS</div>
          <div className="stat-value success">{fmtARS(totalIngresoARS)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Egresos ARS</div>
          <div className="stat-value danger">{fmtARS(totalEgresoARS)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Saldo ARS</div>
          <div className={`stat-value ${saldoARS >= 0 ? "accent" : "danger"}`}>
            {fmtARS(saldoARS)}
          </div>
        </div>
      </div>

      {/* Stats USD — solo si hay movimientos en USD */}
      {movsUSD.length > 0 && (
        <>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
            💵 Dólares (USD)
          </div>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Ingresos USD</div>
              <div className="stat-value success">{fmtUSD(totalIngresoUSD)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Egresos USD</div>
              <div className="stat-value danger">{fmtUSD(totalEgresoUSD)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Saldo USD</div>
              <div className={`stat-value ${saldoUSD >= 0 ? "accent" : "danger"}`}>
                {fmtUSD(saldoUSD)}
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, marginTop: 16 }}>
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
                <tr><th>Tipo</th><th>Fuente</th><th>Divisa</th><th>Monto</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const esUSD = (m.divisa || "ARS") === "USD";
                  return (
                    <tr key={m.id}>
                      <td>
                        <span className={`badge ${m.type === "ingreso" ? "badge-success" : "badge-danger"}`}>
                          {m.type}
                        </span>
                      </td>
                      <td style={{ color:"var(--text-muted)", fontSize:12 }}>{m.source || "—"}</td>
                      <td>
                        <span style={{
                          fontSize:11, fontFamily:"var(--font-mono)",
                          color: esUSD ? "var(--success)" : "var(--text-dim)",
                          background: esUSD ? "rgba(52,211,153,0.1)" : "var(--bg3)",
                          border: `1px solid ${esUSD ? "var(--success)" : "var(--border)"}`,
                          borderRadius:3, padding:"1px 7px",
                        }}>
                          {esUSD ? "USD" : "ARS"}
                        </span>
                      </td>
                      <td style={{
                        fontFamily:"var(--font-mono)", fontWeight:600,
                        color: m.type === "ingreso" ? "var(--success)" : "var(--danger)",
                      }}>
                        {m.type === "egreso" ? "−" : "+"}
                        {esUSD ? fmtUSD(m.amount) : fmtARS(m.amount)}
                      </td>
                      <td style={{ fontSize:12, color:"var(--text-muted)" }}>
                        {m.created_at ? new Date(m.created_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "—"}
                      </td>
                    </tr>
                  );
                })}
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
          <div className="grid-2">
            <div className="input-group">
              <label className="input-label">Divisa</label>
              <select className="select" value={form.divisa} onChange={f("divisa")}>
                <option value="ARS">🪙 Pesos (ARS)</option>
                <option value="USD">💵 Dólares (USD)</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">
                Monto ({form.divisa === "USD" ? "USD" : "$"})
              </label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.amount}
                onChange={f("amount")}
                placeholder="0.00"
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
