import { useState, useEffect } from "react";
import { getRecordatorios, marcarRecordatorioLeido, marcarTodosRecordatoriosLeidos } from "../utils/api";
import { useToast } from "../utils/useToast";

const fmtFecha = (d) =>
  new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });

const fmtMonto = (n) =>
  Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const diasDesde = (d) =>
  Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

export default function Recordatorios() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast, ToastContainer } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getRecordatorios();
      setItems(data);
    } catch {
      addToast("Error cargando recordatorios", "error");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const marcarLeido = async (id) => {
    try {
      await marcarRecordatorioLeido(id);
      setItems((prev) => {
        const updated = prev.map((r) => r.id === id ? { ...r, leido: true } : r);
        if (updated.every((r) => r.leido)) {
          window.dispatchEvent(new CustomEvent('recordatorios-todos-leidos'));
        }
        return updated;
      });
    } catch {
      addToast("Error al marcar como leído", "error");
    }
  };

  const marcarTodos = async () => {
    try {
      await marcarTodosRecordatoriosLeidos();
      setItems((prev) => prev.map((r) => ({ ...r, leido: true })));
      window.dispatchEvent(new CustomEvent('recordatorios-todos-leidos'));
    } catch {
      addToast("Error", "error");
    }
  };

  const pendientes = items.filter((r) => !r.leido);
  const leidos     = items.filter((r) => r.leido);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 16px" }}>
      <ToastContainer />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>Recordatorios</div>
          {pendientes.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              {pendientes.length} sin leer
            </div>
          )}
        </div>
        {pendientes.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={marcarTodos}>
            Marcar todos como leídos
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--text-dim)" }}>Cargando...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "64px", textAlign: "center", color: "var(--text-dim)", fontSize: 14 }}>
          No hay recordatorios
        </div>
      ) : (
        <>
          {pendientes.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                Nuevos
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pendientes.map((r) => (
                  <RecordatorioCard key={r.id} r={r} onLeer={marcarLeido} />
                ))}
              </div>
            </div>
          )}

          {leidos.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                Leídos
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {leidos.map((r) => (
                  <RecordatorioCard key={r.id} r={r} leido />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RecordatorioCard({ r, onLeer, leido }) {
  const dias = diasDesde(r.last_order_date);

  return (
    <div style={{
      padding: "14px 18px",
      borderRadius: 8,
      border: `1px solid ${leido ? "var(--border)" : "var(--accent)"}`,
      background: leido ? "var(--bg2)" : "var(--accent-light)",
      display: "flex", alignItems: "flex-start", gap: 14,
      opacity: leido ? 0.65 : 1,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: leido ? "var(--bg3)" : "var(--accent-dim)",
        border: `2px solid ${leido ? "var(--border)" : "var(--accent)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18,
      }}>
        🔔
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>
          {r.customer_name}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Sin compras hace <strong>{dias} días</strong>
          {r.last_order_total && (
            <> · Última compra: <strong>{fmtMonto(r.last_order_total)}</strong></>
          )}
          {r.last_order_date && (
            <> · {fmtFecha(r.last_order_date)}</>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
          Recordatorio generado el {fmtFecha(r.created_at)}
        </div>
      </div>
      {!leido && onLeer && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ flexShrink: 0, fontSize: 11 }}
          onClick={() => onLeer(r.id)}
        >
          Marcar leído
        </button>
      )}
    </div>
  );
}
