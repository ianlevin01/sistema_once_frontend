import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  searchCustomers, getCustomer,
  createCustomer, updateCustomer, deleteCustomer, openCuentaCorriente,
  getCuentaCorrienteCliente, getCuentaCorrienteGeneral,
  registrarCobranzaCC, editarMovimientoCC, eliminarMovimientoCC,
  searchProveedores, getProveedor,
  createProveedor, updateProveedor, deleteProveedor,
  getCCProveedor, registrarCobranzaProveedor,
  editarMovimientoProv, eliminarMovimientoProv,
  getCCProveedoresSummary,
  getPriceConfig, getTransportes, getComprobante, getVendedoresActivos,
} from "../utils/api";
import { printComprobantePDF, printCCPDF, printCCGeneralPDF } from "../utils/printDoc";
import { useToast } from "../utils/useToast";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmtARS  = (n) => `$${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtUSD  = (n) => `USD ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "—");
const fmtMonto = (n, divisa) => (divisa === "USD" ? fmtUSD(n) : fmtARS(n));
const fmtMontoSigned = (n, divisa) => {
  const num = Number(n || 0);
  const abs = Math.abs(num);
  const neg = num < 0;
  if (divisa === "USD") return `USD ${neg ? "−" : ""}${abs.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${neg ? "−" : ""}$${abs.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const COND_IVA    = ["Resp. Inscripto", "Resp. Monotributo", "Consumidor Final", "Exento"];
const METODOS_COBRANZA = ["Efectivo", "Cheque", "Depósito", "Tarjeta", "Mercpago"];

const EMPTY_CLIENTE = {
  name: "", document: "", domicilio: "", localidad: "", provincia: "",
  codigo_postal: "", phone: "", transporte: "", divisa: "ARS",
};
const EMPTY_PROVEEDOR = {
  name: "", document: "", domicilio: "", localidad: "", provincia: "",
  codigo_postal: "", phone: "", transporte: "", divisa: "ARS",
};

// ─────────────────────────────────────────────────────────────
// Componentes atómicos
// ─────────────────────────────────────────────────────────────
function DivisaBadge({ divisa }) {
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 4,
      fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.06em",
      background: divisa === "USD" ? "rgba(52,211,153,0.15)" : "rgba(99,179,237,0.15)",
      color:      divisa === "USD" ? "var(--success)"        : "var(--accent)",
      border: `1px solid ${divisa === "USD" ? "var(--success)" : "var(--accent)"}`,
    }}>
      {divisa === "USD" ? "💵 USD" : "🪙 ARS"}
    </span>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
      {children}
    </div>
  );
}

function FieldRow({ label, value, mono }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ fontSize: 13, color: value ? "var(--text)" : "var(--text-dim)", fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div className="input-group">
      <label className="input-label">{label}</label>
      <input className="input" type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <div className="input-group">
      <label className="input-label">{label}</label>
      <select className="select" value={value ?? ""} onChange={onChange}>
        {options.map((o) =>
          typeof o === "string"
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  );
}

function DivisaSelector({ value, onChange }) {
  return (
    <div className="input-group">
      <label className="input-label">Divisa de la cuenta corriente</label>
      <div style={{ display: "flex", gap: 8 }}>
        {["ARS", "USD"].map((d) => (
          <button key={d} type="button" onClick={() => onChange(d)} style={{
            flex: 1, padding: "10px 0", borderRadius: 6, cursor: "pointer",
            border: `2px solid ${value === d ? (d === "USD" ? "var(--success)" : "var(--accent)") : "var(--border)"}`,
            background: value === d ? (d === "USD" ? "rgba(52,211,153,0.12)" : "var(--accent-dim)") : "var(--bg3)",
            color: value === d ? (d === "USD" ? "var(--success)" : "var(--accent)") : "var(--text-muted)",
            fontWeight: value === d ? 700 : 400, fontFamily: "var(--font-mono)", fontSize: 14,
          }}>
            {d === "USD" ? "💵 USD" : "🪙 ARS"}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
        {value === "USD" ? "Los saldos se guardan en dólares" : "Los saldos se guardan en pesos"}
      </div>
    </div>
  );
}

function EntityForm({ form, setForm, mode }) {
  const [transporteOptions, setTransporteOptions] = useState([]);

  useEffect(() => {
    if (mode === "cliente") {
      getTransportes()
        .then((data) => setTransporteOptions(data.map((t) => t.razon_social)))
        .catch(() => {});
    }
  }, [mode]);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const setDivisa = (val) => setForm((p) => ({ ...p, divisa: val }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Datos</div>
      <div className="grid-2">
        <FormInput label="Nombre *"   value={form.name}     onChange={set("name")}     placeholder="Razón social o nombre" />
        <FormInput label="CUIT / CUIL" value={form.document} onChange={set("document")} placeholder="20-12345678-9" />
      </div>
      <FormInput label="Domicilio"     value={form.domicilio}     onChange={set("domicilio")}     placeholder="Dirección" />
      <div className="grid-2">
        <FormInput label="Localidad"     value={form.localidad}     onChange={set("localidad")} />
        <FormInput label="Provincia"     value={form.provincia}     onChange={set("provincia")} />
      </div>
      <FormInput label="Código Postal" value={form.codigo_postal} onChange={set("codigo_postal")} placeholder="1234" />
      <FormInput label="Teléfono"      value={form.phone}         onChange={set("phone")} />
      {mode === "cliente" && (
        <div className="input-group">
          <label className="input-label">Transporte</label>
          <select className="select" value={form.transporte ?? ""} onChange={set("transporte")}>
            <option value="">— seleccionar —</option>
            {transporteOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}
      <hr className="divider" />
      <DivisaSelector value={form.divisa ?? "ARS"} onChange={setDivisa} />
    </div>
  );
}

function EntityFicha({ selected, mode }) {
  return (
    <div style={{ display: "flex", gap: 32 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Datos</div>
        <FieldRow label="Nombre"        value={selected.name} />
        <FieldRow label="Domicilio"     value={selected.domicilio} />
        <FieldRow label="Localidad"     value={selected.localidad} />
        <FieldRow label="Provincia"     value={selected.provincia} />
        <FieldRow label="Código Postal" value={selected.codigo_postal} mono />
        <FieldRow label="CUIT / CUIL"   value={selected.document} mono />
        <FieldRow label="Teléfono"      value={selected.phone} mono />
        {mode === "cliente" && <FieldRow label="Transporte" value={selected.transporte} />}
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Divisa de la cuenta corriente</FieldLabel>
          <DivisaBadge divisa={selected.divisa ?? "ARS"} />
        </div>
        <FieldRow label="Alta" value={fmtDate(selected.created_at)} mono />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal de cobranza (multi-método)
// ─────────────────────────────────────────────────────────────
function CobranzaModal({ open, onClose, onConfirm, mode, selectedName, divisaCuenta, cotizacion, saving }) {
  const todayStr = () => new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });
  const defaultTipoMov = mode === "proveedor" ? "debe" : "haber";
  const emptyFila = () => ({ monto: "", metodo_pago: "Efectivo", divisa_cobro: divisaCuenta, cotizacionCustom: String(cotizacion || "") });

  const [tipoMov,  setTipoMov]  = useState(defaultTipoMov);
  const [concepto, setConcepto] = useState("");
  const [fecha,    setFecha]    = useState(todayStr());
  const [filas,    setFilas]    = useState([emptyFila()]);

  useEffect(() => {
    if (open) {
      setTipoMov(defaultTipoMov);
      setConcepto("");
      setFecha(todayStr());
      setFilas([emptyFila()]);
    }
  }, [open, divisaCuenta, cotizacion]);

  if (!open) return null;

  const setFila   = (i, key, val) => setFilas((prev) => prev.map((f, idx) => idx === i ? { ...f, [key]: val } : f));
  const addFila   = () => setFilas((prev) => [...prev, emptyFila()]);
  const removeFila = (i) => setFilas((prev) => prev.filter((_, idx) => idx !== i));

  const previewConversion = (fila) => {
    const monto = Number(fila.monto);
    const cotizUsada = Number(fila.cotizacionCustom) || cotizacion;
    if (!monto || !cotizUsada || fila.divisa_cobro === divisaCuenta) return null;
    if (fila.divisa_cobro === "ARS" && divisaCuenta === "USD")
      return `= USD ${(monto / cotizUsada).toLocaleString("es-AR", { minimumFractionDigits: 2 })} (cotiz. $${cotizUsada.toLocaleString("es-AR")})`;
    if (fila.divisa_cobro === "USD" && divisaCuenta === "ARS")
      return `= $${(monto * cotizUsada).toLocaleString("es-AR", { minimumFractionDigits: 2 })} (cotiz. $${cotizUsada.toLocaleString("es-AR")})`;
    return null;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Registrar movimiento — {selectedName}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* DEBE / HABER */}
          <div className="input-group">
            <label className="input-label">Tipo de movimiento</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["debe", "haber"].map((val) => (
                <button key={val} type="button" onClick={() => setTipoMov(val)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 6, cursor: "pointer",
                  fontSize: 13, fontWeight: tipoMov === val ? 700 : 400, textTransform: "uppercase",
                  border: `2px solid ${tipoMov === val ? "var(--accent)" : "var(--border)"}`,
                  background: tipoMov === val ? "var(--accent-dim)" : "var(--bg3)",
                  color: tipoMov === val ? "var(--accent)" : "var(--text-dim)",
                }}>{val}</button>
              ))}
            </div>
          </div>

          {/* Info cuenta */}
          <div style={{ padding: "8px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-muted)" }}>
            <span>Cuenta en</span><DivisaBadge divisa={divisaCuenta} /><span>— saldo se actualiza en {divisaCuenta}</span>
          </div>

          {/* Fecha y concepto */}
          <div className="input-group">
            <label className="input-label">Fecha</label>
            <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Observaciones</label>
            <input className="input" value={concepto} onChange={(e) => setConcepto(e.target.value)}
              placeholder={mode === "proveedor" ? "Pago a proveedor, NC, etc." : "Cobranza, seña, etc."} />
          </div>

          {/* Separador */}
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
            Métodos de pago
          </div>

          {/* Filas */}
          {filas.map((fila, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", background: "var(--bg2)", display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
              {filas.length > 1 && (
                <button type="button" onClick={() => removeFila(i)} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 16, lineHeight: 1, padding: "0 4px" }}>✕</button>
              )}
              <div className="input-group">
                <label className="input-label">Divisa del cobro</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["ARS", "USD"].map((d) => (
                    <button key={d} type="button" onClick={() => setFila(i, "divisa_cobro", d)} style={{
                      flex: 1, padding: "8px 0", borderRadius: 6, cursor: "pointer",
                      border: `2px solid ${fila.divisa_cobro === d ? (d === "USD" ? "var(--success)" : "var(--accent)") : "var(--border)"}`,
                      background: fila.divisa_cobro === d ? (d === "USD" ? "rgba(52,211,153,0.12)" : "var(--accent-dim)") : "var(--bg3)",
                      color: fila.divisa_cobro === d ? (d === "USD" ? "var(--success)" : "var(--accent)") : "var(--text-muted)",
                      fontWeight: fila.divisa_cobro === d ? 700 : 400, fontFamily: "var(--font-mono)", fontSize: 13,
                    }}>{d === "USD" ? "💵 USD" : "🪙 ARS"}</button>
                  ))}
                </div>
              </div>
              {fila.divisa_cobro !== divisaCuenta && (
                <div className="input-group">
                  <label className="input-label">Cotización manual (ARS por USD)</label>
                  <input className="input" type="number" min="0" step="0.01"
                    value={fila.cotizacionCustom}
                    onChange={(e) => setFila(i, "cotizacionCustom", e.target.value)}
                    onWheel={(e) => e.target.blur()}
                    placeholder={String(cotizacion)}
                  />
                </div>
              )}
              <div className="input-group">
                <label className="input-label">Monto ({fila.divisa_cobro})</label>
                <input className="input" type="number" min="0" step="0.01" value={fila.monto}
                  onChange={(e) => setFila(i, "monto", e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  autoFocus={i === 0} />
                {previewConversion(fila) && (
                  <div style={{ marginTop: 6, padding: "6px 10px", background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.25)", borderRadius: 5, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                    ⇄ {previewConversion(fila)}
                  </div>
                )}
              </div>
              <div className="input-group">
                <label className="input-label">Método de pago</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {METODOS_COBRANZA.map((m) => (
                    <button key={m} type="button" onClick={() => setFila(i, "metodo_pago", m)} style={{
                      padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", fontSize: 13,
                      background: fila.metodo_pago === m ? "var(--accent)" : "var(--bg3)",
                      color:      fila.metodo_pago === m ? "#fff"          : "var(--text-muted)",
                      fontWeight: fila.metodo_pago === m ? 700             : 400,
                    }}>{m}</button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Agregar fila */}
          <button type="button" onClick={addFila} style={{
            padding: "8px 0", borderRadius: 6, border: "1.5px dashed var(--border)",
            background: "transparent", color: "var(--text-dim)", cursor: "pointer",
            fontSize: 13, fontFamily: "var(--font-mono)",
          }}>
            + Agregar otro método de pago
          </button>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onConfirm({ tipo_mov: tipoMov, concepto, fecha, filas })} disabled={saving}>
            {saving ? "Guardando..." : `Registrar ${tipoMov === "debe" ? "Debe" : "Haber"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal de edición de movimiento
// ─────────────────────────────────────────────────────────────
function EditMovModal({ open, onClose, movimiento, onConfirm, onDelete, saving }) {
  const [form, setForm] = useState({ monto: "", concepto: "", metodo_pago: "", fecha: "" });
  const [fechaOriginal, setFechaOriginal] = useState(null);

  useEffect(() => {
    if (open && movimiento) {
      const fechaInitial = movimiento.created_at ? new Date(movimiento.created_at).toISOString().slice(0, 10) : "";
      setFechaOriginal(fechaInitial);
      setForm({
        monto:       String(Number(movimiento.monto || 0)),
        concepto:    movimiento.concepto || "",
        metodo_pago: movimiento.metodo_pago || "",
        fecha:       fechaInitial,
      });
    }
  }, [open, movimiento]);

  if (!open || !movimiento) return null;

  const setF   = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const setMet = (m) => setForm((p) => ({ ...p, metodo_pago: m }));

  const divisaCC = movimiento.divisa_cuenta ?? "ARS";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Editar movimiento</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: "8px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span className={`badge ${movimiento.tipo === "debito" ? "badge-danger" : "badge-success"}`}>
              {movimiento.tipo === "debito" ? "Débito" : "Pago / Cobro"}
            </span>
            <span>Original: {fmtMonto(movimiento.monto, divisaCC)}</span>
          </div>

          <div className="input-group">
            <label className="input-label">Fecha</label>
            <input className="input" type="date" value={form.fecha} onChange={setF("fecha")} />
          </div>

          <div className="input-group">
            <label className="input-label">Nuevo monto ({divisaCC})</label>
            <input className="input" type="number" min="0" step="0.01" value={form.monto} onChange={setF("monto")} onWheel={(e) => e.target.blur()} autoFocus />
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
              Cambiar el monto ajusta automáticamente el saldo de la cuenta
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Concepto</label>
            <input className="input" value={form.concepto} onChange={setF("concepto")} />
          </div>

          {(movimiento.metodo_pago !== null && movimiento.metodo_pago !== undefined) && (
            <div className="input-group">
              <label className="input-label">Método de pago</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setMet("")}
                  style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid var(--border)", background: !form.metodo_pago ? "var(--bg3)" : "transparent", color: "var(--text-muted)" }}>
                  —
                </button>
                {METODOS_COBRANZA.map((m) => (
                  <button key={m} type="button" onClick={() => setMet(m)}
                    style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid var(--border)",
                      background: form.metodo_pago === m ? "var(--accent)" : "transparent",
                      color:      form.metodo_pago === m ? "#fff"          : "var(--text-muted)",
                    }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(movimiento.id)} disabled={saving}>
            🗑️ Eliminar
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => onConfirm(movimiento.id, form, fechaOriginal)} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Vista de cuenta corriente
// ─────────────────────────────────────────────────────────────
function CCView({ cc, loadingCC, mode, cotizacion, onEditMov }) {
  const navigate = useNavigate();
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [orderItems,     setOrderItems]     = useState({});
  const [soloCC,         setSoloCC]         = useState(false);
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate,   setFilterToDate]   = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    if (cc) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 80);
    }
  }, [cc]);

  const toggleDetails = async (orderId) => {
    if (expandedOrders.has(orderId)) {
      setExpandedOrders((prev) => { const s = new Set(prev); s.delete(orderId); return s; });
      return;
    }
    setExpandedOrders((prev) => new Set([...prev, orderId]));
    if (!orderItems[orderId]) {
      try {
        const { data } = await getComprobante(orderId);
        const itemsConMeta = (data.items ?? []).map((it) => ({
          ...it,
          _divisa: data.divisa,
          _cotizacion_dolar: data.cotizacion_dolar,
        }));
        setOrderItems((prev) => ({ ...prev, [orderId]: itemsConMeta }));
      } catch {
        setOrderItems((prev) => ({ ...prev, [orderId]: [] }));
      }
    }
  };

  if (loadingCC) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Cargando...</div>;
  }

  const cuenta      = cc?.cuenta || cc;
  const movimientos = cc?.movimientos || cuenta?.movimientos || [];
  const saldo       = Number(cuenta?.saldo || 0);
  const divisa      = cuenta?.divisa ?? "ARS";

  if (!cuenta) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Sin cuenta corriente</div>;
  }

  const esProveedor = mode === "proveedor";

  // Helper: convertir timestamp UTC a fecha YYYY-MM-DD en zona horaria local
  const getLocalDateStr = (timestamp) => {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    return d.toLocaleDateString("sv"); // sv = ISO format YYYY-MM-DD
  };

  // Calcular saldo acumulado PARA TODOS los movimientos (con historia completa)
  // Para proveedores: saldo_inicial suma, pagos restan
  // El array resultante queda en orden ASC (más viejo primero, más nuevo al final)
  const movsConSaldoReal = (() => {
    const asc = [...movimientos].reverse(); // API devuelve DESC, invertimos a ASC
    let running = 0;
    return asc.map((m) => {
      if (m.afecta_saldo !== false) {
        if (esProveedor) {
          if (m.concepto && m.concepto.toLowerCase().includes('saldo_inicial')) {
            running += Number(m.monto);
          } else if (m.tipo === "debito") {
            running -= Number(m.monto);
          } else {
            running += Number(m.monto);
          }
        } else {
          running += m.tipo === "debito" ? Number(m.monto) : -Number(m.monto);
        }
      }
      return { ...m, _saldo_momento: running };
    });
  })();

  // Ahora filtrar para mostrar en la tabla
  const movsVisibles = (() => {
    let resultado = soloCC
      ? movsConSaldoReal.filter((m) => m.afecta_saldo !== false)
      : movsConSaldoReal;

    if (!filterFromDate && !filterToDate) return resultado;

    return resultado.filter((m) => {
      const movDate = getLocalDateStr(m.created_at);
      if (filterFromDate && movDate < filterFromDate) return false;
      if (filterToDate && movDate > filterToDate) return false;
      return true;
    });
  })();

  // Calcular saldo inicial: suma de movimientos DESDE el filterFromDate (sin limitar por filterToDate)
  const sumaMovsDesdeInicio = filterFromDate ? movsConSaldoReal
    .filter(m => {
      const movDate = getLocalDateStr(m.created_at);
      return movDate >= filterFromDate; // Solo desde la fecha inicial, sin límite superior
    })
    .reduce((acc, m) => {
      if (m.afecta_saldo === false) return acc;
      return acc + (m.tipo === "debito" ? Number(m.monto) : -Number(m.monto));
    }, 0) : 0;

  const saldoInicial = filterFromDate ? saldo - sumaMovsDesdeInicio : saldo;

  // Si hay "hasta", mostrar saldo AL "hasta"
  const sumaDepues = filterToDate ? movimientos.reduce((acc, m) => {
    const movDate = getLocalDateStr(m.created_at);
    if (movDate <= filterToDate) return acc;
    if (m.afecta_saldo === false) return acc;
    return acc + (m.tipo === "debito" ? Number(m.monto) : -Number(m.monto));
  }, 0) : 0;

  const saldoMostrado = filterToDate ? saldo - sumaDepues : saldo;

  const saldoColor  = saldoMostrado > 0 ? "var(--danger)" : saldoMostrado < 0 ? "var(--success)" : "var(--text-dim)";
  const saldoLabel  = esProveedor
    ? (saldoMostrado > 0 ? "Le debemos" : "Sin deuda")
    : (saldoMostrado > 0 ? "Debe" : "Saldo a favor");

  const GRID = "110px 1fr 130px 120px 110px 70px 120px 60px 36px";

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 300, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Saldo de la cuenta{filterToDate ? ` al ${filterToDate}` : ""}</div>
            <DivisaBadge divisa={divisa} />
          </div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-mono)", fontWeight: 800, color: saldoColor }}>
            {fmtMontoSigned(saldoMostrado, divisa)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{saldoLabel}</div>
          {cotizacion > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              ≈ {fmtMontoSigned(divisa === "USD" ? saldoMostrado * cotizacion : saldoMostrado / cotizacion, divisa === "USD" ? "ARS" : "USD")}
              {" · cotiz. $"}{cotizacion.toLocaleString("es-AR")}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Desde</label>
            <input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-mono)" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Hasta</label>
            <input
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-mono)" }}
            />
          </div>
          {(filterFromDate || filterToDate) && (
            <button
              onClick={() => { setFilterFromDate(""); setFilterToDate(""); }}
              style={{ padding: "6px 12px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text-dim)", cursor: "pointer", alignSelf: "flex-end", whiteSpace: "nowrap" }}
            >
              Limpiar filtro
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Movimientos ({movsVisibles.length}{soloCC ? ` de ${movsConSaldo.length}` : ""})
        </div>
        <button
          onClick={() => setSoloCC((v) => !v)}
          style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 4, cursor: "pointer",
            border: `1px solid ${soloCC ? "var(--accent)" : "var(--border)"}`,
            background: soloCC ? "var(--accent)" : "var(--bg3)",
            color: soloCC ? "#fff" : "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {soloCC ? "✓ Solo Cta Cte" : "Todos"}
        </button>
      </div>

      {!movsVisibles.length ? (
        <div style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12, padding: "24px 0" }}>Sin movimientos</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {filterFromDate && (
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "8px 12px", background: "var(--bg3)", borderRadius: "6px 6px 0 0", borderBottom: "1px solid var(--border)" }}>
              Saldo al {filterFromDate}: <span style={{ fontWeight: 700, color: saldoInicial > 0 ? "var(--danger)" : saldoInicial < 0 ? "var(--success)" : "var(--text-dim)" }}>{fmtMontoSigned(saldoInicial, divisa)}</span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "8px 12px", background: "var(--bg3)", borderRadius: filterFromDate ? "0" : "6px 6px 0 0", borderBottom: "2px solid var(--border)" }}>
            {["Fecha", "Concepto", "Método", "Monto", "Original", "D.Cobro", "Saldo", "Tipo", ""].map((h) => (
              <div key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
            ))}
          </div>
          {movsVisibles.map((m) => {
            const divisaCC    = m.divisa_cuenta ?? divisa;
            const divisaCobro = m.divisa_cobro  ?? divisaCC;
            const hayConv     = divisaCobro !== divisaCC;
            const isExpanded  = m.order_id && expandedOrders.has(m.order_id);
            const items       = m.order_id ? (orderItems[m.order_id] ?? null) : null;
            const isVisual    = m.afecta_saldo === false;
            const metodoDisplay = m.metodo_pago || (!isVisual ? "Cta Cte" : "—");
            // Entradas visuales (no-CC): negrita azul llamativo
            const visualStyle = isVisual
              ? { fontWeight: 700, color: "#1d4ed8" }
              : {};
            return (
              <div key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "10px 12px",
                  alignItems: "center",
                  background: isVisual ? "rgba(29,78,216,0.04)" : "var(--bg)",
                }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", ...visualStyle }}>{fmtDate(m.created_at)}</span>
                  {m.order_id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <button
                        style={{ fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0, color: isVisual ? "#1d4ed8" : "var(--accent)", textDecoration: "underline", textAlign: "left", fontWeight: isVisual ? 700 : 400 }}
                        title="Imprimir comprobante"
                        onClick={async () => {
                          try { const { data } = await getComprobante(m.order_id); printComprobantePDF(data); } catch {}
                        }}
                      >
                        {m.concepto || "Ver comprobante"}
                      </button>
                      <button
                        style={{ background: "none", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-dim)", fontSize: 11, padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap", lineHeight: 1.5 }}
                        title="Editar comprobante"
                        onClick={() => window.open(`/comprobantes/editar/${m.order_id}`, "_blank")}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        style={{ background: "none", border: "1px solid var(--border)", cursor: "pointer", color: isExpanded ? "var(--accent)" : "var(--text-dim)", fontSize: 11, padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap", lineHeight: 1.5 }}
                        title="Ver artículos del comprobante"
                        onClick={() => toggleDetails(m.order_id)}
                      >
                        {isExpanded ? "▲ Ocultar" : "▼ Detalles"}
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, ...visualStyle }}>{m.concepto || "—"}</span>
                  )}
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: isVisual ? "#1d4ed8" : "var(--text-muted)", fontWeight: isVisual ? 700 : 400 }}>{metodoDisplay}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: isVisual ? "#1d4ed8" : (esProveedor && m.concepto && m.concepto.toLowerCase().includes('saldo_inicial') ? "var(--text)" : (m.tipo === "debito" ? "var(--danger)" : "var(--success)")) }}>
                    {esProveedor
                      ? (m.concepto && m.concepto.toLowerCase().includes('saldo_inicial') ? "+" : (m.tipo === "debito" ? "−" : "+"))
                      : (m.tipo === "debito" ? "+" : "−")
                    }{fmtMonto(m.monto, divisaCC)}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: hayConv ? "var(--text-muted)" : "var(--text-dim)" }}>
                    {hayConv && m.monto_original != null ? fmtMonto(m.monto_original, divisaCobro) : "—"}
                  </span>
                  <span><DivisaBadge divisa={divisaCobro} /></span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: isVisual ? "#1d4ed8" : (m._saldo_momento < 0 ? "var(--success)" : m._saldo_momento > 0 ? "var(--danger)" : "var(--text-dim)") }}>
                    {fmtMontoSigned(m._saldo_momento, divisa)}
                  </span>
                  <span className={`badge ${m.tipo === "debito" ? "badge-danger" : "badge-success"}`} style={{ fontSize: 10, opacity: isVisual ? 0.5 : 1 }}>
                    {m.tipo === "debito" ? "Déb" : "Cobro"}
                  </span>
                  {!m.order_id && (
                    <button
                      onClick={() => onEditMov(m)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", fontSize: 14, padding: "2px 4px", borderRadius: 4 }}
                      title="Editar movimiento">
                      ✏️
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <div style={{ background: "var(--bg2)", borderTop: "1px solid var(--border)", padding: "10px 20px 12px" }}>
                    {items === null ? (
                      <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>Cargando...</span>
                    ) : items.length === 0 ? (
                      <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>Sin artículos</span>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                            <th style={{ textAlign: "left",  padding: "0 8px 6px 0", fontWeight: 600 }}>Artículo</th>
                            <th style={{ textAlign: "center", padding: "0 8px 6px",  fontWeight: 600, width: 60 }}>Cant.</th>
                            <th style={{ textAlign: "right",  padding: "0 0 6px 8px", fontWeight: 600, width: 110 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, idx) => (
                            <tr key={idx} style={{ borderTop: "1px solid var(--border)" }}>
                              <td style={{ padding: "5px 8px 5px 0", color: "var(--text)" }}>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#2563eb", fontWeight: 600, marginRight: 6 }}>{it.code || it.product_code || "—"}</span>
                                {it.name || it.product_name || "—"}
                              </td>
                              <td style={{ padding: "5px 8px", textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{it.quantity}</td>
                              <td style={{ padding: "5px 0 5px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent)" }}>
                                {(() => {
                                  const unitARS = Number(it.unit_price);
                                  const unitDisp = (it._divisa === "USD" && it._cotizacion_dolar)
                                    ? (unitARS / Number(it._cotizacion_dolar)) * cotizacion
                                    : unitARS;
                                  return (it.quantity * unitDisp).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EntityPanel
// ─────────────────────────────────────────────────────────────
function EntityPanel({
  mode, searchFn, getFn, createFn, updateFn, deleteFn,
  getCCFn, registrarCobranzaFn, editarMovFn, eliminarMovFn,
  emptyForm, addToast, cotizacion,
}) {
  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState([]);
  const [loadingList,   setLoadingList]   = useState(false);
  const [selected,      setSelected]      = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [editing,       setEditing]       = useState(false);
  const [isNew,         setIsNew]         = useState(false);
  const [form,          setForm]          = useState(emptyForm);
  const [saving,        setSaving]        = useState(false);

  const [cc,        setCC]        = useState(null);
  const [loadingCC, setLoadingCC] = useState(false);
  const [viewCC,    setViewCC]    = useState(false);

  const [modalCobranza,  setModalCobranza]  = useState(false);
  const [savingCobranza, setSavingCobranza] = useState(false);

  // Edición de movimientos
  const [movEditando,   setMovEditando]   = useState(null);
  const [savingMovEdit, setSavingMovEdit] = useState(false);
  const [showPwdModal,  setShowPwdModal]  = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [pendingEditData, setPendingEditData] = useState(null);

  const listRef = useRef(null);
  const label   = mode === "cliente" ? "Cliente" : "Proveedor";
  const divisaCuenta = selected?.divisa ?? "ARS";

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoadingList(true);
      try {
        const res  = await searchFn(query);
        const data = Array.isArray(res) ? res : res.data;
        setResults(data); setSelectedIndex(-1);
      } catch { addToast(`Error buscando ${label.toLowerCase()}s`, "error"); }
      setLoadingList(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handleKey = (e) => {
      if (results.length === 0 || editing) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.min(prev + 1, results.length - 1);
          selectEntity(results[next], next);
          listRef.current?.children[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          selectEntity(results[next], next);
          listRef.current?.children[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [results, editing]);

  const selectEntity = async (c, idx) => {
    if (idx !== undefined) setSelectedIndex(idx);
    setSelected({ ...c, _loading: true });
    setEditing(false); setIsNew(false); setViewCC(true); setCC(null);
    setLoadingDetail(true);
    loadCC(c.id);
    try {
      const res  = await getFn(c.id);
      const data = res.data || res;
      setSelected(data);
    } catch { addToast(`Error cargando ${label.toLowerCase()}`, "error"); }
    setLoadingDetail(false);
  };

  const loadCC = async (id) => {
    setLoadingCC(true);
    try {
      const res  = await getCCFn(id);
      const data = res.data ?? null;
      setCC(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setCC(null); // cliente web: sin CC
      } else {
        addToast("Error cargando cuenta corriente", "error");
      }
    }
    setLoadingCC(false);
  };

  const handleVerCC = () => { setViewCC(true); if (!cc) loadCC(selected.id); };

  const handleCobranza = async ({ tipo_mov, concepto, fecha, filas }) => {
    const validFilas = filas.filter((f) => Number(f.monto) > 0);
    if (validFilas.length === 0) { addToast("Ingresá al menos un monto válido", "error"); return; }
    setSavingCobranza(true);
    try {
      for (const fila of validFilas) {
        const cotizUsada = Number(fila.cotizacionCustom) || cotizacion;
        await registrarCobranzaFn(selected.id, {
          monto:             Number(fila.monto),
          concepto:          concepto || "",
          metodo_pago:       fila.metodo_pago,
          divisa_cobro:      fila.divisa_cobro,
          cotizacion_manual: cotizUsada || null,
          fecha:             fecha || null,
          tipo_mov:          tipo_mov || (mode === "proveedor" ? "debe" : "haber"),
        });
      }
      addToast(mode === "proveedor" ? "Pago registrado" : "Cobranza registrada", "success");
      setModalCobranza(false);
      loadCC(selected.id);
      const res = await getFn(selected.id);
      setSelected(res.data || res);
    } catch (err) { addToast(err.response?.data?.message || "Error", "error"); }
    setSavingCobranza(false);
  };

  // Editar movimiento (requiere contraseña de admin para cobranzas)
  const handleConfirmEditMov = async (movId, form, fechaOriginal) => {
    // Guardar los datos y pedir contraseña
    setPendingEditData({ movId, form, fechaOriginal });
    setShowPwdModal(true);
  };

  // Procesar la edición después de validar contraseña
  const handleConfirmEditWithPassword = async () => {
    if (!pendingEditData) return;
    const { movId, form, fechaOriginal } = pendingEditData;

    setSavingMovEdit(true);
    try {
      await editarMovFn(movId, {
        monto:       form.monto ? Number(form.monto) : undefined,
        concepto:    form.concepto,
        metodo_pago: form.metodo_pago || null,
        fecha:       form.fecha && form.fecha !== fechaOriginal ? form.fecha : null,
        admin_password: adminPassword,
      });
      addToast("Movimiento actualizado", "success");
      setMovEditando(null);
      setShowPwdModal(false);
      setAdminPassword("");
      setPendingEditData(null);
      loadCC(selected.id);
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || "Error actualizando movimiento";
      // Si es contraseña incorrecta (403), solo mostrar el error sin cerrar modal
      if (status === 403) {
        addToast(message, "error");
      } else {
        addToast(message, "error");
        setShowPwdModal(false);
        setAdminPassword("");
        setPendingEditData(null);
      }
    }
    setSavingMovEdit(false);
  };

  const handleDeleteMov = (movId) => {
    const mov = movEditando;
    // Solo permitir eliminar cobranzas, no comprobantes
    if (mov?.order_id) {
      addToast("No se pueden eliminar comprobantes desde aquí", "error");
      return;
    }
    if (!confirm("¿Eliminar esta cobranza? El saldo de la cuenta será ajustado automáticamente.")) return;
    // Pedir contraseña de admin
    setPendingEditData({ movId, isDelete: true });
    setShowPwdModal(true);
  };

  // Procesar la eliminación después de validar contraseña
  const handleConfirmDeleteWithPassword = async () => {
    if (!pendingEditData?.isDelete) return;
    const { movId } = pendingEditData;

    setSavingMovEdit(true);
    try {
      await eliminarMovFn(movId, { admin_password: adminPassword });
      addToast("Movimiento eliminado y saldo ajustado", "success");
      setMovEditando(null);
      setShowPwdModal(false);
      setAdminPassword("");
      setPendingEditData(null);
      loadCC(selected.id);
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || "Error eliminando movimiento";
      // Si es contraseña incorrecta (403), solo mostrar el error sin cerrar modal
      if (status === 403) {
        addToast(message, "error");
      } else {
        addToast(message, "error");
        setShowPwdModal(false);
        setAdminPassword("");
        setPendingEditData(null);
      }
    }
    setSavingMovEdit(false);
  };

  const openNew = () => {
    setForm({ ...emptyForm }); setSelected(null); setIsNew(true); setEditing(true); setViewCC(false);
  };
  const openEdit = () => {
    if (!selected) return;
    const newForm = {};
    for (const k of Object.keys(emptyForm)) newForm[k] = selected[k] ?? "";
    setForm(newForm); setIsNew(false); setEditing(true); setViewCC(false);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { addToast("El nombre es obligatorio", "error"); return; }
    setSaving(true);
    try {
      if (isNew) {
        const res  = await createFn(form);
        const data = res.data || res;
        addToast(`${label} creado`, "success");
        setEditing(false); setIsNew(false);
        if (query) { const r = await searchFn(query); setResults(Array.isArray(r) ? r : r.data); }
        const det = await getFn(data.id);
        setSelected(det.data || det);
      } else {
        await updateFn(selected.id, form);
        setSelected((prev) => ({ ...prev, ...form }));
        addToast(`${label} actualizado`, "success");
        setEditing(false);
      }
    } catch { addToast("Error guardando", "error"); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selected || !confirm(`¿Eliminar a "${selected.name}"?`)) return;
    try {
      await deleteFn(selected.id);
      addToast(`${label} eliminado`, "success");
      setSelected(null); setEditing(false); setCC(null); setViewCC(false);
      setResults((prev) => prev.filter((c) => c.id !== selected.id));
    } catch { addToast("Error eliminando", "error"); }
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px - 80px)", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)", borderRight: "1px solid var(--border)" }}>

        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg2)", flexShrink: 0 }}>
          <div>
            {editing ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {isNew ? `Nuevo ${label.toLowerCase()}` : `Editando — ${selected?.name}`}
              </span>
            ) : selected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{selected.name}</span>
                <DivisaBadge divisa={selected.divisa ?? "ARS"} />
                <div style={{ marginLeft: 16, display: "flex", gap: 4 }}>
                  {["Cta Cte", "Ficha"].map((lbl, i) => (
                    <button key={lbl} onClick={() => i === 0 ? handleVerCC() : setViewCC(false)}
                      style={{ fontSize: 12, padding: "4px 12px", borderRadius: 4, border: "1px solid var(--border)", cursor: "pointer",
                        background: (i === 0 ? viewCC : !viewCC) ? "var(--accent)" : "transparent",
                        color:      (i === 0 ? viewCC : !viewCC) ? "#fff"          : "var(--text-muted)",
                      }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Seleccioná un {label.toLowerCase()} →
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {editing ? (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setIsNew(false); }}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
              </>
            ) : viewCC && selected ? (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => printCCPDF({ entity: selected, cc, mode, cotizacion })}>
                  🖨 Imprimir
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setModalCobranza(true)}>
                  + Registrar Debe / Haber
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nuevo</button>
                {selected && (
                  <>
                    <button className="btn btn-ghost btn-sm"  onClick={openEdit}>✏️ Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑️</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {editing ? (
            <EntityForm form={form} setForm={setForm} mode={mode} />
          ) : !selected ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--text-dim)" }}>
              <span style={{ fontSize: 48 }}>{mode === "cliente" ? "👤" : "🏢"}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em" }}>Buscá y seleccioná un {label.toLowerCase()} →</span>
            </div>
          ) : loadingDetail ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Cargando...</div>
          ) : viewCC ? (
            <CCView cc={cc} loadingCC={loadingCC} mode={mode} cotizacion={cotizacion} onEditMov={setMovEditando} />
          ) : (
            <EntityFicha selected={selected} mode={mode} />
          )}
        </div>
      </div>

      {/* Lista de búsqueda */}
      <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--bg2)" }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input placeholder="Nombre o CUIT..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); setSelected(null); }}
                style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✕</button>
            )}
          </div>
          <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.06em" }}>
            {loadingList ? "Buscando..." : results.length > 0 ? `${results.length} encontrados` : query ? "Sin resultados" : "Escribí para buscar"}
          </div>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: "auto" }}>
          {results.map((c, i) => {
            const isSel = selectedIndex === i || (selectedIndex === -1 && selected?.id === c.id);
            return (
              <div key={c.id} onClick={() => selectEntity(c, i)}
                style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer",
                  background: isSel ? "var(--accent-dim)" : "transparent",
                  borderLeft: `3px solid ${isSel ? "var(--accent)" : "transparent"}`,
                  display: "flex", alignItems: "center", gap: 10,
                }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--bg3)"; }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: 12, color: "var(--text)", fontWeight: isSel ? 500 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  {c.phone && <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{c.phone}</div>}
                </div>
                {c.divisa === "USD" && <span style={{ fontSize: 10, color: "var(--success)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>USD</span>}
                {isSel && <span style={{ color: "var(--accent)", fontSize: 10, flexShrink: 0 }}>◀</span>}
              </div>
            );
          })}
          {!loadingList && results.length === 0 && query && (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.8 }}>
              Sin resultados para<br /><span style={{ color: "var(--text-muted)" }}>"{query}"</span>
            </div>
          )}
          {!query && (
            <div style={{ padding: "60px 16px", textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 2.4 }}>
              ↑<br />Buscá por nombre<br />o CUIT
            </div>
          )}
        </div>
        {results.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.06em", background: "var(--bg3)", flexShrink: 0 }}>
            {results.length} {label.toUpperCase()}S · ↕ SCROLL
          </div>
        )}
      </div>

      {/* Modales */}
      <CobranzaModal
        open={modalCobranza} onClose={() => setModalCobranza(false)}
        onConfirm={handleCobranza} mode={mode} selectedName={selected?.name}
        divisaCuenta={divisaCuenta} cotizacion={cotizacion} saving={savingCobranza}
      />
      <EditMovModal
        open={!!movEditando} onClose={() => setMovEditando(null)}
        movimiento={movEditando}
        onConfirm={handleConfirmEditMov}
        onDelete={handleDeleteMov}
        saving={savingMovEdit}
      />

      {/* Modal de contraseña de admin para cobranzas (editar/eliminar) */}
      {showPwdModal && (
        <div className="modal-overlay" onClick={() => !savingMovEdit && setShowPwdModal(false)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Contraseña requerida</span>
              <button className="modal-close" onClick={() => !savingMovEdit && setShowPwdModal(false)} disabled={savingMovEdit}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                {pendingEditData?.isDelete
                  ? "Solo administradores pueden eliminar cobranzas. Ingrese su contraseña:"
                  : "Solo administradores pueden editar montos de cobranzas. Ingrese su contraseña:"}
              </p>
              <div className="input-group">
                <label className="input-label">Contraseña de administrador</label>
                <input
                  className="input"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !savingMovEdit) {
                      pendingEditData?.isDelete ? handleConfirmDeleteWithPassword() : handleConfirmEditWithPassword();
                    }
                  }}
                  placeholder="Ingrese su contraseña"
                  autoFocus
                  disabled={savingMovEdit}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowPwdModal(false)} disabled={savingMovEdit}>Cancelar</button>
              <button
                className={`btn ${pendingEditData?.isDelete ? "btn-danger" : "btn-primary"}`}
                onClick={pendingEditData?.isDelete ? handleConfirmDeleteWithPassword : handleConfirmEditWithPassword}
                disabled={savingMovEdit || !adminPassword.trim()}>
                {savingMovEdit ? "Verificando..." : pendingEditData?.isDelete ? "Eliminar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab General
// ─────────────────────────────────────────────────────────────
function TabGeneral({ cotizacion }) {
  const [cuentasClientes,    setCuentasClientes]    = useState([]);
  const [cuentasProveedores, setCuentasProveedores] = useState([]);
  const [vendedores,         setVendedores]         = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [vista,      setVista]      = useState("clientes");
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const { addToast, ToastContainer } = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: dataClientes }, { data: provCC }, { data: vends }] = await Promise.all([
          getCuentaCorrienteGeneral(),
          getCCProveedoresSummary(),
          getVendedoresActivos(),
        ]);
        setCuentasClientes(dataClientes);
        setCuentasProveedores(provCC.map((p) => ({ ...p, divisa: p.cc_divisa })));
        setVendedores(vends || []);
      } catch { addToast("Error cargando cuentas corrientes", "error"); }
      setLoading(false);
    })();
  }, []);

  const filteredClientes = cuentasClientes.filter((c) => {
    if (search.trim() && !c.customer_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filtroVendedor && c.customer_vendedor !== filtroVendedor) return false;
    return true;
  });
  const filteredProveedores = cuentasProveedores.filter((p) => !search.trim() || p.name?.toLowerCase().includes(search.toLowerCase()));
  const toARS = (monto, divisa) => divisa === "USD" ? monto * (cotizacion || 1) : monto;

  const totalDeudaClientes    = filteredClientes.reduce((a, c) => a + Math.max(0, toARS(Number(c.saldo || 0), c.divisa ?? "ARS")), 0);
  const totalDeudaProveedores = filteredProveedores.reduce((a, p) => a + Math.max(0, toARS(Number(p.saldo || 0), p.divisa ?? "ARS")), 0);

  return (
    <>
      <ToastContainer />
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-label">Clientes con saldo</div><div className="stat-value accent">{filteredClientes.filter((c) => Number(c.saldo || 0) > 0).length}</div></div>
        <div className="stat-card"><div className="stat-label">Deuda clientes (ARS equiv.)</div><div className="stat-value danger">{fmtARS(totalDeudaClientes)}</div></div>
        <div className="stat-card"><div className="stat-label">Proveedores con saldo</div><div className="stat-value accent">{filteredProveedores.filter((p) => Number(p.saldo || 0) > 0).length}</div></div>
        <div className="stat-card"><div className="stat-label">Deuda proveedores (ARS equiv.)</div><div className="stat-value danger">{fmtARS(totalDeudaProveedores)}</div></div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[["clientes", "👤 Clientes"], ["proveedores", "🏢 Proveedores"]].map(([key, lbl]) => (
            <button key={key} onClick={() => setVista(key)} style={{
              padding: "6px 16px", fontSize: 13, cursor: "pointer", borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: vista === key ? "var(--accent)" : "var(--bg2)",
              color:      vista === key ? "#fff"          : "var(--text-muted)",
            }}>{lbl}</button>
          ))}
        </div>
        <div className="search-bar" style={{ maxWidth: 320 }}>
          <span className="search-icon">🔍</span>
          <input placeholder="Filtrar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✕</button>}
        </div>
        {vista === "clientes" && vendedores.length > 0 && (
          <select
            className="select"
            value={filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)}
            style={{ fontSize: 13, padding: "5px 10px", minWidth: 160 }}
          >
            <option value="">Todos los vendedores</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.nombre}>{v.nombre}</option>
            ))}
          </select>
        )}
        {cotizacion > 0 && (
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", padding: "4px 10px", background: "var(--bg2)", borderRadius: 4, border: "1px solid var(--border)" }}>
            💱 Cotización USD: ${cotizacion.toLocaleString("es-AR")}
          </div>
        )}
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={() => printCCGeneralPDF({
            clientes:    vista === "clientes"    ? filteredClientes    : [],
            proveedores: vista === "proveedores" ? filteredProveedores : [],
            cotizacion,
          })}
        >
          🖨 Imprimir
        </button>
      </div>
      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>Cargando...</div> : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Cuentas corrientes — {vista === "clientes" ? "Clientes" : "Proveedores"}</span>
            <span className="badge badge-info">{vista === "clientes" ? filteredClientes.length : filteredProveedores.length}</span>
          </div>
          {vista === "clientes" ? (
            filteredClientes.length === 0 ? <div className="empty">Sin cuentas corrientes</div> : (
              <div className="table-wrap"><table>
                <thead><tr><th>Cliente</th><th>Divisa</th><th style={{ textAlign:"right" }}>Saldo</th><th style={{ textAlign:"right" }}>Equiv. ARS</th><th>Último débito</th><th>Último pago</th></tr></thead>
                <tbody>
                  {filteredClientes.map((c) => {
                    const divisa = c.divisa ?? "ARS";
                    const saldo  = Number(c.saldo || 0);
                    const color  = saldo > 0 ? "var(--danger)" : saldo < 0 ? "var(--success)" : "var(--text-dim)";
                    return (
                      <tr key={c.id}>
                        <td><div style={{ fontSize:13, fontWeight:500 }}>{c.customer_name}</div>{c.customer_document && <div style={{ fontSize:11, color:"var(--text-dim)", fontFamily:"var(--font-mono)" }}>{c.customer_document}</div>}</td>
                        <td><DivisaBadge divisa={divisa} /></td>
                        <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color }}>{fmtMonto(saldo, divisa)}</td>
                        <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-dim)" }}>{divisa === "USD" ? fmtARS(saldo * (cotizacion || 1)) : "—"}</td>
                        <td style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(c.ultimo_debito)}</td>
                        <td style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(c.ultimo_pago)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )
          ) : (
            filteredProveedores.length === 0 ? <div className="empty">Sin proveedores</div> : (
              <div className="table-wrap"><table>
                <thead><tr><th>Proveedor</th><th>CUIT</th><th>Divisa</th><th style={{ textAlign:"right" }}>Saldo</th><th style={{ textAlign:"right" }}>Equiv. ARS</th><th>Estado</th></tr></thead>
                <tbody>
                  {filteredProveedores.map((p) => {
                    const divisa = p.divisa ?? "ARS";
                    const saldo  = Number(p.saldo || 0);
                    const color  = saldo > 0 ? "var(--danger)" : saldo < 0 ? "var(--success)" : "var(--text-dim)";
                    const lbl    = saldo > 0 ? "Le debemos" : saldo < 0 ? "A nuestro favor" : "Sin saldo";
                    return (
                      <tr key={p.id}>
                        <td style={{ fontSize:13, fontWeight:500 }}>{p.name}</td>
                        <td style={{ fontSize:12, color:"var(--text-dim)", fontFamily:"var(--font-mono)" }}>{p.document || "—"}</td>
                        <td><DivisaBadge divisa={divisa} /></td>
                        <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color }}>{fmtMonto(Math.abs(saldo), divisa)}</td>
                        <td style={{ textAlign:"right", fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-dim)" }}>{divisa === "USD" ? fmtARS(Math.abs(saldo) * (cotizacion || 1)) : "—"}</td>
                        <td><span style={{ fontSize:11, fontFamily:"var(--font-mono)", color, background: saldo !== 0 ? "var(--bg3)" : "transparent", padding:"2px 8px", borderRadius:4, border: saldo !== 0 ? `1px solid ${color}` : "none" }}>{lbl}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )
          )}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export default function CuentaCorriente() {
  useEffect(() => { document.title = "Cuenta corriente — Once"; }, []);
  const [tab,        setTab]        = useState("clientes");
  const [cotizacion, setCotizacion] = useState(0);
  const { addToast, ToastContainer } = useToast();

  // Solo clientes con CC en el buscador
  const searchClientesConCC = (name) => searchCustomers(name, true);
  // Al crear un cliente desde CC, abrirle CC automáticamente
  const createClienteConCC = async (data) => {
    const res = await createCustomer(data);
    const customer = res.data || res;
    try { await openCuentaCorriente(customer.id); } catch {}
    return res;
  };

  useEffect(() => {
    getPriceConfig()
      .then(({ data }) => { const val = data?.cotizacion_dolar; if (val) setCotizacion(Number(val)); })
      .catch(() => {});
  }, []);

  const TABS = [
    { key: "clientes",    label: "👤 Clientes"   },
    { key: "proveedores", label: "🏢 Proveedores" },
    { key: "general",     label: "📋 General"     },
  ];

  return (
    <>
      <ToastContainer />
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer",
            borderRadius: "var(--radius)", border: "1px solid var(--border)",
            background: tab === key ? "var(--accent)" : "var(--bg2)",
            color:      tab === key ? "#fff"          : "var(--text-muted)",
          }}>{label}</button>
        ))}
      </div>

      {tab === "clientes" && (
        <EntityPanel
          mode="cliente"
          searchFn={searchClientesConCC} getFn={getCustomer}
          createFn={createClienteConCC} updateFn={updateCustomer} deleteFn={deleteCustomer}
          getCCFn={getCuentaCorrienteCliente} registrarCobranzaFn={registrarCobranzaCC}
          editarMovFn={editarMovimientoCC} eliminarMovFn={eliminarMovimientoCC}
          emptyForm={EMPTY_CLIENTE} addToast={addToast} cotizacion={cotizacion}
        />
      )}
      {tab === "proveedores" && (
        <EntityPanel
          mode="proveedor"
          searchFn={searchProveedores} getFn={getProveedor}
          createFn={createProveedor} updateFn={updateProveedor} deleteFn={deleteProveedor}
          getCCFn={getCCProveedor} registrarCobranzaFn={registrarCobranzaProveedor}
          editarMovFn={editarMovimientoProv} eliminarMovFn={eliminarMovimientoProv}
          emptyForm={EMPTY_PROVEEDOR} addToast={addToast} cotizacion={cotizacion}
        />
      )}
      {tab === "general" && <TabGeneral cotizacion={cotizacion} />}
    </>
  );
}
