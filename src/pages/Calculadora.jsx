import { useState } from "react";
import { useAuth } from "../utils/useAuth";
import { calcGanancia, TRAMOS } from "../utils/calcGanancia";

const FMT = (v) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 });

export default function Calculadora() {
  const { user } = useAuth();
  const pctVendedor = Number(user?.pct_vendedor ?? 0);

  const [precio1,     setPrecio1]     = useState("");
  const [porcentaje,  setPorcentaje]  = useState(String(pctVendedor));
  const [cantidad,    setCantidad]    = useState("1");

  // precio de venta se calcula desde precio1 + porcentaje
  const precio1N    = Number(precio1    || 0);
  const porcentajeN = Number(porcentaje || 0);
  const cantidadN   = Math.max(1, Number(cantidad || 1));

  const precioVenta = precio1N * (1 + porcentajeN / 100);
  const hayDatos    = precio1N > 0 && precioVenta > precio1N;

  const resultado = hayDatos
    ? calcGanancia({ precio1: precio1N, precioVenta, cantidad: cantidadN })
    : null;

  // Para mostrar en qué tramo estás y cuánto falta para el siguiente
  const tramosOrdenados = [...TRAMOS].reverse(); // de menor a mayor
  const tramoActual = resultado
    ? TRAMOS.find((t) => resultado.gananciaBruta >= t.desde)
    : null;
  const tramoSiguiente = tramoActual
    ? TRAMOS[TRAMOS.indexOf(tramoActual) - 1] ?? null
    : null;
  const faltaParaSiguiente = tramoSiguiente && resultado
    ? tramoSiguiente.desde - resultado.gananciaBruta
    : null;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 8 }}>

      {/* Inputs */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg3)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>🧮 Calculadora de ganancia</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
            Simulá cuánto ganás según precio, porcentaje y cantidad
          </div>
        </div>

        <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Precio base ($)</label>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="10000"
              value={precio1}
              onChange={(e) => setPrecio1(e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600 }}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Tu porcentaje (%)</label>
            <input
              className="input"
              type="number"
              min="0"
              max="999"
              step="0.5"
              placeholder={String(pctVendedor)}
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600 }}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Cantidad</label>
            <input
              className="input"
              type="number"
              min="1"
              placeholder="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600 }}
            />
          </div>
        </div>

        {/* Precio de venta resultante */}
        {precio1N > 0 && (
          <div style={{ padding: "0 20px 16px", display: "flex", gap: 16 }}>
            <div style={{ flex: 1, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 7, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Precio de venta</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>
                ${FMT(precioVenta)}
              </span>
            </div>
            <div style={{ flex: 1, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 7, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Diferencia unitaria</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                ${FMT(precioVenta - precio1N)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Resultado */}
      {resultado ? (
        <>
          {/* Cards de resultado */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "var(--success-dim)", border: "2px solid var(--success)", borderRadius: 10, padding: "18px 20px" }}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Tu ganancia total
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 800, color: "var(--success)" }}>
                ${FMT(resultado.gananciaFinal)}
              </div>
              <div style={{ fontSize: 11, color: "var(--success)", opacity: 0.8, marginTop: 4 }}>
                {resultado.tasa}% de ${FMT(resultado.gananciaBruta)}
              </div>
            </div>

            <div style={{ background: "var(--accent-light)", border: "2px solid var(--accent)", borderRadius: 10, padding: "18px 20px" }}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Ganancia por unidad
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 800, color: "var(--accent)" }}>
                ${FMT(resultado.porUnidad)}
              </div>
              <div style={{ fontSize: 11, color: "var(--accent)", opacity: 0.8, marginTop: 4 }}>
                sobre {cantidadN} unidad{cantidadN !== 1 ? "es" : ""}
              </div>
            </div>
          </div>

          {/* Tramo actual + siguiente */}
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg3)", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Tramo actual
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                    Ganancia bruta: <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>${FMT(resultado.gananciaBruta)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                    {resultado.tramoLabel} → te llevás el <strong style={{ color: "var(--success)" }}>{resultado.tasa}%</strong>
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 800, color: "var(--success)", background: "var(--success-dim)", border: "1px solid var(--success)", borderRadius: 8, padding: "6px 14px" }}>
                  {resultado.tasa}%
                </div>
              </div>

              {faltaParaSiguiente != null && (
                <div style={{ marginTop: 8, padding: "10px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, color: "var(--text-muted)" }}>
                  📈 Te faltan <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>${FMT(faltaParaSiguiente)}</strong> de ganancia bruta para pasar al <strong style={{ color: "var(--success)" }}>{tramoSiguiente.tasa}%</strong>
                </div>
              )}
              {!tramoSiguiente && (
                <div style={{ marginTop: 8, padding: "10px 12px", background: "var(--success-dim)", border: "1px solid var(--success)", borderRadius: 7, fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
                  🏆 ¡Estás en el tramo máximo!
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-dim)", fontSize: 13, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🧮</div>
          Ingresá el precio base y tu porcentaje para ver el resultado
        </div>
      )}

      {/* Tabla de tramos */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg3)", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Tabla de tramos de comisión
        </div>
        {tramosOrdenados.map((t, i) => {
          const esActual = tramoActual?.desde === t.desde;
          const siguiente = tramosOrdenados[i + 1];
          const label = siguiente
            ? `$${t.desde.toLocaleString("es-AR")} — $${(siguiente.desde - 1).toLocaleString("es-AR")}`
            : `Más de $${t.desde.toLocaleString("es-AR")}`;

          return (
            <div key={t.desde} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px",
              borderBottom: i < tramosOrdenados.length - 1 ? "1px solid var(--border)" : "none",
              background: esActual ? "var(--success-dim)" : "transparent",
              borderLeft: esActual ? "3px solid var(--success)" : "3px solid transparent",
              transition: "all 0.15s",
            }}>
              <div>
                <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: esActual ? "var(--success)" : "var(--text)", fontWeight: esActual ? 700 : 400 }}>
                  {label}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                  ganancia bruta {i === tramosOrdenados.length - 1 ? "sin límite" : `hasta $${(siguiente.desde - 1).toLocaleString("es-AR")}`}
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 800, color: esActual ? "var(--success)" : "var(--text-muted)", background: esActual ? "var(--success-dim)" : "var(--bg3)", border: `1px solid ${esActual ? "var(--success)" : "var(--border)"}`, borderRadius: 6, padding: "4px 12px" }}>
                {t.tasa}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}