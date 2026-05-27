import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  getRentabilidadStats,
  getGastosFijos, createGastoFijo, updateGastoFijo, deleteGastoFijo,
} from "../utils/api";
import { useToast } from "../utils/useToast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayArg() {
  return new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });
}

function firstOfMonth(date) {
  const d = new Date(date + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("sv");
}

function lastOfMonth(date) {
  const d = new Date(date + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString("sv");
}

function prevMonthRange() {
  const today = new Date(todayArg() + "T00:00:00");
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const last  = new Date(today.getFullYear(), today.getMonth(), 0);
  return {
    from: first.toLocaleDateString("sv"),
    to:   last.toLocaleDateString("sv"),
  };
}

function fmtARS(n) {
  if (n === null || n === undefined) return "$0";
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n);
}

function fmtNum(n) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n ?? 0);
}

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b"];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, sub, icon }) {
  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderTop: `3px solid ${color || "var(--accent)"}`,
      borderRadius: "var(--radius)",
      padding: "18px 20px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 5,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{
          fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: ".07em", lineHeight: 1.4,
        }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: 17, opacity: 0.55, marginTop: -2 }}>{icon}</span>}
      </div>
      <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", lineHeight: 1.15 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{sub}</span>
      )}
    </div>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ children, style }) {
  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "18px 22px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "var(--text-dim)",
      fontFamily: "var(--font-mono)", textTransform: "uppercase",
      letterSpacing: ".07em", marginBottom: 14, paddingBottom: 8,
      borderBottom: "1px solid var(--border)",
    }}>
      {children}
    </div>
  );
}

// ─── Pie chart custom label ───────────────────────────────────────────────────

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={12} fontWeight={600}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
}

// ─── Gastos Fijos Panel ───────────────────────────────────────────────────────

function GastosFijosPanel({ gastos, onRefresh }) {
  const toast = useToast();
  const [desc,   setDesc]   = useState("");
  const [monto,  setMonto]  = useState("");
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  function startEdit(g) {
    setEditId(g.id);
    setDesc(g.descripcion);
    setMonto(String(g.monto));
  }

  function cancelEdit() {
    setEditId(null);
    setDesc("");
    setMonto("");
  }

  async function handleSave() {
    if (!desc.trim() || !monto) return;
    setSaving(true);
    try {
      if (editId) {
        await updateGastoFijo(editId, { descripcion: desc, monto: Number(monto) });
        toast.success("Gasto actualizado");
      } else {
        await createGastoFijo({ descripcion: desc, monto: Number(monto) });
        toast.success("Gasto agregado");
      }
      setDesc(""); setMonto(""); setEditId(null);
      onRefresh();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("¿Eliminar este gasto fijo?")) return;
    try {
      await deleteGastoFijo(id);
      toast.success("Gasto eliminado");
      onRefresh();
    } catch {
      toast.error("Error al eliminar");
    }
  }

  const total = gastos.reduce((acc, g) => acc + Number(g.monto), 0);

  return (
    <Panel>
      <SectionTitle>Gastos Fijos Mensuales</SectionTitle>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Descripción (ej: Alquiler)"
          style={{
            flex: 1, padding: "7px 10px", borderRadius: "var(--radius)",
            border: "1px solid var(--border)", background: "var(--bg3)",
            color: "var(--text)", fontSize: 13,
          }}
        />
        <input
          value={monto}
          onChange={e => setMonto(e.target.value)}
          placeholder="Monto ARS"
          type="number"
          min="0"
          style={{
            width: 140, padding: "7px 10px", borderRadius: "var(--radius)",
            border: "1px solid var(--border)", background: "var(--bg3)",
            color: "var(--text)", fontSize: 13,
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving || !desc.trim() || !monto}
          style={{
            padding: "7px 16px", borderRadius: "var(--radius)",
            border: "none", background: "var(--accent)",
            color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
            opacity: (!desc.trim() || !monto) ? 0.5 : 1,
          }}
        >
          {editId ? "Actualizar" : "Agregar"}
        </button>
        {editId && (
          <button
            onClick={cancelEdit}
            style={{
              padding: "7px 12px", borderRadius: "var(--radius)",
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--text-dim)", cursor: "pointer", fontSize: 13,
            }}
          >
            Cancelar
          </button>
        )}
      </div>

      {gastos.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
          No hay gastos fijos registrados
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {gastos.map(g => (
              <tr key={g.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 0", color: "var(--text)" }}>{g.descripcion}</td>
                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                  {fmtARS(Number(g.monto))}
                </td>
                <td style={{ padding: "8px 0 8px 12px", whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => startEdit(g)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 12, marginRight: 8 }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 12 }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding: "10px 0 4px", fontWeight: 700, color: "var(--text)" }}>Total mensual</td>
              <td style={{ padding: "10px 0 4px", textAlign: "right", fontWeight: 700, color: "var(--danger)", fontFamily: "var(--font-mono)" }}>
                {fmtARS(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </Panel>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Rentabilidad() {
  const toast = useToast();
  const today = todayArg();

  const [from,    setFrom]    = useState(firstOfMonth(today));
  const [to,      setTo]      = useState(today);
  const [stats,   setStats]   = useState(null);
  const [gastos,  setGastos]  = useState([]);
  const [loading, setLoading] = useState(false);

  const loadGastos = useCallback(async () => {
    try {
      const r = await getGastosFijos();
      setGastos(r.data);
    } catch { /* silencioso */ }
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getRentabilidadStats(from, to);
      setStats(r.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Error al cargar estadísticas");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { loadGastos(); }, [loadGastos]);
  useEffect(() => { loadStats();  }, [loadStats]);

  function setCurrentMonth() { setFrom(firstOfMonth(today)); setTo(today); }
  function setPrevMonth()    { const r = prevMonthRange(); setFrom(r.from); setTo(r.to); }

  // Pie data
  const pieData = stats ? [
    { name: "Clientes",         value: Math.max(0, stats.clientes_total)         },
    { name: "Cons. Final",      value: Math.max(0, stats.consumidor_final_total) },
    { name: "Web",              value: Math.max(0, stats.web_presupuesto_total)  },
  ].filter(d => d.value > 0) : [];

  // Trend data
  const trendData = stats?.daily_trend?.map(r => ({
    fecha:   r.fecha?.slice(0, 10),
    nominal: Math.round(Number(r.nominal || 0)),
  })) || [];

  const gananciaColor = (n) =>
    n === null || n === undefined ? "var(--text)" : n >= 0 ? "#10b981" : "var(--danger)";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 0 52px" }}>

      {/* ── Filtros de fecha ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 28,
        flexWrap: "wrap", paddingBottom: 20, borderBottom: "1px solid var(--border)",
      }}>
        <button onClick={setCurrentMonth} style={quickBtnStyle}>Mes actual</button>
        <button onClick={setPrevMonth}    style={quickBtnStyle}>Mes anterior</button>
        <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>Desde</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={dateInputStyle} />
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>Hasta</span>
        <input type="date" value={to}   onChange={e => setTo(e.target.value)}   style={dateInputStyle} />
        <button onClick={loadStats} disabled={loading} style={applyBtnStyle}>
          {loading ? "Cargando…" : "Aplicar"}
        </button>
      </div>

      {loading && !stats && (
        <div style={{ color: "var(--text-dim)", fontSize: 14, padding: "60px 0", textAlign: "center" }}>
          Cargando estadísticas…
        </div>
      )}

      {stats && (
        <>
          {/* ── KPI row: 3 columns × 2 rows ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
            <KpiCard
              label="Ganancia Nominal"
              value={fmtARS(stats.ganancia_nominal)}
              color={gananciaColor(stats.ganancia_nominal)}
              sub={`Bruta: ${fmtARS(stats.ganancia_bruta_nominal)}`}
              icon="📊"
            />
            <KpiCard
              label="Ganancia Real"
              value={fmtARS(stats.ganancia_real)}
              color={gananciaColor(stats.ganancia_real)}
              sub={`Bruta: ${fmtARS(stats.ganancia_bruta_real)}`}
              icon="💰"
            />
            <KpiCard
              label="Gastos Fijos (período)"
              value={fmtARS(stats.gastos_fijos_prorrateados)}
              color="var(--danger)"
              sub={`Mensual: ${fmtARS(stats.gastos_fijos_mensual)}`}
              icon="🏢"
            />
            <KpiCard
              label="Ventas Totales"
              value={fmtARS(stats.presupuesto_nominal)}
              color="#6366f1"
              icon="🛒"
            />
            <KpiCard
              label="Clientes Nuevos"
              value={fmtNum(stats.clientes_nuevos)}
              color="#10b981"
              icon="👥"
            />
            <KpiCard
              label="Pedidos Web"
              value={fmtNum(stats.pedidos_web_count)}
              color="#f59e0b"
              sub={`Total: ${fmtARS(stats.pedidos_web_total)}`}
              icon="🌐"
            />
          </div>

          {/* ── Desglose nominal vs real ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

            {/* Nominal */}
            <Panel>
              <SectionTitle>Ganancia Nominal</SectionTitle>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  <DesgRow label="Ventas (todos)"          val={stats.presupuesto_nominal}       sign={1}  />
                  <DesgRow label="Devol. a proveedor"      val={stats.devol_prov_total}           sign={1}  />
                  <DesgRow label="Reposiciones"            val={stats.reposicion_total}           sign={-1} />
                  <DesgRow label="Devoluciones"            val={stats.devolucion_total}           sign={-1} />
                  <DesgRow label="Gastos fijos (período)"  val={stats.gastos_fijos_prorrateados} sign={-1} bold />
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)" }}>
                    <td style={{ padding: "10px 0 4px", fontWeight: 700, color: "var(--text)" }}>Total</td>
                    <td style={{
                      padding: "10px 0 4px", textAlign: "right", fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color: stats.ganancia_nominal >= 0 ? "#10b981" : "var(--danger)",
                    }}>
                      {fmtARS(stats.ganancia_nominal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Panel>

            {/* Real */}
            <Panel>
              <SectionTitle>Ganancia Real (efectivo cobrado)</SectionTitle>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  <DesgRow label="Ventas cobradas (excl. CC)"      val={stats.presupuesto_real}          sign={1}  />
                  <DesgRow label="Devol. a proveedor (excl. CC)"   val={stats.devol_prov_real}           sign={1}  />
                  <DesgRow label="Cobranzas clientes"              val={stats.cc_clientes_haber}         sign={1}  />
                  <DesgRow label="Cobranzas prov. (haber)"         val={stats.cc_prov_haber}             sign={1}  />
                  <DesgRow label="Cobranzas prov. (debe)"          val={stats.cc_prov_debe}              sign={-1} />
                  <DesgRow label="Reposiciones (excl. CC)"         val={stats.reposicion_real}           sign={-1} />
                  <DesgRow label="Devoluciones (excl. CC)"         val={stats.devolucion_real}           sign={-1} />
                  <DesgRow label="Gastos fijos (período)"          val={stats.gastos_fijos_prorrateados} sign={-1} bold />
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)" }}>
                    <td style={{ padding: "10px 0 4px", fontWeight: 700, color: "var(--text)" }}>Total</td>
                    <td style={{
                      padding: "10px 0 4px", textAlign: "right", fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color: stats.ganancia_real >= 0 ? "#10b981" : "var(--danger)",
                    }}>
                      {fmtARS(stats.ganancia_real)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Panel>
          </div>

          {/* ── Distribución + Resumen ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

            {/* Pie chart */}
            <Panel>
              <SectionTitle>Distribución de ventas</SectionTitle>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={195}>
                    <PieChart>
                      <Pie
                        data={pieData} cx="50%" cy="50%"
                        outerRadius={78} dataKey="value"
                        labelLine={false} label={PieLabel}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => fmtARS(v)} />
                      <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginTop: 4 }}>
                    <tbody>
                      {[
                        { label: "Clientes",        val: stats.clientes_total,         color: PIE_COLORS[0] },
                        { label: "Consumidor Final", val: stats.consumidor_final_total, color: PIE_COLORS[1] },
                        { label: "Web",              val: stats.web_presupuesto_total,  color: PIE_COLORS[2] },
                      ].map(({ label, val, color }) => (
                        <tr key={label} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "5px 0", color: "var(--text-dim)" }}>
                            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: color, marginRight: 7 }} />
                            {label}
                          </td>
                          <td style={{ padding: "5px 0", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text)" }}>
                            {fmtARS(val)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "30px 0", textAlign: "center" }}>
                  Sin datos de ventas
                </div>
              )}
            </Panel>

            {/* Resumen métricas */}
            <Panel>
              <SectionTitle>Resumen del período</SectionTitle>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {[
                    { label: "Ventas a clientes",       val: fmtARS(stats.clientes_total)         },
                    { label: "Ventas consumidor final",  val: fmtARS(stats.consumidor_final_total) },
                    { label: "Ventas web",               val: fmtARS(stats.web_presupuesto_total)  },
                    { label: "Pedidos web (cantidad)",   val: fmtNum(stats.pedidos_web_count)      },
                    { label: "Clientes nuevos",          val: fmtNum(stats.clientes_nuevos)        },
                    { label: "Reposiciones",             val: fmtARS(stats.reposicion_total)       },
                    { label: "Devoluciones",             val: fmtARS(stats.devolucion_total)       },
                  ].map(({ label, val }, i) => (
                    <tr key={label} style={{
                      borderBottom: "1px solid var(--border)",
                      background: i % 2 === 0 ? "transparent" : "var(--bg3)",
                    }}>
                      <td style={{ padding: "7px 6px", color: "var(--text-dim)" }}>{label}</td>
                      <td style={{ padding: "7px 6px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text)" }}>
                        {val}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          {/* ── Tendencia diaria ── */}
          {trendData.length > 0 && (
            <Panel style={{ marginBottom: 20 }}>
              <SectionTitle>Tendencia diaria — ganancia nominal bruta</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 8, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="fecha"
                    tick={{ fontSize: 11, fill: "var(--text-dim)" }}
                    tickFormatter={d => d?.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-dim)" }}
                    tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(v) => [fmtARS(v), "Ganancia"]}
                    labelFormatter={l => `Fecha: ${l}`}
                    contentStyle={{
                      background: "var(--bg2)", border: "1px solid var(--border)",
                      borderRadius: 6, fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone" dataKey="nominal"
                    stroke="#6366f1" strokeWidth={2.5}
                    dot={false} activeDot={{ r: 4, fill: "#6366f1" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          )}
        </>
      )}

      {/* ── Gastos Fijos Panel ── */}
      <GastosFijosPanel gastos={gastos} onRefresh={loadGastos} />
    </div>
  );
}

// ─── Fila de desglose ─────────────────────────────────────────────────────────

function DesgRow({ label, val, sign, bold }) {
  const ars     = Math.round(Number(val || 0));
  const display = sign < 0 ? fmtARS(-ars) : fmtARS(ars);
  const color   = sign < 0 ? "var(--danger)" : (ars > 0 ? "#10b981" : "var(--text-dim)");

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "7px 0", color: bold ? "var(--text)" : "var(--text-dim)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, marginRight: 6, opacity: 0.6 }}>
          {sign < 0 ? "−" : "+"}
        </span>
        {label}
      </td>
      <td style={{
        padding: "7px 0", textAlign: "right",
        fontFamily: "var(--font-mono)", fontWeight: bold ? 700 : 500,
        color,
      }}>
        {display}
      </td>
    </tr>
  );
}

// ─── Estilos inline reutilizables ─────────────────────────────────────────────

const quickBtnStyle = {
  padding: "6px 14px", borderRadius: "var(--radius)",
  border: "1px solid var(--border)", background: "var(--bg3)",
  color: "var(--text)", cursor: "pointer", fontSize: 12,
  fontFamily: "var(--font-mono)",
};
const dateInputStyle = {
  padding: "6px 10px", borderRadius: "var(--radius)",
  border: "1px solid var(--border)", background: "var(--bg3)",
  color: "var(--text)", fontSize: 13,
};
const applyBtnStyle = {
  padding: "6px 18px", borderRadius: "var(--radius)",
  border: "none", background: "var(--accent)",
  color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
};
