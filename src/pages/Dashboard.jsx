import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/useAuth";
import {
  getComprobantes, getWebOrders, getCuentaCorrienteGeneral,
  getCCProveedoresSummary, getCobranzasCC, getClientes,
  getPriceConfig, getDashboardShopStats,
} from "../utils/api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayArg() {
  return new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });
}

function fmtARS(n) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n ?? 0);
}

function fmtUSD(n) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n ?? 0);
}

function greet(name) {
  const h = parseInt(
    new Date().toLocaleString("en-US", {
      hour: "numeric", hour12: false, timeZone: "America/Argentina/Buenos_Aires",
    })
  );
  const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  return name ? `${saludo}, ${name.split(" ")[0]}` : saludo;
}

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hs = Math.floor(mins / 60);
  return `hace ${hs}h`;
}

// ─── sub-componentes ──────────────────────────────────────────────────────────

function Skel({ w = "70%", h = 24 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: "linear-gradient(90deg, var(--bg3) 25%, var(--bg4) 50%, var(--bg3) 75%)",
      backgroundSize: "200% 100%",
      animation: "db-shimmer 1.4s infinite",
    }} />
  );
}

const ACCENT = {
  blue:   "var(--accent)",
  cyan:   "var(--accent2)",
  green:  "var(--success)",
  orange: "var(--warning)",
  red:    "var(--danger)",
};

function StatCard({ label, value, sub, color = "blue", loading }) {
  const c = ACCENT[color] || ACCENT.blue;
  return (
    <div className="stat-card" style={{ borderLeft: `4px solid ${c}` }}>
      <div className="stat-label">{label}</div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
          <Skel h={26} />
          <Skel h={14} w="55%" />
        </div>
      ) : (
        <>
          <div className="stat-value" style={{ color: c, fontSize: 21, lineHeight: 1.15 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
              {sub}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [d, setD]             = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setD(null);
    const today = todayArg();

    Promise.all([
      getComprobantes(today, today).catch(() => ({ data: [] })),              // 0
      getWebOrders({ from: today, to: today }).catch(() => ({ data: [] })),   // 1
      getWebOrders({ reservado: false }).catch(() => ({ data: [] })),         // 2
      getCuentaCorrienteGeneral().catch(() => ({ data: [] })),                // 3
      getCCProveedoresSummary().catch(() => ({ data: [] })),                  // 4
      getCobranzasCC(today, today).catch(() => ({ data: [] })),               // 5
      getClientes().catch(() => ({ data: [] })),                              // 6
      getPriceConfig().catch(() => ({ data: { cotizacion_dolar: 1 } })),     // 7
      getDashboardShopStats(today).catch(() => ({ data: { new_users: 0 } })), // 8
    ])
      .then(([compR, webR, pendR, ccR, provR, cobR, cliR, cfgR, shopR]) => {
        const cotiz = Number(cfgR.data?.cotizacion_dolar || 1);

        // presupuestos del día (excluye eliminados)
        const comps   = Array.isArray(compR.data) ? compR.data : [];
        const presups = comps.filter((c) => c.tipo === "Presupuesto" && !c.deleted_at);

        // facturado en USD (convirtiendo ARS según cotización)
        const facturadoUSD = presups.reduce((acc, c) => {
          const t = Number(c.total || 0);
          return acc + (c.divisa === "USD" ? t : t / cotiz);
        }, 0);

        // pedidos web hoy
        const webHoy = Array.isArray(webR.data) ? webR.data : [];

        // pedidos web pendientes (sin reservar) — más recientes primero, top 5
        const webPend = (Array.isArray(pendR.data) ? pendR.data : [])
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);

        // deuda clientes (cuenta corriente)
        const cc = Array.isArray(ccR.data) ? ccR.data : [];
        const ccARS = cc
          .filter((x) => (x.divisa ?? "ARS") === "ARS" && Number(x.saldo) > 0)
          .reduce((a, x) => a + Number(x.saldo), 0);
        const ccUSD = cc
          .filter((x) => x.divisa === "USD" && Number(x.saldo) > 0)
          .reduce((a, x) => a + Number(x.saldo), 0);

        // deuda a proveedores
        const prov = Array.isArray(provR.data) ? provR.data : [];
        const provARS = prov
          .filter((x) => (x.cc_divisa ?? "ARS") === "ARS" && Number(x.saldo) > 0)
          .reduce((a, x) => a + Number(x.saldo), 0);
        const provUSD = prov
          .filter((x) => x.cc_divisa === "USD" && Number(x.saldo) > 0)
          .reduce((a, x) => a + Number(x.saldo), 0);

        // cobranzas hoy
        const cobs    = Array.isArray(cobR.data) ? cobR.data : [];
        const cobTotal = cobs.reduce((a, c) => a + Number(c.monto || 0), 0);

        // nuevos clientes hoy (filtro client-side por fecha argentina)
        const clis = Array.isArray(cliR.data) ? cliR.data : [];
        const nuevosCli = clis.filter((c) => {
          if (!c.created_at) return false;
          return (
            new Date(c.created_at).toLocaleDateString("sv", {
              timeZone: "America/Argentina/Buenos_Aires",
            }) === today
          );
        }).length;

        // nuevos usuarios tienda
        const nuevosUsers = shopR.data?.new_users ?? 0;

        // últimos 5 presupuestos del día (más recientes primero)
        const ultimosPresups = [...presups]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);

        setD({
          facturadoUSD,
          presupCount: presups.length,
          webHoyCount: webHoy.length,
          webHoyTotal: webHoy.reduce((a, o) => a + Number(o.total || 0), 0),
          webPend,
          ccARS, ccUSD,
          provARS, provUSD,
          cobTotal,
          nuevosCli,
          nuevosUsers,
          ultimosPresups,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const dateFmt = (() => {
    const s = new Date().toLocaleDateString("es-AR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      timeZone: "America/Argentina/Buenos_Aires",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  return (
    <>
      <style>{`
        @keyframes db-shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{ padding: "28px 32px" }}>

        {/* ── Encabezado ──────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 28,
          padding: "20px 24px",
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderLeft: "4px solid var(--accent)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div>
            <h2 style={{
              margin: 0, fontSize: 20, fontWeight: 700,
              color: "var(--text)", fontFamily: "var(--font-sans)",
            }}>
              {greet(user?.name)}
            </h2>
            <div style={{ marginTop: 3, fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              {dateFmt}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            ↻ Actualizar
          </button>
        </div>

        {/* ── KPIs principales (4 columnas) ───────────────────────────── */}
        <div className="stats-row" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 14 }}>
          <StatCard
            label="Facturado hoy (USD)"
            value={d ? fmtUSD(d.facturadoUSD) : "—"}
            sub={d ? `${d.presupCount} presupuesto${d.presupCount !== 1 ? "s" : ""}` : null}
            color="blue"
            loading={loading}
          />
          <StatCard
            label="Pedidos web hoy"
            value={d ? String(d.webHoyCount) : "—"}
            sub={d ? (d.webHoyTotal > 0 ? fmtARS(d.webHoyTotal) : "Sin pedidos") : null}
            color="cyan"
            loading={loading}
          />
          <StatCard
            label="Deuda clientes"
            value={d ? fmtARS(d.ccARS) : "—"}
            sub={d ? (d.ccUSD > 0 ? `+ ${fmtUSD(d.ccUSD)} USD` : null) : null}
            color="orange"
            loading={loading}
          />
          <StatCard
            label="Deuda a proveedores"
            value={d ? fmtARS(d.provARS) : "—"}
            sub={d ? (d.provUSD > 0 ? `+ ${fmtUSD(d.provUSD)} USD` : null) : null}
            color="red"
            loading={loading}
          />
        </div>

        {/* ── KPIs secundarios (3 columnas) ───────────────────────────── */}
        <div className="stats-row" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 28 }}>
          <StatCard
            label="Cobranzas del día"
            value={d ? fmtARS(d.cobTotal) : "—"}
            sub={d ? (d.cobTotal === 0 ? "Sin cobranzas hoy" : null) : null}
            color="green"
            loading={loading}
          />
          <StatCard
            label="Nuevos clientes hoy"
            value={d ? String(d.nuevosCli) : "—"}
            sub={d && d.nuevosCli === 0 ? "Sin altas hoy" : null}
            color="blue"
            loading={loading}
          />
          <StatCard
            label="Nuevos usuarios tienda"
            value={d ? String(d.nuevosUsers) : "—"}
            sub={d && d.nuevosUsers === 0 ? "Sin registros hoy" : null}
            color="cyan"
            loading={loading}
          />
        </div>

        {/* ── Listas ──────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Últimos presupuestos del día */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card-header" style={{ padding: "14px 20px", marginBottom: 0 }}>
              <span className="card-title">Últimos presupuestos del día</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/comprobantes")}>
                Ver todos →
              </button>
            </div>

            {loading ? (
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[...Array(4)].map((_, i) => <Skel key={i} h={34} />)}
              </div>
            ) : !d?.ultimosPresups?.length ? (
              <div className="empty" style={{ padding: "36px 20px" }}>
                Sin presupuestos hoy
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {d.ultimosPresups.map((p, i) => (
                    <tr
                      key={p.id}
                      style={{
                        borderTop: i > 0 ? "1px solid var(--border)" : "none",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg3)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                      onClick={() => navigate(`/comprobantes/editar/${p.id}`)}
                    >
                      <td style={{ padding: "10px 20px", fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                        {p.customer_name || p.consumidor_final_nombre || "Consumidor final"}
                      </td>
                      <td style={{ padding: "10px 8px", fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                        {p.payment_method || "—"}
                      </td>
                      <td style={{ padding: "10px 20px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent)" }}>
                          {p.divisa === "USD" ? fmtUSD(p.total) : fmtARS(p.total)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pedidos web pendientes */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card-header" style={{ padding: "14px 20px", marginBottom: 0 }}>
              <span className="card-title">
                Pedidos web pendientes
                {!loading && d?.webPend?.length > 0 && (
                  <span style={{
                    marginLeft: 8, fontSize: 11, fontFamily: "var(--font-mono)",
                    background: "var(--warning-dim)", color: "var(--warning)",
                    border: "1px solid var(--warning)", borderRadius: 4,
                    padding: "1px 7px",
                  }}>
                    {d.webPend.length}
                  </span>
                )}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/pedidos-web")}>
                Ver todos →
              </button>
            </div>

            {loading ? (
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[...Array(4)].map((_, i) => <Skel key={i} h={44} />)}
              </div>
            ) : !d?.webPend?.length ? (
              <div className="empty" style={{ padding: "36px 20px" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
                Sin pedidos pendientes
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {d.webPend.map((o, i) => (
                    <tr
                      key={o.id}
                      style={{
                        borderTop: i > 0 ? "1px solid var(--border)" : "none",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg3)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                      onClick={() => navigate("/pedidos-web")}
                    >
                      <td style={{ padding: "10px 20px" }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                          {o.customer_name || "—"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                          {o.numero ? `#${o.numero}` : ""}{o.numero && o.created_at ? " · " : ""}{o.created_at ? timeAgo(o.created_at) : ""}
                        </div>
                      </td>
                      <td style={{ padding: "10px 20px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent2)" }}>
                          {fmtARS(o.total)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
