import { useState, useEffect, useCallback } from "react";
import Modal from "../components/Modal";
import {
  getCajas, getCajasDestino, createCaja, updateCaja, getCajaUsuarios, setCajaUsuario,
  getCajaResumen, getCajaMovimientos,
  updateCajaMovimiento, deleteCajaMovimiento, transferirEntreCajas,
} from "../utils/api";
import { useToast } from "../utils/useToast";
import { useAuth } from "../utils/useAuth";

const TZ    = "America/Argentina/Buenos_Aires";
const today = () => new Date().toLocaleDateString("sv", { timeZone: TZ });
const fmt   = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMonto = (n, divisa) => `${divisa === "USD" ? "USD " : "$"}${fmt(n)}`;
const fmtFecha = (d) => new Date(d).toLocaleString("es-AR", {
  timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

const MEDIOS = ["Efectivo", "Cta Cte", "Tarjeta", "Por Banco", "Mercado Pago", "Cheques"];

const FILAS = [
  { cat: "venta",            tipo: "ingreso", label: "Ventas" },
  { cat: "devolucion",       tipo: "egreso",  label: "Devoluciones" },
  { cat: "cobranza",         tipo: "ingreso", label: "Cobranzas" },
  { cat: "reposicion",       tipo: "egreso",  label: "Reposiciones" },
  { cat: "devol_proveedor",  tipo: "ingreso", label: "Devol. a proveedor" },
  { cat: "pago_proveedor",   tipo: "egreso",  label: "Pagos a proveedores" },
  { cat: "pago_cliente",     tipo: "egreso",  label: "Pagos a clientes" },
  { cat: "cobro_proveedor",  tipo: "ingreso", label: "Cobros de proveedores" },
  { cat: "entrada_manual",   tipo: "ingreso", label: "Imputaciones (entradas)" },
  { cat: "salida_manual",    tipo: "egreso",  label: "Imputaciones (salidas)" },
  { cat: "transferencia",    tipo: "ingreso", label: "Transferencias recibidas" },
  { cat: "transferencia",    tipo: "egreso",  label: "Transferencias enviadas" },
];
const CAT_LABEL = {
  venta: "Venta", devolucion: "Devolución", cobranza: "Cobranza", reposicion: "Reposición",
  devol_proveedor: "Devol. a proveedor", pago_proveedor: "Pago a proveedor",
  pago_cliente: "Pago a cliente", cobro_proveedor: "Cobro de proveedor",
  entrada_manual: "Imputación (entrada)", salida_manual: "Imputación (salida)", transferencia: "Transferencia",
};

const thStyle = { padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" };
const tdLabel = { padding: "11px 16px", fontWeight: 700, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap" };

export default function Cajas() {
  useEffect(() => { document.title = "Caja — Once"; }, []);
  const { addToast, ToastContainer } = useToast();
  const { user } = useAuth();
  const esSuper = user?.role === "superadmin";

  const [cajas, setCajas]       = useState([]);
  const [destinos, setDestinos] = useState([]);
  const [cajaId, setCajaId]     = useState("");
  const [tab, setTab]           = useState("caja");
  const [from, setFrom]         = useState(today());
  const [to, setTo]             = useState(today());
  const [applied, setApplied]   = useState({ from: today(), to: today() });
  const [celdas, setCeldas]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [sinCaja, setSinCaja]   = useState(false);

  const [detalle, setDetalle]   = useState(null);   // { titulo, filtros, items }
  const [manual, setManual]     = useState(null);   // form manual / edición
  const [transfer, setTransfer] = useState(null);

  // ── Cajas disponibles ─────────────────────────────────────────
  const loadCajas = useCallback(async () => {
    try {
      const [{ data }, { data: dest }] = await Promise.all([getCajas(), getCajasDestino()]);
      setDestinos(dest);
      setCajas(data.cajas);
      setSinCaja(data.cajas.length === 0);
      setCajaId((prev) => prev || data.mi_caja_id || data.cajas[0]?.id || "");
    } catch { addToast("Error cargando cajas", "error"); }
  }, []);
  useEffect(() => { loadCajas(); }, [loadCajas]);

  // ── Resumen de la caja seleccionada ───────────────────────────
  const loadResumen = useCallback(async (id = cajaId, f = applied.from, t = applied.to) => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await getCajaResumen(id, { from: f, to: t });
      setCeldas(data.celdas);
    } catch { addToast("Error cargando la caja", "error"); }
    setLoading(false);
  }, [cajaId, applied]);
  useEffect(() => { loadResumen(); }, [loadResumen]);

  const aplicarFiltro = () => setApplied({ from, to });

  // ── Grilla ────────────────────────────────────────────────────
  const valor = (cat, tipo, medio, divisa) =>
    celdas.filter((c) => c.categoria === cat && c.tipo === tipo && c.medio === medio && c.divisa === divisa)
          .reduce((a, c) => a + c.total, 0);
  const resultado = (medio, divisa) =>
    celdas.filter((c) => c.medio === medio && c.divisa === divisa)
          .reduce((a, c) => a + (c.tipo === "ingreso" ? c.total : -c.total), 0);
  const hayUSD = celdas.some((c) => c.divisa === "USD");

  const abrirDetalle = async (titulo, filtros) => {
    try {
      const { data } = await getCajaMovimientos(cajaId, { from: applied.from, to: applied.to, ...filtros });
      setDetalle({ titulo, filtros, items: data });
    } catch { addToast("Error cargando el detalle", "error"); }
  };
  const recargarDetalle = async () => {
    if (!detalle) return;
    const { data } = await getCajaMovimientos(cajaId, { from: applied.from, to: applied.to, ...detalle.filtros });
    setDetalle((d) => ({ ...d, items: data }));
  };

  const renderGrilla = (divisa) => (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-header">
        <span className="card-title">Resumen de Caja</span>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", padding: "2px 8px", background: "var(--bg3)", borderRadius: 4, border: "1px solid var(--border)" }}>
          {divisa === "USD" ? "💵 USD" : "🪙 ARS"}
        </span>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
          {applied.from === applied.to ? applied.from : `${applied.from} al ${applied.to}`}
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg3)", borderBottom: "2px solid var(--border)" }}>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 190 }} />
              {MEDIOS.map((m) => <th key={m} style={thStyle}>{m}</th>)}
              <th style={{ ...thStyle, color: "var(--accent)" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map((f) => {
              const total = MEDIOS.reduce((a, m) => a + valor(f.cat, f.tipo, m, divisa), 0);
              if (!total) return null;
              const color = f.tipo === "ingreso" ? "var(--success)" : "var(--danger)";
              const sign  = f.tipo === "ingreso" ? "" : "−";
              return (
                <tr key={f.label} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={tdLabel}>{f.label}</td>
                  {MEDIOS.map((m) => {
                    const v = valor(f.cat, f.tipo, m, divisa);
                    return (
                      <td key={m} style={{ padding: "11px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, color: v ? color : "var(--text-dim)", cursor: v ? "pointer" : "default" }}
                          onClick={() => v && abrirDetalle(`${f.label} · ${m} · ${divisa}`, { categoria: f.cat, tipo: f.tipo, medio: m, divisa })}>
                        {v ? `${sign}${fmtMonto(v, divisa)}` : "—"}
                      </td>
                    );
                  })}
                  <td style={{ padding: "11px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color, cursor: "pointer" }}
                      onClick={() => abrirDetalle(`${f.label} · ${divisa}`, { categoria: f.cat, tipo: f.tipo, divisa })}>
                    {sign}{fmtMonto(total, divisa)}
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: "var(--bg3)", borderTop: "2px solid var(--border)" }}>
              <td style={{ ...tdLabel, color: "var(--accent)", fontSize: 14 }}>Resultado</td>
              {MEDIOS.map((m) => {
                const r = resultado(m, divisa);
                return (
                  <td key={m} style={{ padding: "13px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 15, color: r >= 0 ? "var(--success)" : "var(--danger)", cursor: "pointer" }}
                      onClick={() => abrirDetalle(`Todos los movimientos · ${m} · ${divisa}`, { medio: m, divisa })}>
                    {fmtMonto(r, divisa)}
                  </td>
                );
              })}
              <td style={{ padding: "13px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 15, color: "var(--accent)", cursor: "pointer" }}
                  onClick={() => abrirDetalle(`Todos los movimientos · ${divisa}`, { divisa })}>
                {fmtMonto(MEDIOS.reduce((a, m) => a + resultado(m, divisa), 0), divisa)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Movimiento manual (alta / edición) ────────────────────────
  const guardarManual = async () => {
    const f = manual;
    if (!(Number(f.monto) > 0)) { addToast("Ingresá un monto mayor a 0", "error"); return; }
    try {
      await updateCajaMovimiento(f.id, { monto: Number(f.monto), medio: f.medio, divisa: f.divisa, descripcion: f.descripcion, fecha: f.fecha });
      addToast("Guardado", "success");
      setManual(null);
      loadResumen();
      if (detalle) recargarDetalle();
    } catch (err) { addToast(err?.response?.data?.message || "Error guardando", "error"); }
  };

  const borrarMov = async (m) => {
    const msg = m.transfer_id ? "¿Eliminar esta transferencia? Se elimina también en la otra caja." : "¿Eliminar este movimiento?";
    if (!confirm(msg)) return;
    try {
      await deleteCajaMovimiento(m.id);
      addToast("Eliminado", "success");
      loadResumen();
      recargarDetalle();
    } catch (err) { addToast(err?.response?.data?.message || "Error eliminando", "error"); }
  };

  const editarMov = (m) => setManual({
    id: m.id, tipo: m.tipo, medio: m.medio, divisa: m.divisa, monto: String(m.monto),
    descripcion: m.descripcion || "",
    fecha: new Date(m.fecha).toLocaleDateString("sv", { timeZone: TZ }),
  });

  const hacerTransferencia = async () => {
    const f = transfer;
    if (!f.destino) { addToast("Elegí la caja de destino", "error"); return; }
    if (!(Number(f.monto) > 0)) { addToast("Ingresá un monto mayor a 0", "error"); return; }
    try {
      await transferirEntreCajas({
        caja_origen_id: cajaId, caja_destino_id: f.destino, medio: f.medio, divisa: f.divisa,
        monto: Number(f.monto), descripcion: f.descripcion,
      });
      addToast("Transferencia realizada", "success");
      setTransfer(null);
      loadResumen();
    } catch (err) { addToast(err?.response?.data?.message || "Error transfiriendo", "error"); }
  };

  const cajaActual = cajas.find((c) => c.id === cajaId);

  return (
    <div>
      <ToastContainer />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
        {esSuper && cajas.length > 0 ? (
          <select className="select" style={{ maxWidth: 240 }} value={cajaId} onChange={(e) => setCajaId(e.target.value)}>
            {cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.active ? "" : " (inactiva)"}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{cajaActual?.nombre || ""}</span>
        )}
        {esSuper && (
          <div style={{ display: "flex", gap: 4 }}>
            {[["caja", "Caja"], ["admin", "Administrar cajas"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                fontSize: 12, padding: "6px 14px", borderRadius: 4, border: "1px solid var(--border)", cursor: "pointer",
                background: tab === k ? "var(--accent)" : "transparent", color: tab === k ? "#fff" : "var(--text-muted)",
              }}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {tab === "admin" && esSuper ? (
        <AdminCajas cajas={cajas} reload={loadCajas} addToast={addToast} />
      ) : sinCaja ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>
          {esSuper
            ? "Todavía no hay cajas. Creá la primera desde \"Administrar cajas\"."
            : "No tenés una caja asignada. Pedile a un superadministrador que te asigne una."}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <div className="input-group"><label className="input-label">Desde</label>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="input-group"><label className="input-label">Hasta</label>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <button className="btn btn-primary btn-sm" onClick={aplicarFiltro} disabled={from === applied.from && to === applied.to}>Aplicar</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={() => setTransfer({ destino: "", medio: "Efectivo", divisa: "ARS", monto: "", descripcion: "" })}>⇄ Transferir a otra caja</button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>Cargando...</div>
          ) : (
            <>
              {renderGrilla("ARS")}
              {hayUSD && renderGrilla("USD")}
              {celdas.length === 0 && (
                <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-dim)" }}>Sin movimientos en el período.</div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Desglose ── */}
      {detalle && (
        <Modal title={detalle.titulo} onClose={() => setDetalle(null)}>
          <div style={{ overflowX: "auto", maxHeight: "60vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg3)" }}>
                  {["Fecha", "Concepto", "Medio", "Monto", "Usuario", "Detalle", ""].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detalle.items.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--text-dim)" }}>Sin movimientos</td></tr>
                )}
                {detalle.items.map((m) => {
                  const editable = m.origen_tipo === "transferencia";
                  return (
                    <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>{fmtFecha(m.fecha)}</td>
                      <td style={{ padding: "7px 10px" }}>{CAT_LABEL[m.categoria] || m.categoria}</td>
                      <td style={{ padding: "7px 10px" }}>{m.medio}</td>
                      <td style={{ padding: "7px 10px", fontFamily: "var(--font-mono)", fontWeight: 700, color: m.tipo === "ingreso" ? "var(--success)" : "var(--danger)", whiteSpace: "nowrap" }}>
                        {m.tipo === "ingreso" ? "+" : "−"}{fmtMonto(m.monto, m.divisa)}
                      </td>
                      <td style={{ padding: "7px 10px" }}>{m.user_name || "—"}</td>
                      <td style={{ padding: "7px 10px", color: "var(--text-muted)" }}>{m.descripcion || "—"}</td>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                        {editable ? (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => editarMov(m)} title="Editar">✏️</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => borrarMov(m)} title="Eliminar">🗑️</button>
                          </>
                        ) : (
                          <span style={{ fontSize: 10, color: "var(--text-dim)" }}>automático</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* ── Entrada / salida manual ── */}
      {manual && (
        <Modal
          title="Editar transferencia"
          onClose={() => setManual(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setManual(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarManual}>Guardar</button>
          </>}
        >
          <div className="grid-2">
            {!manual.id && (
              <div className="input-group"><label className="input-label">Tipo</label>
                <select className="select" value={manual.tipo} onChange={(e) => setManual({ ...manual, tipo: e.target.value })}>
                  <option value="ingreso">Entrada</option><option value="egreso">Salida</option>
                </select></div>
            )}
            <div className="input-group"><label className="input-label">Medio de pago</label>
              <select className="select" value={manual.medio} onChange={(e) => setManual({ ...manual, medio: e.target.value })}>
                {MEDIOS.map((m) => <option key={m}>{m}</option>)}
              </select></div>
          </div>
          <div className="grid-2">
            <div className="input-group"><label className="input-label">Divisa</label>
              <select className="select" value={manual.divisa} onChange={(e) => setManual({ ...manual, divisa: e.target.value })}>
                <option value="ARS">🪙 Pesos (ARS)</option><option value="USD">💵 Dólares (USD)</option>
              </select></div>
            <div className="input-group"><label className="input-label">Monto</label>
              <input className="input" type="number" min="0" value={manual.monto} onChange={(e) => setManual({ ...manual, monto: e.target.value })} /></div>
          </div>
          <div className="grid-2">
            <div className="input-group"><label className="input-label">Fecha</label>
              <input className="input" type="date" value={manual.fecha} onChange={(e) => setManual({ ...manual, fecha: e.target.value })} /></div>
            <div className="input-group"><label className="input-label">Descripción</label>
              <input className="input" value={manual.descripcion} onChange={(e) => setManual({ ...manual, descripcion: e.target.value })} /></div>
          </div>
        </Modal>
      )}

      {/* ── Transferencia ── */}
      {transfer && (
        <Modal
          title="Transferir a otra caja"
          onClose={() => setTransfer(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setTransfer(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={hacerTransferencia}>Transferir</button>
          </>}
        >
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
            Sale de <b>{cajaActual?.nombre}</b>. La transferencia es siempre en la misma divisa.
          </p>
          <div className="input-group"><label className="input-label">Caja de destino</label>
            <TransferDestinos cajas={destinos.filter((c) => c.id !== cajaId)} value={transfer.destino}
              onChange={(v) => setTransfer({ ...transfer, destino: v })} /></div>
          <div className="grid-2">
            <div className="input-group"><label className="input-label">Medio de pago</label>
              <select className="select" value={transfer.medio} onChange={(e) => setTransfer({ ...transfer, medio: e.target.value })}>
                {MEDIOS.map((m) => <option key={m}>{m}</option>)}
              </select></div>
            <div className="input-group"><label className="input-label">Divisa</label>
              <select className="select" value={transfer.divisa} onChange={(e) => setTransfer({ ...transfer, divisa: e.target.value })}>
                <option value="ARS">🪙 Pesos (ARS)</option><option value="USD">💵 Dólares (USD)</option>
              </select></div>
          </div>
          <div className="grid-2">
            <div className="input-group"><label className="input-label">Monto</label>
              <input className="input" type="number" min="0" value={transfer.monto} onChange={(e) => setTransfer({ ...transfer, monto: e.target.value })} /></div>
            <div className="input-group"><label className="input-label">Descripción</label>
              <input className="input" value={transfer.descripcion} onChange={(e) => setTransfer({ ...transfer, descripcion: e.target.value })} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TransferDestinos({ cajas, value, onChange }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Elegí una caja —</option>
      {cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
    </select>
  );
}

// ── Administrar cajas (superadmin) ──────────────────────────────
function AdminCajas({ cajas, reload, addToast }) {
  const [nombre, setNombre]     = useState("");
  const [usuarios, setUsuarios] = useState([]);

  const loadUsuarios = useCallback(async () => {
    try { const { data } = await getCajaUsuarios(); setUsuarios(data); }
    catch { addToast("Error cargando usuarios", "error"); }
  }, []);
  useEffect(() => { loadUsuarios(); }, [loadUsuarios]);

  const crear = async () => {
    if (!nombre.trim()) return;
    try { await createCaja(nombre.trim()); setNombre(""); addToast("Caja creada", "success"); reload(); }
    catch (err) { addToast(err?.response?.data?.message || "Error creando la caja", "error"); }
  };
  const renombrar = async (c) => {
    const n = prompt("Nuevo nombre de la caja:", c.nombre);
    if (!n || !n.trim() || n === c.nombre) return;
    try { await updateCaja(c.id, { nombre: n }); reload(); }
    catch { addToast("Error renombrando", "error"); }
  };
  const toggleActiva = async (c) => {
    try { await updateCaja(c.id, { active: !c.active }); reload(); }
    catch { addToast("Error actualizando", "error"); }
  };
  const asignar = async (u, cajaId) => {
    try { await setCajaUsuario(u.id, cajaId || null); addToast("Caja asignada", "success"); loadUsuarios(); }
    catch (err) { addToast(err?.response?.data?.message || "Error asignando", "error"); }
  };

  return (
    <>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Cajas</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input className="input" style={{ maxWidth: 300 }} placeholder="Nombre de la nueva caja" value={nombre}
                 onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && crear()} />
          <button className="btn btn-primary btn-sm" onClick={crear}>+ Crear caja</button>
        </div>
        {cajas.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", opacity: c.active ? 1 : 0.55 }}>
            <span style={{ flex: 1, fontSize: 14 }}>{c.nombre}{c.active ? "" : " (inactiva)"}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => renombrar(c)}>Renombrar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => toggleActiva(c)}>{c.active ? "Desactivar" : "Reactivar"}</button>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Usuarios y su caja</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>Cada usuario tiene una única caja asignada.</div>
        {usuarios.map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", opacity: u.active ? 1 : 0.55 }}>
            <span style={{ flex: 1, fontSize: 14 }}>{u.name} <span style={{ color: "var(--text-dim)", fontSize: 12 }}>· {u.role}</span></span>
            <select className="select" style={{ maxWidth: 220 }} value={u.caja_id || ""} onChange={(e) => asignar(u, e.target.value)}>
              <option value="">— Sin caja —</option>
              {cajas.filter((c) => c.active || c.id === u.caja_id).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        ))}
      </div>
    </>
  );
}
