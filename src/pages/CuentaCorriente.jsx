import { useState, useEffect, useRef } from "react";
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
  getPriceConfig, getTransportes, getComprobante,
} from "../utils/api";
import { printComprobantePDF } from "../utils/printDoc";
import { useToast } from "../utils/useToast";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmtARS  = (n) => `$${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtUSD  = (n) => `USD ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "—");
const fmtMonto = (n, divisa) => (divisa === "USD" ? fmtUSD(n) : fmtARS(n));

const COND_IVA    = ["Resp. Inscripto", "Resp. Monotributo", "Consumidor Final", "Exento"];
const METODOS_COBRANZA = ["Efectivo", "Cheque", "Depósito", "Tarjeta", "Mercpago"];

const EMPTY_CLIENTE = {
  name: "", document: "", domicilio: "", codigo_postal: "",
  phone: "", transporte: "", divisa: "ARS",
};
const EMPTY_PROVEEDOR = {
  name: "", document: "", domicilio: "", codigo_postal: "",
  phone: "", transporte: "", divisa: "ARS",
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
// Modal de cobranza
// ─────────────────────────────────────────────────────────────
function CobranzaModal({ open, onClose, onConfirm, mode, selectedName, divisaCuenta, cotizacion, saving }) {
  const [form, setForm] = useState({ monto: "", concepto: "", metodo_pago: "Efectivo", divisa_cobro: "ARS" });
  const [cotizacionCustom, setCotizacionCustom] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ monto: "", concepto: "", metodo_pago: "Efectivo", divisa_cobro: divisaCuenta });
      setCotizacionCustom(String(cotizacion || ""));
    }
  }, [open, divisaCuenta, cotizacion]);

  if (!open) return null;

  const setF = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const setDivisaCobro = (d) => setForm((p) => ({ ...p, divisa_cobro: d }));
  const setMetodo = (m) => setForm((p) => ({ ...p, metodo_pago: m }));

  const cotizUsada = Number(cotizacionCustom) || cotizacion;

  const previewConversion = () => {
    const monto = Number(form.monto);
    if (!monto || !cotizUsada || form.divisa_cobro === divisaCuenta) return null;
    if (form.divisa_cobro === "ARS" && divisaCuenta === "USD") {
      return `= USD ${(monto / cotizUsada).toLocaleString("es-AR", { minimumFractionDigits: 2 })} (cotiz. $${cotizUsada.toLocaleString("es-AR")})`;
    }
    if (form.divisa_cobro === "USD" && divisaCuenta === "ARS") {
      return `= $${(monto * cotizUsada).toLocaleString("es-AR", { minimumFractionDigits: 2 })} (cotiz. $${cotizUsada.toLocaleString("es-AR")})`;
    }
    return null;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{mode === "proveedor" ? "Registrar pago" : "Registrar cobranza"} — {selectedName}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: "8px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-muted)" }}>
            <span>Cuenta en</span><DivisaBadge divisa={divisaCuenta} /><span>— saldo se actualiza en {divisaCuenta}</span>
          </div>
          <div className="input-group">
            <label className="input-label">Divisa del cobro / pago real</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["ARS", "USD"].map((d) => (
                <button key={d} type="button" onClick={() => setDivisaCobro(d)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 6, cursor: "pointer",
                  border: `2px solid ${form.divisa_cobro === d ? (d === "USD" ? "var(--success)" : "var(--accent)") : "var(--border)"}`,
                  background: form.divisa_cobro === d ? (d === "USD" ? "rgba(52,211,153,0.12)" : "var(--accent-dim)") : "var(--bg3)",
                  color: form.divisa_cobro === d ? (d === "USD" ? "var(--success)" : "var(--accent)") : "var(--text-muted)",
                  fontWeight: form.divisa_cobro === d ? 700 : 400, fontFamily: "var(--font-mono)", fontSize: 13,
                }}>
                  {d === "USD" ? "💵 USD" : "🪙 ARS"}
                </button>
              ))}
            </div>
          </div>
          {form.divisa_cobro !== divisaCuenta && (
            <div className="input-group">
              <label className="input-label">Cotización manual (ARS por USD)</label>
              <input className="input" type="number" min="0" step="0.01"
                value={cotizacionCustom}
                onChange={(e) => setCotizacionCustom(e.target.value)}
                placeholder={String(cotizacion)}
              />
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Monto ({form.divisa_cobro})</label>
            <input className="input" type="number" min="0" step="0.01" value={form.monto} onChange={setF("monto")} autoFocus />
            {previewConversion() && (
              <div style={{ marginTop: 6, padding: "6px 10px", background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.25)", borderRadius: 5, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                ⇄ {previewConversion()}
              </div>
            )}
          </div>
          <div className="input-group">
            <label className="input-label">Método de pago</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {METODOS_COBRANZA.map((m) => (
                <button key={m} type="button" onClick={() => setMetodo(m)} style={{
                  padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", fontSize: 13,
                  background: form.metodo_pago === m ? "var(--accent)" : "var(--bg3)",
                  color:      form.metodo_pago === m ? "#fff"          : "var(--text-muted)",
                  fontWeight: form.metodo_pago === m ? 700             : 400,
                }}>{m}</button>
              ))}
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Concepto (opcional)</label>
            <input className="input" value={form.concepto} onChange={setF("concepto")}
              placeholder={mode === "proveedor" ? "Pago a proveedor, NC, etc." : "Cobranza, seña, etc."} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onConfirm({ ...form, cotizacion_manual: cotizUsada })} disabled={saving}>
            {saving ? "Guardando..." : mode === "proveedor" ? "Registrar pago" : "Registrar cobranza"}
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
  const [form, setForm] = useState({ monto: "", concepto: "", metodo_pago: "" });

  useEffect(() => {
    if (open && movimiento) {
      setForm({
        monto:       String(Number(movimiento.monto || 0)),
        concepto:    movimiento.concepto || "",
        metodo_pago: movimiento.metodo_pago || "",
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
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
              {fmtDate(movimiento.created_at)}
            </span>
          </div>

          <div className="input-group">
            <label className="input-label">Nuevo monto ({divisaCC})</label>
            <input className="input" type="number" min="0" step="0.01" value={form.monto} onChange={setF("monto")} autoFocus />
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
            <button className="btn btn-primary" onClick={() => onConfirm(movimiento.id, form)} disabled={saving}>
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
  const saldoColor  = saldo > 0 ? "var(--danger)" : saldo < 0 ? "var(--success)" : "var(--text-dim)";
  const saldoLabel  = esProveedor
    ? (saldo > 0 ? "Le debemos" : "Sin deuda")
    : (saldo > 0 ? "Debe" : "Saldo a favor");

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        <div style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Saldo de la cuenta</div>
            <DivisaBadge divisa={divisa} />
          </div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-mono)", fontWeight: 800, color: saldoColor }}>
            {fmtMonto(Math.abs(saldo), divisa)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{saldoLabel}</div>
          {cotizacion > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              ≈ {divisa === "USD" ? fmtARS(Math.abs(saldo) * cotizacion) : fmtUSD(Math.abs(saldo) / cotizacion)}
              {" · cotiz. $"}{cotizacion.toLocaleString("es-AR")}
            </div>
          )}
        </div>
      </div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        Movimientos ({movimientos.length})
      </div>

      {!movimientos.length ? (
        <div style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12, padding: "24px 0" }}>Sin movimientos</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 100px 120px 110px 70px 60px 36px", gap: 10, padding: "8px 12px", background: "var(--bg3)", borderRadius: "6px 6px 0 0", borderBottom: "2px solid var(--border)" }}>
            {["Fecha", "Concepto", "Método", "Monto CC", "Original", "D.Cobro", "Tipo", ""].map((h) => (
              <div key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
            ))}
          </div>
          {movimientos.map((m) => {
            const divisaCC    = m.divisa_cuenta ?? divisa;
            const divisaCobro = m.divisa_cobro  ?? divisaCC;
            const hayConv     = divisaCobro !== divisaCC;
            return (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: "110px 1fr 100px 120px 110px 70px 60px 36px", gap: 10, padding: "10px 12px", borderBottom: "1px solid var(--border)", alignItems: "center", background: "var(--bg)" }}>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{fmtDate(m.created_at)}</span>
                {m.order_id ? (
                  <button
                    style={{ fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--accent)", textDecoration: "underline", textAlign: "left" }}
                    title="Ver comprobante"
                    onClick={async () => {
                      try { const { data } = await getComprobante(m.order_id); printComprobantePDF(data); } catch {}
                    }}
                  >
                    {m.concepto || "Ver comprobante"}
                  </button>
                ) : (
                  <span style={{ fontSize: 13 }}>{m.concepto || "—"}</span>
                )}
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{m.metodo_pago || "—"}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: m.tipo === "debito" ? "var(--danger)" : "var(--success)" }}>
                  {m.tipo === "debito" ? "+" : "−"}{fmtMonto(m.monto, divisaCC)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: hayConv ? "var(--text-muted)" : "var(--text-dim)" }}>
                  {hayConv && m.monto_original != null ? fmtMonto(m.monto_original, divisaCobro) : "—"}
                </span>
                <span><DivisaBadge divisa={divisaCobro} /></span>
                <span className={`badge ${m.tipo === "debito" ? "badge-danger" : "badge-success"}`} style={{ fontSize: 10 }}>
                  {m.tipo === "debito" ? "Déb" : "Cobro"}
                </span>
                <button
                  onClick={() => onEditMov(m)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", fontSize: 14, padding: "2px 4px", borderRadius: 4 }}
                  title="Editar movimiento">
                  ✏️
                </button>
              </div>
            );
          })}
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

  const handleCobranza = async (formCobranza) => {
    const monto = Number(formCobranza.monto);
    if (!monto || monto <= 0) { addToast("Monto inválido", "error"); return; }
    setSavingCobranza(true);
    try {
      await registrarCobranzaFn(selected.id, {
        monto, concepto: formCobranza.concepto || (mode === "proveedor" ? "Pago a proveedor" : "Cobranza"),
        metodo_pago: formCobranza.metodo_pago, divisa_cobro: formCobranza.divisa_cobro,
        cotizacion_manual: formCobranza.cotizacion_manual ?? null,
      });
      addToast(mode === "proveedor" ? "Pago registrado" : "Cobranza registrada", "success");
      setModalCobranza(false);
      loadCC(selected.id);
      const res = await getFn(selected.id);
      setSelected(res.data || res);
    } catch (err) { addToast(err.response?.data?.message || "Error", "error"); }
    setSavingCobranza(false);
  };

  // Editar movimiento
  const handleConfirmEditMov = async (movId, form) => {
    setSavingMovEdit(true);
    try {
      await editarMovFn(movId, {
        monto:       form.monto ? Number(form.monto) : undefined,
        concepto:    form.concepto,
        metodo_pago: form.metodo_pago || null,
      });
      addToast("Movimiento actualizado", "success");
      setMovEditando(null);
      loadCC(selected.id);
    } catch (err) { addToast(err?.response?.data?.message || "Error actualizando movimiento", "error"); }
    setSavingMovEdit(false);
  };

  const handleDeleteMov = async (movId) => {
    if (!confirm("¿Eliminar este movimiento? El saldo de la cuenta será ajustado automáticamente.")) return;
    setSavingMovEdit(true);
    try {
      await eliminarMovFn(movId);
      addToast("Movimiento eliminado y saldo ajustado", "success");
      setMovEditando(null);
      loadCC(selected.id);
    } catch (err) { addToast(err?.response?.data?.message || "Error eliminando movimiento", "error"); }
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
              <button className="btn btn-primary btn-sm" onClick={() => setModalCobranza(true)}>
                {mode === "proveedor" ? "Registrar pago" : "+ Registrar cobranza"}
              </button>
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab General
// ─────────────────────────────────────────────────────────────
function TabGeneral({ cotizacion }) {
  const [cuentasClientes,    setCuentasClientes]    = useState([]);
  const [cuentasProveedores, setCuentasProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [vista,   setVista]   = useState("clientes");
  const { addToast, ToastContainer } = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: dataClientes }, { data: provCC }] = await Promise.all([
          getCuentaCorrienteGeneral(),
          getCCProveedoresSummary(),
        ]);
        setCuentasClientes(dataClientes);
        setCuentasProveedores(provCC.map((p) => ({ ...p, divisa: p.cc_divisa })));
      } catch { addToast("Error cargando cuentas corrientes", "error"); }
      setLoading(false);
    })();
  }, []);

  const filteredClientes    = cuentasClientes.filter((c) => !search.trim() || c.customer_name?.toLowerCase().includes(search.toLowerCase()));
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
        {cotizacion > 0 && (
          <div style={{ marginLeft: "auto", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", padding: "4px 10px", background: "var(--bg2)", borderRadius: 4, border: "1px solid var(--border)" }}>
            💱 Cotización USD: ${cotizacion.toLocaleString("es-AR")}
          </div>
        )}
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
