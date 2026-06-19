import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  getComprobantes, getComprobante, createComprobante, updateComprobante,
  deleteComprobante, searchCustomers, searchProveedores, getWarehouses,
  getLastSalePrice, getPriceConfig,
} from "../utils/api";
import { useAuth } from "../utils/useAuth";
import { useToast } from "../utils/useToast";
import { useVendedores } from "../utils/useVendedores";
import ProductSearchBar from "../components/ProductSearchBar";
import { printComprobantePDF } from "../utils/printDoc";

// ── Constantes ─────────────────────────────────────────────────
const TIPOS   = ["Presupuesto","Devolucion","Nota de Pedido","Reposicion","Devol a proveedor"];
const PAGOS   = ["Contado","Cta Cte","Tarjeta","Banco","Mercado Pago","Cheque"];
const PRECIOS = ["precio_1","precio_2","precio_3","precio_4","precio_5","costo"];
const PRECIO_LBL = {
  precio_1:"Precio #1", precio_2:"Precio #2", precio_3:"Precio #3",
  precio_4:"Precio #4", precio_5:"Precio #5", costo:"Costo",
};
const TIPOS_CON_CONSUMIDOR_FINAL = ["Presupuesto","Devolucion","Nota de Pedido"];
const today = () => new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });
const fmt   = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Componente de fila de item editable ────────────────────────
function ItemRow({ item, idx, onRemove, onChangeQty, onChangePrice, onChangeDesc }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 90px 110px 110px 36px", gap:8, padding:"10px 0", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)" }}>{item.code || "—"}</span>
      <input
        className="input"
        style={{ fontSize:13, height:32, padding:"0 8px" }}
        value={item.description || item.name}
        onChange={(e) => onChangeDesc(idx, e.target.value)}
      />
      <input
        className="input"
        style={{ fontSize:13, height:32, textAlign:"center", fontFamily:"var(--font-mono)", padding:"0 6px" }}
        type="text" inputMode="numeric"
        value={item.quantity}
        onChange={(e) => onChangeQty(idx, e.target.value)}
      />
      <input
        className="input"
        style={{ fontSize:13, height:32, textAlign:"right", fontFamily:"var(--font-mono)", color:"var(--accent)", padding:"0 8px" }}
        type="text" inputMode="decimal"
        value={item.unit_price}
        onChange={(e) => onChangePrice(idx, e.target.value)}
      />
      <span style={{ fontFamily:"var(--font-mono)", fontSize:13, textAlign:"right", color:"var(--accent)", fontWeight:700 }}>
        {(Number(item.quantity) * Number(item.unit_price)).toLocaleString("es-AR", { minimumFractionDigits:2, maximumFractionDigits:2 })}
      </span>
      <button onClick={() => onRemove(idx)} style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", fontSize:18, textAlign:"center" }}>✕</button>
    </div>
  );
}

// ── Panel izquierdo de configuración ──────────────────────────
function LeftPanel({
  tipo, setTipo, payMethod, setPayMethod, priceType, setPriceType,
  vendedor, setVendedor, textoLibre, setTextoLibre,
  esReposicion, admiteConsumidorFinal,
  esConsumidorFinal, toggleConsumidorFinal,
  consumidorFinalNombre, setConsumidorFinalNombre,
  divisa, setDivisa,
  custSel, custQuery, setCustQuery, custResults, selectCust, setCustSel,
  provSel, provQuery, setProvQuery, provResults, selectProv, setProvSel,
  warehouses, warehouseId, setWarehouseId,
  vendedores, lastPrice, user,
  onSave, onCancel, onReset, onPresupuestar, saving, isEditing,
  total, itemCount,
  onObsEnter,
}) {
  const [showConfig, setShowConfig] = useState(false);
  const [focusedSection, setFocusedSection] = useState(null);

  // ── Refs para navegación por teclado ──────────────────────
  const tipoWrapRef   = useRef(null);
  const cfToggleRef   = useRef(null);
  const cfNombreRef   = useRef(null);
  const divisaWrapRef = useRef(null);
  const custInputRef  = useRef(null);
  const pagoWrapRef   = useRef(null);
  const precioWrapRef = useRef(null);
  const vendedorRef   = useRef(null);
  const obsRef        = useRef(null);
  const [custHighlight, setCustHighlight] = useState(-1);
  const [provHighlight, setProvHighlight] = useState(-1);
  const custDropdownRef = useRef(null);
  const provDropdownRef = useRef(null);

  // Auto-foco en tipo al abrir el formulario
  useEffect(() => {
    if (!isEditing) {
      const t = setTimeout(() => tipoWrapRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, []);

  // Auto-highlightea el primer resultado al aparecer
  useEffect(() => { setCustHighlight(custResults.length > 0 ? 0 : -1); }, [custResults]);
  useEffect(() => { setProvHighlight(provResults.length > 0 ? 0 : -1); }, [provResults]);

  // Scroll al ítem resaltado en el dropdown
  useEffect(() => {
    if (custHighlight >= 0 && custDropdownRef.current) {
      custDropdownRef.current.children[custHighlight]?.scrollIntoView({ block: "nearest" });
    }
  }, [custHighlight]);
  useEffect(() => {
    if (provHighlight >= 0 && provDropdownRef.current) {
      provDropdownRef.current.children[provHighlight]?.scrollIntoView({ block: "nearest" });
    }
  }, [provHighlight]);

  const sectionFocusProps = (name) => ({
    onFocus: () => setFocusedSection(name),
    onBlur:  (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusedSection(null); },
  });

  // Abre la config y foca el pago cuando se selecciona entidad
  const selectCustAndFocus = (c) => {
    selectCust(c);
    setShowConfig(true);
    setTimeout(() => pagoWrapRef.current?.focus(), 80);
  };
  const selectProvAndFocus = (p) => {
    selectProv(p);
    setShowConfig(true);
    setTimeout(() => pagoWrapRef.current?.focus(), 80);
  };

  // Handler teclado tipo
  const handleTipoKeyDown = (e) => {
    if (isEditing) return;
    const idx = TIPOS.indexOf(tipo);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setTipo(TIPOS[Math.min(idx + 1, TIPOS.length - 1)]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setTipo(TIPOS[Math.max(idx - 1, 0)]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (admiteConsumidorFinal) cfToggleRef.current?.focus();
      else custInputRef.current?.focus();
    }
  };

  // Handler teclado divisa ARS/USD
  const handleDivisaKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setDivisa((d) => (d === "ARS" ? "USD" : "ARS"));
    } else if (e.key === "Enter") {
      e.preventDefault();
      setShowConfig(true);
      setTimeout(() => pagoWrapRef.current?.focus(), 50);
    }
  };

  // Handler teclado toggle Cliente/Consumidor Final
  const handleCfToggleKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      toggleConsumidorFinal(!esConsumidorFinal);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (esConsumidorFinal) cfNombreRef.current?.focus();
      else custInputRef.current?.focus();
    }
  };

  // Handler teclado búsqueda cliente
  const handleCustKeyDown = (e) => {
    if (custResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCustHighlight((i) => Math.min(i + 1, custResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCustHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Si no hay highlight, selecciona el primero
      const idx = custHighlight >= 0 ? custHighlight : 0;
      selectCustAndFocus(custResults[idx]);
    }
  };

  // Handler teclado búsqueda proveedor
  const handleProvKeyDown = (e) => {
    if (provResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setProvHighlight((i) => Math.min(i + 1, provResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setProvHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = provHighlight >= 0 ? provHighlight : 0;
      selectProvAndFocus(provResults[idx]);
    }
  };

  // Handler teclado pago
  const handlePagoKeyDown = (e) => {
    const idx = PAGOS.indexOf(payMethod);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setPayMethod(PAGOS[Math.min(idx + 1, PAGOS.length - 1)]);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      setPayMethod(PAGOS[Math.max(idx - 1, 0)]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!esReposicion) precioWrapRef.current?.focus();
      else vendedorRef.current?.focus();
    }
  };

  // Handler teclado precio
  const handlePrecioKeyDown = (e) => {
    const idx = PRECIOS.indexOf(priceType);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setPriceType(PRECIOS[Math.min(idx + 1, PRECIOS.length - 1)]);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      setPriceType(PRECIOS[Math.max(idx - 1, 0)]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      vendedorRef.current?.focus();
    }
  };

  return (
    <div style={{ width:300, flexShrink:0, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", background:"var(--bg2)", overflow:"hidden" }}>

      {/* Header compacto */}
      <div style={{ padding:"14px 16px 10px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, fontWeight:700, color:"var(--accent)", letterSpacing:"0.1em", textTransform:"uppercase" }}>
            {isEditing ? "✏️ Editando" : "Nuevo comprobante"}
          </div>
          {!isEditing && (
            <button
              onClick={() => { onReset(); setTimeout(() => tipoWrapRef.current?.focus(), 50); }}
              style={{ fontSize:10, padding:"3px 9px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:4, color:"var(--accent)", cursor:"pointer", fontFamily:"var(--font-mono)", fontWeight:700, letterSpacing:"0.06em" }}
              title="Borrar todo y empezar un nuevo comprobante"
            >
              + NUEVO
            </button>
          )}
        </div>

        {/* Tipo — botones compactos 2 columnas */}
        {!isEditing && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>Tipo</div>
            {focusedSection === 'tipo' && (
              <div style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--accent)", letterSpacing:"0.06em", opacity:0.8 }}>↑↓ · ENTER avanza</div>
            )}
          </div>
        )}
        <div
          ref={tipoWrapRef}
          tabIndex={isEditing ? -1 : 0}
          onKeyDown={handleTipoKeyDown}
          {...sectionFocusProps('tipo')}
          style={{
            display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, outline:"none",
            borderRadius:6, padding:2, transition:"box-shadow 0.15s",
            boxShadow: focusedSection === 'tipo' ? "0 0 0 2px var(--accent)" : "none",
          }}
        >
          {TIPOS.map((t) => (
            <button key={t} onClick={() => setTipo(t)}
              disabled={isEditing}
              style={{
                padding:"6px 4px", borderRadius:4, cursor: isEditing ? "default" : "pointer",
                fontSize:11, fontFamily:"var(--font-mono)", border:"1px solid var(--border)",
                background: tipo===t ? "var(--accent-dim)" : "transparent",
                color:      tipo===t ? "var(--accent)"     : "var(--text-dim)",
                borderColor: tipo===t ? "var(--accent)"    : "var(--border)",
                fontWeight: tipo===t ? 700 : 400,
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                opacity: isEditing ? 0.6 : 1,
                transform: (focusedSection === 'tipo' && tipo === t) ? "scale(1.03)" : "none",
                transition: "transform 0.1s, box-shadow 0.1s",
              }}
              title={t}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Cliente / Proveedor */}
      <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
        <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
          {esReposicion ? "Proveedor" : "Cliente"}
        </div>

        {esReposicion ? (
          provSel ? (
            <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600 }}>{provSel.name}</span>
              <button onClick={() => { setProvSel(null); setDivisa("ARS"); }} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:14 }}>✕</button>
            </div>
          ) : (
            <>
              <div className="search-bar" style={{ height:34 }}>
                <span className="search-icon">🔍</span>
                <input
                  ref={custInputRef}
                  placeholder="Nombre o CUIT..."
                  value={provQuery}
                  onChange={(e) => setProvQuery(e.target.value)}
                  onKeyDown={handleProvKeyDown}
                  style={{ fontSize:12 }}
                />
              </div>
              {provResults.length > 0 && (
                <div ref={provDropdownRef} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, maxHeight:140, overflowY:"auto", marginTop:4 }}>
                  {provResults.map((p, i) => (
                    <div key={p.id}
                      onClick={() => selectProvAndFocus(p)}
                      style={{
                        padding:"8px 10px", fontSize:13, cursor:"pointer",
                        borderBottom:"1px solid var(--border)",
                        color:      i === provHighlight ? "var(--accent)" : "var(--text)",
                        fontWeight: i === provHighlight ? 600 : 400,
                        background: i === provHighlight ? "var(--accent-dim)" : "transparent",
                        borderLeft: `3px solid ${i === provHighlight ? "var(--accent)" : "transparent"}`,
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                      }}
                      onMouseEnter={() => setProvHighlight(i)}
                      onMouseLeave={() => setProvHighlight(-1)}>
                      <span>{p.name}</span>
                      {i === provHighlight && <span style={{ fontSize:10, fontFamily:"var(--font-mono)", opacity:0.7 }}>ENTER ↵</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        ) : (
          <>
            {admiteConsumidorFinal && (
              <div style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>Tipo cliente</div>
                  {focusedSection === 'cfToggle' && (
                    <div style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--accent)", letterSpacing:"0.06em", opacity:0.8 }}>←→ · ENTER avanza</div>
                  )}
                </div>
                <div
                  ref={cfToggleRef}
                  tabIndex={0}
                  onKeyDown={handleCfToggleKeyDown}
                  {...sectionFocusProps('cfToggle')}
                  style={{
                    display:"flex", gap:4, outline:"none",
                    borderRadius:6, padding:2, transition:"box-shadow 0.15s",
                    boxShadow: focusedSection === 'cfToggle' ? "0 0 0 2px var(--accent)" : "none",
                  }}
                >
                  {["Cliente","Cons. Final"].map((lbl, i) => {
                    const isCF = i === 1;
                    const active = esConsumidorFinal === isCF;
                    return (
                      <button key={lbl} onClick={() => toggleConsumidorFinal(isCF)}
                        style={{
                          flex:1, padding:"5px 0", borderRadius:4, cursor:"pointer", fontSize:11,
                          fontFamily:"var(--font-mono)", border:"1px solid var(--border)",
                          background: active ? "var(--accent-dim)" : "transparent",
                          color:      active ? "var(--accent)"     : "var(--text-dim)",
                          fontWeight: active ? 700 : 400,
                          transform: (focusedSection === 'cfToggle' && active) ? "scale(1.03)" : "none",
                          transition: "transform 0.1s",
                        }}>
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {esConsumidorFinal ? (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <input ref={cfNombreRef} className="input" placeholder="Nombre (opcional)" value={consumidorFinalNombre}
                  onChange={(e) => setConsumidorFinalNombre(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); divisaWrapRef.current?.focus(); } }}
                  style={{ fontSize:12, height:32 }} />
                <div
                  ref={divisaWrapRef}
                  tabIndex={0}
                  onKeyDown={handleDivisaKeyDown}
                  {...sectionFocusProps('divisa')}
                  style={{
                    display:"flex", gap:4, outline:"none",
                    borderRadius:6, padding:2, transition:"box-shadow 0.15s",
                    boxShadow: focusedSection === 'divisa' ? "0 0 0 2px var(--accent)" : "none",
                  }}
                >
                  {["ARS","USD"].map((d) => (
                    <button key={d} onClick={() => setDivisa(d)}
                      style={{
                        flex:1, padding:"6px 0", borderRadius:4, cursor:"pointer", fontSize:12,
                        fontFamily:"var(--font-mono)", fontWeight:700,
                        border:`1px solid ${divisa===d ? "var(--accent)" : "var(--border)"}`,
                        background: divisa===d ? "var(--accent-dim)" : "transparent",
                        color:      divisa===d ? "var(--accent)"     : "var(--text-muted)",
                        transform: (focusedSection === 'divisa' && divisa === d) ? "scale(1.03)" : "none",
                        transition: "transform 0.1s",
                      }}>
                      {d === "ARS" ? "🪙 ARS" : "💵 USD"}
                    </button>
                  ))}
                </div>
              </div>
            ) : custSel ? (
              <div style={{ background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:13, color:"var(--accent)", fontWeight:600 }}>{custSel.name}</span>
                <button onClick={() => { setCustSel(null); setDivisa("ARS"); }} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:14 }}>✕</button>
              </div>
            ) : (
              <>
                <div className="search-bar" style={{ height:34 }}>
                  <span className="search-icon">🔍</span>
                  <input
                    ref={custInputRef}
                    placeholder="Nombre o CUIT..."
                    value={custQuery}
                    onChange={(e) => setCustQuery(e.target.value)}
                    onKeyDown={handleCustKeyDown}
                    style={{ fontSize:12 }}
                  />
                </div>
                {custResults.length > 0 && (
                  <div ref={custDropdownRef} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, maxHeight:140, overflowY:"auto", marginTop:4 }}>
                    {custResults.map((c, i) => (
                      <div key={c.id}
                        onClick={() => selectCustAndFocus(c)}
                        style={{
                          padding:"8px 10px", fontSize:13, cursor:"pointer",
                          borderBottom:"1px solid var(--border)",
                          color:      i === custHighlight ? "var(--accent)" : "var(--text)",
                          fontWeight: i === custHighlight ? 600 : 400,
                          background: i === custHighlight ? "var(--accent-dim)" : "transparent",
                          borderLeft: `3px solid ${i === custHighlight ? "var(--accent)" : "transparent"}`,
                          display:"flex", alignItems:"center", justifyContent:"space-between",
                        }}
                        onMouseEnter={() => setCustHighlight(i)}
                        onMouseLeave={() => setCustHighlight(-1)}>
                        <span>{c.name}</span>
                        {i === custHighlight && <span style={{ fontSize:10, fontFamily:"var(--font-mono)", opacity:0.7 }}>ENTER ↵</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Configuración colapsable */}
      <div style={{ flex:1, overflowY:"auto" }}>
        <button
          onClick={() => setShowConfig(v => !v)}
          style={{ width:"100%", padding:"10px 16px", background:"transparent", border:"none", borderBottom:"1px solid var(--border)", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em" }}>
          Configuración
          <span style={{ fontSize:14, transform: showConfig ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}>▾</span>
        </button>

        {showConfig && (
          <div style={{ padding:"12px 16px" }}>
            {esReposicion && (
              <div className="input-group">
                <label className="input-label">{tipo === "Devol a proveedor" ? "Depósito origen" : "Depósito destino"}</label>
                <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={{ fontSize:12, height:32 }}>
                  <option value="">— seleccionar —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
            <div className="input-group">
              <label className="input-label" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span>Método de pago</span>
                <span style={{ fontSize:9, color: focusedSection === 'pago' ? "var(--accent)" : "var(--text-dim)", fontWeight:400, transition:"color 0.15s" }}>↑↓ · Enter avanza</span>
              </label>
              <div
                ref={pagoWrapRef}
                tabIndex={0}
                onKeyDown={handlePagoKeyDown}
                {...sectionFocusProps('pago')}
                style={{
                  display:"flex", flexWrap:"wrap", gap:4, outline:"none",
                  borderRadius:6, padding:2, transition:"box-shadow 0.15s",
                  boxShadow: focusedSection === 'pago' ? "0 0 0 2px var(--accent)" : "none",
                }}
              >
                {PAGOS.map((p) => (
                  <button key={p} onClick={() => setPayMethod(p)}
                    style={{
                      padding:"5px 10px", borderRadius:4, fontSize:11, fontFamily:"var(--font-mono)", cursor:"pointer",
                      border: `1px solid ${payMethod===p ? "var(--accent)" : "var(--border)"}`,
                      background: payMethod===p ? "var(--accent)" : "transparent",
                      color:      payMethod===p ? "#fff"          : "var(--text-dim)",
                      fontWeight: payMethod===p ? 700 : 400,
                      transition: "background 0.1s, border-color 0.1s",
                    }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {!esReposicion && (
              <div className="input-group">
                <label className="input-label" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>Tipo de precio</span>
                  <span style={{ fontSize:9, color: focusedSection === 'precio' ? "var(--accent)" : "var(--text-dim)", fontWeight:400, transition:"color 0.15s" }}>↑↓ · Enter avanza</span>
                </label>
                <div
                  ref={precioWrapRef}
                  tabIndex={0}
                  onKeyDown={handlePrecioKeyDown}
                  {...sectionFocusProps('precio')}
                  style={{
                    display:"flex", flexWrap:"wrap", gap:4, outline:"none",
                    borderRadius:6, padding:2, transition:"box-shadow 0.15s",
                    boxShadow: focusedSection === 'precio' ? "0 0 0 2px var(--accent)" : "none",
                  }}
                >
                  {PRECIOS.map((p) => (
                    <button key={p} onClick={() => setPriceType(p)}
                      style={{
                        padding:"5px 10px", borderRadius:4, fontSize:11, fontFamily:"var(--font-mono)", cursor:"pointer",
                        border: `1px solid ${priceType===p ? "var(--accent)" : "var(--border)"}`,
                        background: priceType===p ? "var(--accent-dim)" : "transparent",
                        color:      priceType===p ? "var(--accent)"     : "var(--text-dim)",
                        fontWeight: priceType===p ? 700 : 400,
                        transition: "background 0.1s, border-color 0.1s",
                      }}>
                      {PRECIO_LBL[p]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Vendedor</label>
              <select
                ref={vendedorRef}
                className="select"
                value={vendedor}
                onChange={(e) => setVendedor(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); obsRef.current?.focus(); } }}
                style={{ fontSize:12, height:32 }}
              >
                <option value="">— ninguno —</option>
                {vendedores.map((v) => <option key={v.id} value={v.nombre}>{v.nombre}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Observaciones</label>
              <input
                ref={obsRef}
                className="input"
                value={textoLibre}
                onChange={(e) => setTextoLibre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onObsEnter?.(); } }}
                placeholder="Texto libre... (Enter para continuar)"
                style={{ fontSize:12, height:32 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Resumen y botones */}
      <div style={{ padding:"12px 16px", borderTop:"1px solid var(--border)", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, padding:"8px 10px", background:"var(--bg3)", borderRadius:6 }}>
          <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-dim)" }}>
            {itemCount} ítem{itemCount !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize:15, fontFamily:"var(--font-mono)", fontWeight:800, color:"var(--accent)" }}>
            {divisa === "USD" ? "USD " : "$"}{fmt(total)}
          </span>
        </div>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}
          style={{ width:"100%", fontSize:14, padding:"11px", marginBottom:6 }}>
          {saving ? "Guardando..." : isEditing ? "✓ Guardar cambios" : "✓ Cerrar comprobante"}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} style={{ width:"100%", fontSize:13 }}>
          Cancelar
        </button>
        {isEditing && tipo === "Nota de Pedido" && onPresupuestar && (
          <button className="btn btn-primary" onClick={onPresupuestar} disabled={saving} style={{ width:"100%", fontSize:13, marginTop:6 }}>
            → Presupuestar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────
export default function Comprobantes({ initialCreating = false }) {
  const { editId } = useParams() ?? {};
  const { user } = useAuth();
  const vendedores = useVendedores();
  const [comprobantes, setComprobantes] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [loadingDetail,setLoadingDetail]= useState(false);
  const [creating,     setCreating]     = useState(initialCreating);
  const [editingId,    setEditingId]    = useState(null); // id del comprobante en edición

  const [from,        setFrom]        = useState(today());
  const [to,          setTo]          = useState(today());
  const [appliedFrom, setAppliedFrom] = useState(today());
  const [appliedTo,   setAppliedTo]   = useState(today());
  const filterDirty = from !== appliedFrom || to !== appliedTo;
  const [filterTipo, setFilterTipo] = useState("");
  const filteredComprobantes = filterTipo
    ? comprobantes.filter((c) => c.tipo === filterTipo)
    : comprobantes;
  const [deleteModal,    setDeleteModal]    = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting,       setDeleting]       = useState(false);

  // Form state
  const [tipo,       setTipo]       = useState("Presupuesto");
  const [payMethod,  setPayMethod]  = useState("Contado");
  const [priceType,  setPriceType]  = useState("precio_1");
  const [vendedor,   setVendedor]   = useState("");
  const [textoLibre, setTextoLibre] = useState("");

  const [esConsumidorFinal,     setEsConsumidorFinal]     = useState(false);
  const [consumidorFinalNombre, setConsumidorFinalNombre] = useState("");
  const [divisa,                setDivisa]                = useState("ARS");
  const divisaRef        = useRef("ARS");
  const itemsBaseDivisaRef = useRef("ARS");  // Divisa en la que están almacenados los items cargados
  const cotizacionRef    = useRef(1);
  const skipDivisaConv   = useRef(false);
  const changeDivisa = (valOrFn) => {
    const next = typeof valOrFn === "function" ? valOrFn(divisaRef.current) : valOrFn;
    divisaRef.current = next;
    setDivisa(next);
  };

  const [custQuery,   setCustQuery]   = useState("");
  const [custResults, setCustResults] = useState([]);
  const [custSel,     setCustSel]     = useState(null);

  const [provQuery,   setProvQuery]   = useState("");
  const [provResults, setProvResults] = useState([]);
  const [provSel,     setProvSel]     = useState(null);

  const [warehouses,         setWarehouses]         = useState([]);
  const [warehouseId,        setWarehouseId]        = useState("");
  const preferredWhRef = useRef("");

  const [items,       setItems]       = useState([]);
  const [prodSel,     setProdSel]     = useState(null);
  const [itemQty,     setItemQty]     = useState("");
  const [itemPrice,   setItemPrice]   = useState("");
  const [itemDesc,    setItemDesc]    = useState("");
  const [saving,      setSaving]      = useState(false);
  const [lastPrice,   setLastPrice]   = useState(null);
  const [descuentoPct, setDescuentoPct] = useState("0");
  const [cotizacion,  setCotizacion]  = useState(1);

  const qtyRef        = useRef(null);
  const priceRef      = useRef(null);
  const prodSearchRef = useRef(null);
  const { addToast, ToastContainer } = useToast();

  const esReposicion          = tipo === "Reposicion" || tipo === "Devol a proveedor";
  const admiteConsumidorFinal = TIPOS_CON_CONSUMIDOR_FINAL.includes(tipo);
  const admiteDescuento       = ["Presupuesto", "Presupuesto Web", "Nota de Pedido", "Nota de Pedido Web", "Reposicion"].includes(tipo);
  const descuentoPctNum       = parseFloat(descuentoPct) || 0;
  const isEditing             = !!editingId;
  const subtotal              = items.reduce((a, it) => a + it.quantity * it.unit_price, 0);
  const total                 = admiteDescuento && descuentoPctNum !== 0
    ? Math.round(subtotal * (1 - descuentoPctNum / 100) * 100) / 100
    : subtotal;

  // Pre-populate warehouseId with preferred warehouse (or user's warehouse) when switching to Reposicion
  useEffect(() => {
    if (esReposicion && !warehouseId) {
      const defaultWh = preferredWhRef.current || user?.warehouse_id || "";
      if (defaultWh) setWarehouseId(defaultWh);
    }
  }, [esReposicion]);

  // ── Carga ─────────────────────────────────────────────────────
  const loadAll = async (f = appliedFrom, t = appliedTo) => {
    setLoading(true);
    try { const { data } = await getComprobantes(f, t); setComprobantes(data); }
    catch { addToast("Error cargando comprobantes", "error"); }
    setLoading(false);
  };

  const applyFilter = () => { setAppliedFrom(from); setAppliedTo(to); loadAll(from, to); };
  useEffect(() => { loadAll(today(), today()); }, []);
  useEffect(() => {
    getPriceConfig().then(({ data }) => {
      const v = Number(data.cotizacion_dolar) || 1;
      cotizacionRef.current = v;
      setCotizacion(v);
      if (data.preferred_warehouse_id) preferredWhRef.current = data.preferred_warehouse_id;
    }).catch(() => {});
  }, []);

  // Cuando divisa cambia (por selección de cliente/proveedor o toggle manual),
  // convertir los precios de los items ya cargados.
  // Los items se almacenan en itemsBaseDivisaRef (la divisa en la que se cargaron).
  // Convertimos FROM itemsBaseDivisaRef TO divisa usando la cotización actual.
  const prevDivisaRef = useRef("ARS");
  useEffect(() => {
    const prev = prevDivisaRef.current;
    prevDivisaRef.current = divisa;
    if (prev === divisa) return;
    if (skipDivisaConv.current) { skipDivisaConv.current = false; return; }

    const performConversion = (cotiz) => {
      if (!cotiz || cotiz <= 0) return;
      const baseDivisa = itemsBaseDivisaRef.current;

      setItems((prevItems) =>
        prevItems.length === 0 ? prevItems : prevItems.map((it) => {
          let newPrice = Number(it.unit_price);

          // Convertir desde baseDivisa a divisa objetivo
          if (baseDivisa === divisa) {
            // Ya están en la divisa correcta, no convertir
            return { ...it, unit_price: newPrice };
          } else if (baseDivisa === "ARS" && divisa === "USD") {
            // ARS → USD: dividir por cotización
            newPrice = Math.round((newPrice / cotiz) * 100) / 100;
          } else if (baseDivisa === "USD" && divisa === "ARS") {
            // USD → ARS: multiplicar por cotización
            newPrice = Math.round((newPrice * cotiz) * 100) / 100;
          }

          return { ...it, unit_price: newPrice };
        })
      );
    };

    const cotiz = cotizacionRef.current;
    if (cotiz && cotiz > 0) {
      performConversion(cotiz);
    } else {
      // Si la cotización no está cargada, cargarla ahora
      getPriceConfig().then(({ data }) => {
        const v = Number(data.cotizacion_dolar) || 1;
        cotizacionRef.current = v;
        setCotizacion(v);
        performConversion(v);
      }).catch(() => {
        performConversion(1); // Usar 1 como fallback
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisa]);

  useEffect(() => {
    if (editId || creating || initialCreating) {
      document.title = editId ? "Editar comprobante — Once" : "Nuevo comprobante — Once";
    } else {
      document.title = "Comprobantes — Once";
    }
  }, [editId, creating, initialCreating]);

  useEffect(() => { if (!admiteConsumidorFinal) setEsConsumidorFinal(false); }, [tipo, admiteConsumidorFinal]);

  useEffect(() => {
    if (esReposicion && warehouses.length === 0) {
      getWarehouses().then(({ data }) => setWarehouses(data)).catch(() => {});
    }
  }, [esReposicion]);

  useEffect(() => {
    if (!custQuery.trim() || esReposicion || esConsumidorFinal) { setCustResults([]); return; }
    const t = setTimeout(async () => {
      try { const { data } = await searchCustomers(custQuery, true); setCustResults(data); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [custQuery, esReposicion, esConsumidorFinal]);

  useEffect(() => {
    if (!provQuery.trim() || !esReposicion) { setProvResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await searchProveedores(provQuery);
        setProvResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [provQuery, esReposicion]);

  useEffect(() => {
    if (prodSel) {
      const prices = prodSel?.prices || prodSel?.product_prices || [];
      const found  = prices.find((p) => p.price_type === (esReposicion ? "costo" : priceType));
      if (found) {
        const raw = divisa === "USD" ? (found.price_usd ?? found.price) : found.price;
        setItemPrice(String(Math.ceil(Number(raw) * 100) / 100));
      } else {
        setItemPrice("");
      }
    }
  }, [priceType, prodSel, divisa]);

  const fetchLastPrice = useCallback(async (productId) => {
    if (!custSel?.id || !productId || esReposicion || esConsumidorFinal) { setLastPrice(null); return; }
    try { const { data } = await getLastSalePrice(custSel.id, productId); setLastPrice(data || null); }
    catch { setLastPrice(null); }
  }, [custSel, esReposicion, esConsumidorFinal]);

  const selectCust = (c) => {
    const newDivisa = c.divisa || "ARS";
    setCustSel(c); setCustQuery(""); setCustResults([]); setLastPrice(null); changeDivisa(newDivisa); if (c.vendedor) setVendedor(c.vendedor);
  };
  const selectProv = (p) => {
    const newDivisa = p.divisa || "ARS";
    setProvSel(p); setProvQuery(""); setProvResults([]); changeDivisa(newDivisa);
  };

  const toggleConsumidorFinal = (val) => {
    setEsConsumidorFinal(val);
    if (val) { setCustSel(null); setCustQuery(""); setCustResults([]); setLastPrice(null); }
    else     { setConsumidorFinalNombre(""); changeDivisa("ARS"); }
  };

  const [searchActive, setSearchActive] = useState(false);

  const handleProdSelect = ({ product, price }) => {
    setProdSel(product);
    setSearchActive(false);
    setItemDesc(product.name);
    setItemPrice(price > 0 ? String(price) : "");
    if (!esConsumidorFinal) fetchLastPrice(product.id);
    setTimeout(() => qtyRef.current?.focus(), 50);
  };

  const confirmItem = () => {
    if (!prodSel)                         { addToast("Seleccioná un producto", "error"); return; }
    if (!itemQty || Number(itemQty) <= 0) { addToast("Ingresá una cantidad válida", "error"); return; }
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.product_id === prodSel.id);
      if (idx >= 0) {
        return prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + Number(itemQty) } : it);
      }
      return [...prev, {
        product_id:  prodSel.id,
        code:        prodSel.code || "",
        name:        prodSel.name,
        description: itemDesc || prodSel.name,
        quantity:    Number(itemQty),
        unit_price:  Number(itemPrice) || 0,
      }];
    });
    setProdSel(null); setItemQty(""); setItemPrice(""); setItemDesc(""); setLastPrice(null);
    setTimeout(() => prodSearchRef.current?.focus(), 50);
  };

  const removeItem     = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const changeItemQty  = (i, q) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, quantity: q } : it));
  const changeItemPrice= (i, p) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, unit_price: p } : it));
  const changeItemDesc = (i, d) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, description: d } : it));

  // ── Crear ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (esReposicion) {
      if (!provSel)     { addToast("Seleccioná un proveedor", "error"); return; }
      if (!warehouseId) { addToast(`Seleccioná el depósito ${tipo === "Devol a proveedor" ? "de origen" : "de destino"}`, "error"); return; }
    } else if (!esConsumidorFinal) {
      if (!custSel)     { addToast("Seleccioná un cliente", "error"); return; }
    }
    if (items.length === 0) { addToast("Agregá al menos un producto", "error"); return; }

    setSaving(true);
    try {
      const { data: nuevoComp } = await createComprobante({
        customer_id:             esReposicion ? null : (esConsumidorFinal ? null : custSel.id),
        supplier_id:             esReposicion ? provSel.id : null,
        warehouse_id:            user?.warehouse_id || null,
        destino_warehouse_id:    esReposicion ? (warehouseId || null) : null,
        user_id:                 user?.id || null,
        payment_method:          payMethod,
        tipo, vendedor, price_type: priceType, texto_libre: textoLibre,
        es_consumidor_final:     esConsumidorFinal,
        consumidor_final_nombre: esConsumidorFinal ? (consumidorFinalNombre || "Consumidor Final") : null,
        divisa:                  divisa,
        descuento_pct:           admiteDescuento ? descuentoPctNum : 0,
        items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Comprobante creado", "success");
      if (initialCreating) {
        window.opener?.location.reload();
        try {
          const { data: compFull } = await getComprobante(nuevoComp.id);
          if (tipo !== "Nota de Pedido") await printComprobantePDF(compFull);
        } catch { /* si falla el print igual cerramos */ }
        window.close();
        return;
      }
      setCreating(false); resetForm(); loadAll(appliedFrom, appliedTo);
    } catch { addToast("Error creando comprobante", "error"); }
    setSaving(false);
  };

  // ── Editar — abrir formulario con datos existentes ─────────────
  const handleOpenEdit = async (id) => {
    try {
      const { data: c } = await getComprobante(id);
      setEditingId(id);
      setCreating(true);
      setTipo(c.tipo || "Presupuesto");
      setVendedor(c.vendedor || "");
      setTextoLibre(c.texto_libre || "");
      setPriceType(c.price_type || "precio_1");

      const paymentMethod = c.payments?.[0]?.method || "Contado";
      setPayMethod(paymentMethod);
      setDescuentoPct(String(Number(c.descuento_pct ?? 0)));

      setEsConsumidorFinal(!!c.es_consumidor_final);
      setConsumidorFinalNombre(c.consumidor_final_nombre || "");
      skipDivisaConv.current = true;
      changeDivisa(c.divisa || "ARS");

      if (c.customer_id && c.customer_name) {
        setCustSel({ id: c.customer_id, name: c.customer_name });
      }
      if (c.supplier_id && c.supplier_name) {
        setProvSel({ id: c.supplier_id, name: c.supplier_name });
      }
      if (c.warehouse_id) {
        setWarehouseId(c.warehouse_id);
        if (warehouses.length === 0) {
          const { data: wh } = await getWarehouses();
          setWarehouses(wh);
        }
      }

      const rawItems = c.items || [];
      // Para comprobantes en USD: items están almacenados en ARS, derivar cotización y convertir.
      // c.total está en USD ya con descuento aplicado, así que hay que "deshacer" el descuento
      // antes de derivar la cotización: cotizacion = totalARS * (1 - descuento/100) / c.total
      let cotizEdit = null;
      if (c.divisa === "USD" && Number(c.total) > 0) {
        const totalARS = rawItems.reduce((acc, it) => acc + Number(it.unit_price) * Number(it.quantity), 0);
        const descuentoFactor = 1 - (Number(c.descuento_pct ?? 0) / 100);
        if (totalARS > 0) cotizEdit = (totalARS * descuentoFactor) / Number(c.total);
        // Guardar esta cotización para futuras conversiones de divisa
        cotizacionRef.current = cotizEdit;
        setCotizacion(cotizEdit);
      } else if (c.divisa === "ARS") {
        // Para comprobantes ARS, siempre usar la cotización actual (no la de un comprobante anterior)
        const { data } = await getPriceConfig();
        const v = Number(data.cotizacion_dolar) || 1;
        cotizacionRef.current = v;
        setCotizacion(v);
      }

      // Mapear items y convertir si es necesario
      const mappedItems = rawItems.map((it) => ({
        product_id:  it.product_id,
        code:        it.product_code || it.code || "",
        name:        it.product_name || it.name || "",
        description: it.product_name || it.name || "",
        quantity:    Number(it.quantity),
        unit_price:  cotizEdit
          ? Math.round((Number(it.unit_price) / cotizEdit) * 100) / 100
          : Number(it.unit_price),
      }));

      setItems(mappedItems);

      // Establecer la divisa base de los items: después de la conversión, están en c.divisa
      itemsBaseDivisaRef.current = c.divisa || "ARS";
    } catch { addToast("Error cargando comprobante", "error"); }
  };

  useEffect(() => { if (editId) handleOpenEdit(editId); }, [editId]);

  // ── Guardar edición ────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (items.length === 0) { addToast("Agregá al menos un producto", "error"); return; }
    setSaving(true);
    try {
      const { data: updatedComp } = await updateComprobante(editingId, {
        vendedor, texto_libre: textoLibre, price_type: priceType,
        payment_method: payMethod,
        customer_id:             esReposicion ? null : (esConsumidorFinal ? null : (custSel?.id || null)),
        supplier_id:             esReposicion ? (provSel?.id || null) : null,
        es_consumidor_final:     esConsumidorFinal,
        consumidor_final_nombre: esConsumidorFinal ? (consumidorFinalNombre || "Consumidor Final") : null,
        divisa:                  divisa,
        descuento_pct:           admiteDescuento ? descuentoPctNum : 0,
        items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Comprobante actualizado", "success");
      if (editId) {
        window.opener?.location.reload();
        if (tipo !== "Nota de Pedido") await printComprobantePDF(updatedComp);
        window.close();
        return;
      }
      setCreating(false); setEditingId(null); resetForm(); loadAll(appliedFrom, appliedTo);
    } catch (err) { addToast(err?.response?.data?.message || "Error actualizando", "error"); }
    setSaving(false);
  };

  const resetForm = () => {
    setTipo("Presupuesto"); setPayMethod("Contado"); setPriceType("precio_1");
    setVendedor(""); setTextoLibre("");
    setCustSel(null); setCustQuery(""); setCustResults([]);
    setProvSel(null); setProvQuery(""); setProvResults([]);
    setWarehouseId("");
    setItems([]); setProdSel(null); setItemQty(""); setItemPrice(""); setItemDesc("");
    setLastPrice(null); setEditingId(null); setDescuentoPct("0");
    setEsConsumidorFinal(false); setConsumidorFinalNombre(""); changeDivisa("ARS");
    itemsBaseDivisaRef.current = "ARS";
  };

  const handleDelete = (id) => { setDeleteModal(id); setDeletePassword(""); };
  const confirmDelete = async () => {
    if (!deletePassword.trim()) return;
    setDeleting(true);
    try {
      await deleteComprobante(deleteModal, deletePassword);
      addToast("Eliminado y stock revertido", "success");
      setDeleteModal(null); setDeletePassword("");
      loadAll(appliedFrom, appliedTo);
    } catch (err) { addToast(err?.response?.data?.message || "Clave incorrecta", "error"); }
    finally { setDeleting(false); }
  };

  const handlePresupuestar = async () => {
    setSaving(true);
    try {
      await createComprobante({
        customer_id:     custSel?.id || null,
        supplier_id:     null,
        user_id:         null,
        payment_method:  payMethod,
        tipo:            "Presupuesto",
        vendedor,
        price_type:      priceType,
        texto_libre:     textoLibre,
        divisa,
        descuento_pct:   admiteDescuento ? descuentoPctNum : 0,
        source_nota_id:  editingId,
        items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      });
      addToast("Presupuesto creado y NdP eliminada", "success");
      if (editId) {
        window.opener?.location.reload();
        window.close();
        return;
      }
      setCreating(false); setEditingId(null); resetForm(); loadAll(appliedFrom, appliedTo);
    } catch (err) {
      addToast(err?.response?.data?.message || "Error al presupuestar", "error");
    }
    setSaving(false);
  };

  const openDetail = async (id) => {
    if (loadingDetail) return;
    setLoadingDetail(true);
    try { const { data } = await getComprobante(id); setSelected(data); }
    catch { addToast("Error cargando", "error"); }
    finally { setLoadingDetail(false); }
  };

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <>
      <ToastContainer />

      {deleteModal && (
        <div className="modal-overlay" onClick={() => { setDeleteModal(null); setDeletePassword(""); }}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Confirmar eliminación</span>
              <button className="modal-close" onClick={() => { setDeleteModal(null); setDeletePassword(""); }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>
              Se revertirá el stock y la cuenta corriente. Ingresá la clave para continuar.
            </p>
            <div className="input-label">Clave de eliminación</div>
            <input
              className="input"
              type="password"
              placeholder="Clave..."
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmDelete()}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting || !deletePassword.trim()}>
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setDeleteModal(null); setDeletePassword(""); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {!creating ? (
        /* ── LISTADO ── */
        <>
          <div style={{ display:"flex", gap:10, marginBottom:24, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>DESDE</span>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width:150 }} />
              <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>HASTA</span>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width:150 }} />
              {filterDirty && <button className="btn btn-primary btn-sm" onClick={applyFilter}>Filtrar</button>}
            </div>
            <select className="select" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} style={{ width:190 }}>
              <option value="">Todos los tipos</option>
              <option value="Presupuesto">Presupuesto</option>
              <option value="Nota de Pedido">Nota de Pedido</option>
              <option value="Reposicion">Reposición</option>
              <option value="Devolucion">Devolución</option>
              <option value="Devol a proveedor">Devol. a proveedor</option>
            </select>
            <div style={{ flex:1 }} />
            <button className="btn btn-primary" style={{ fontSize:15, padding:"10px 22px" }}
              onClick={() => window.open("/comprobantes/nuevo", "_blank")}>
              + Nuevo comprobante
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Comprobantes</span>
              <span className="badge badge-info">{filteredComprobantes.length}</span>
            </div>
            {loading ? <div className="empty">Cargando...</div> : filteredComprobantes.length === 0 ? (
              <div className="empty">No hay comprobantes</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Tipo</th><th>Cliente / Proveedor</th><th>Vendedor</th><th>Total</th><th>Pago</th><th>Estado</th><th>Fecha</th><th></th></tr>
                  </thead>
                  <tbody>
                    {filteredComprobantes.map((c, rowIdx) => {
                      const isDeleted = !!c.deleted_at;
                      const deletedTooltip = isDeleted
                        ? `Eliminado por ${c.deleted_by_name || "—"} el ${new Date(c.deleted_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`
                        : "";
                      const rowBg = rowIdx % 2 === 1 ? "var(--bg2)" : "var(--bg)";
                      return (
                      <tr key={c.id} style={{ background: isDeleted ? undefined : rowBg, opacity: isDeleted ? 0.55 : undefined }} title={deletedTooltip}>
                        <td>
                          <span className="badge badge-accent" style={isDeleted ? { textDecoration: "line-through" } : undefined}>{c.tipo || "Presupuesto"}</span>
                          {c.web_order_numero && (
                            <span style={{ marginLeft:5, fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)" }}>
                              #{c.web_order_numero}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize:14, textDecoration: isDeleted ? "line-through" : undefined }}>
                          {c.customer_name || c.supplier_name || (c.es_consumidor_final ? (c.consumidor_final_nombre || "Consumidor Final") : "—")}
                          {c.es_consumidor_final && (
                            <span style={{ marginLeft:6, fontSize:10, fontFamily:"var(--font-mono)", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:3, padding:"1px 5px", color:"var(--text-dim)" }}>
                              {c.divisa || "ARS"}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>{c.vendedor || "—"}</td>
                        <td style={{ fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent)", fontSize:14, textDecoration: isDeleted ? "line-through" : undefined }}>
                          {c.divisa === "USD" ? "USD " : "$"}{fmt(c.total)}
                        </td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>{c.payment_method || "—"}</td>
                        <td>
                          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                            {isDeleted
                              ? <span className="badge badge-danger">ELIMINADO</span>
                              : <span className="badge badge-success">{c.status}</span>}
                            {c.created_by_name && (
                              <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>
                                creó: <strong style={{ color:"var(--text-dim)" }}>{c.created_by_name}</strong>
                              </span>
                            )}
                            {c.edited_by_name && !isDeleted && (
                              <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>
                                editó: <strong style={{ color:"var(--text-dim)" }}>{c.edited_by_name}</strong>
                              </span>
                            )}
                            {isDeleted && c.deleted_by_name && (
                              <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--danger)" }}>
                                eliminó: <strong>{c.deleted_by_name}</strong>
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize:13, color:"var(--text-muted)" }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "—"}
                        </td>
                        <td>
                          <div style={{ display:"flex", gap:6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openDetail(c.id)} disabled={loadingDetail}>Ver</button>
                            <button className="btn btn-ghost btn-sm" title="Imprimir" onClick={async () => { const { data } = await getComprobante(c.id); printComprobantePDF(data); }} disabled={loadingDetail}>🖨</button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => window.open(`/comprobantes/editar/${c.id}`, "_blank")}
                              disabled={isDeleted}
                              title={isDeleted ? "No se puede editar un comprobante eliminado" : "Editar"}
                              style={isDeleted ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                            >✏️</button>
                            <button
                              className="btn btn-danger btn-sm btn-icon"
                              onClick={() => handleDelete(c.id)}
                              disabled={isDeleted}
                              title={isDeleted ? "Ya eliminado" : "Eliminar"}
                              style={isDeleted ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                            >🗑️</button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        {/* Modal detalle */}
        {selected && (
          <div className="modal-overlay" onClick={() => setSelected(null)}>
            <div className="modal" style={{ maxWidth:600 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title">{selected.tipo || "Comprobante"} — {selected.id?.slice(0,8)}…</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => printComprobantePDF(selected)}>🖨 Imprimir</button>
                    <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                  </div>
                </div>
                <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
                  {selected.deleted_at
                    ? <span className="badge badge-danger">ELIMINADO</span>
                    : <span className="badge badge-success">{selected.status}</span>}
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:14, color:"var(--accent)", fontWeight:700 }}>
                    Total: {selected.divisa === "USD" ? "USD " : "$"}{fmt(selected.total)}
                  </span>
                  {Number(selected.descuento_pct) !== 0 && (
                    <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color: Number(selected.descuento_pct) > 0 ? "var(--success)" : "var(--danger)", alignSelf:"center" }}>
                      {Number(selected.descuento_pct) > 0 ? "Desc." : "Recargo"} {Math.abs(Number(selected.descuento_pct))}%
                    </span>
                  )}
                  {selected.customer_name && <span style={{ fontSize:13, color:"var(--text-muted)" }}>{selected.customer_name}</span>}
                  {selected.supplier_name && <span style={{ fontSize:13, color:"var(--text-muted)" }}>Prov: {selected.supplier_name}</span>}
                  {selected.warehouse_name && <span style={{ fontSize:13, color:"var(--text-muted)" }}>Dep: {selected.warehouse_name}</span>}
                  {selected.vendedor && <span style={{ fontSize:13, color:"var(--text-muted)" }}>Vend: {selected.vendedor}</span>}
                  {selected.price_type && <span style={{ fontSize:12, color:"var(--text-dim)" }}>{PRECIO_LBL[selected.price_type]}</span>}
                </div>

                {/* Auditoría: creado / editado / eliminado */}
                {(selected.created_by_name || selected.edited_by_name || selected.deleted_at) && (
                  <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:14, padding:"8px 12px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>
                    {selected.created_by_name && (
                      <span><span style={{ color:"var(--text-dim)" }}>Creado por:</span> <strong style={{ color:"var(--text)" }}>{selected.created_by_name}</strong>{selected.created_at && <> · {new Date(selected.created_at).toLocaleString("es-AR", { timeZone:"America/Argentina/Buenos_Aires" })}</>}</span>
                    )}
                    {selected.edited_by_name && (
                      <span><span style={{ color:"var(--text-dim)" }}>Editado por:</span> <strong style={{ color:"var(--text)" }}>{selected.edited_by_name}</strong></span>
                    )}
                    {selected.deleted_at && (
                      <span style={{ color:"var(--danger)" }}>
                        <span style={{ color:"var(--text-dim)" }}>Eliminado por:</span> <strong>{selected.deleted_by_name || "—"}</strong> · {new Date(selected.deleted_at).toLocaleString("es-AR", { timeZone:"America/Argentina/Buenos_Aires" })}
                      </span>
                    )}
                  </div>
                )}
                {selected.texto_libre && (
                  <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 14px", marginBottom:14, fontSize:13, color:"var(--text-muted)" }}>
                    {selected.texto_libre}
                  </div>
                )}
                {/* Tabla de items */}
                {selected.items?.length > 0 ? (() => {
                  const selSubtotal = (selected.items||[]).reduce((a, it) => a + it.quantity * Number(it.unit_price), 0);
                  const selTotal    = Number(selected.total);
                  const selDivisa   = selected.divisa || "ARS";
                  const selCotiz    = (selDivisa === "USD" && selTotal > 0 && selSubtotal > 0) ? selSubtotal / selTotal : 1;
                  const toDisp      = (n) => selDivisa === "USD" ? n / selCotiz : n;
                  return (
                  <div style={{ border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", marginBottom:10 }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                      <thead>
                        <tr style={{ background:"var(--bg3)", borderBottom:"2px solid var(--border)" }}>
                          {["Código","Producto","Cant.","P.Unit.","Total"].map((h, i) => (
                            <th key={h} style={{ padding:"7px 10px", fontFamily:"var(--font-mono)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--text-dim)", textAlign: i > 1 ? "right" : "left" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.items||[]).map((it, i) => (
                          <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                            <td style={{ padding:"7px 10px", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)" }}>{it.product_code || it.code || "—"}</td>
                            <td style={{ padding:"7px 10px", fontSize:13 }}>{it.product_name || it.name || "—"}</td>
                            <td style={{ padding:"7px 10px", fontFamily:"var(--font-mono)", fontSize:13, textAlign:"right" }}>{it.quantity}</td>
                            <td style={{ padding:"7px 10px", fontFamily:"var(--font-mono)", fontSize:13, textAlign:"right", color:"var(--text-muted)" }}>{selDivisa === "USD" ? "USD " : "$"}{fmt(toDisp(Number(it.unit_price)))}</td>
                            <td style={{ padding:"7px 10px", fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, textAlign:"right", color:"var(--accent)" }}>
                              {selDivisa === "USD" ? "USD " : "$"}{fmt(toDisp(it.quantity * Number(it.unit_price)))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        {Number(selected.descuento_pct) !== 0 && (() => {
                          const selSubtotal = (selected.items||[]).reduce((a, it) => a + it.quantity * Number(it.unit_price), 0);
                          const selTotal    = Number(selected.total);
                          const selDivisa   = selected.divisa || "ARS";
                          const selCotiz    = (selDivisa === "USD" && selTotal > 0 && selSubtotal > 0) ? selSubtotal / selTotal : 1;
                          const toDisp      = (n) => selDivisa === "USD" ? n / selCotiz : n;
                          const subtotalDisp = toDisp(selSubtotal);
                          return (
                            <>
                              <tr style={{ borderTop:"1px solid var(--border)" }}>
                                <td colSpan={4} style={{ padding:"6px 10px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-muted)" }}>SUBTOTAL</td>
                                <td style={{ padding:"6px 10px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:13, color:"var(--text-muted)" }}>
                                  {selDivisa === "USD" ? "USD " : "$"}{fmt(subtotalDisp)}
                                </td>
                              </tr>
                              <tr>
                                <td colSpan={4} style={{ padding:"4px 10px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:11, color: Number(selected.descuento_pct) > 0 ? "var(--success)" : "var(--danger)" }}>
                                  {Number(selected.descuento_pct) > 0 ? "DESCUENTO" : "RECARGO"} {Math.abs(Number(selected.descuento_pct))}%
                                </td>
                                <td style={{ padding:"4px 10px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:13, color: Number(selected.descuento_pct) > 0 ? "var(--success)" : "var(--danger)" }}>
                                  {Number(selected.descuento_pct) > 0 ? "−" : "+"}{selDivisa === "USD" ? "USD " : "$"}{fmt(Math.abs(subtotalDisp - selTotal))}
                                </td>
                              </tr>
                            </>
                          );
                        })()}
                        <tr style={{ background:"var(--bg3)", borderTop:"2px solid var(--border)" }}>
                          <td colSpan={4} style={{ padding:"8px 10px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-muted)" }}>TOTAL</td>
                          <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"var(--font-mono)", fontSize:15, fontWeight:800, color:"var(--accent)" }}>
                            {selected.divisa === "USD" ? "USD " : "$"}{fmt(selected.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  );
                })() : <div className="empty">Sin items</div>}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── NUEVO / EDITAR COMPROBANTE ── */
        <div style={{ display:"flex", height:"calc(100vh - 56px)", margin:"-28px", overflow:"hidden" }}>

          <LeftPanel
            tipo={tipo} setTipo={setTipo}
            payMethod={payMethod} setPayMethod={setPayMethod}
            priceType={priceType} setPriceType={setPriceType}
            vendedor={vendedor} setVendedor={setVendedor}
            textoLibre={textoLibre} setTextoLibre={setTextoLibre}
            esReposicion={esReposicion} admiteConsumidorFinal={admiteConsumidorFinal}
            esConsumidorFinal={esConsumidorFinal} toggleConsumidorFinal={toggleConsumidorFinal}
            consumidorFinalNombre={consumidorFinalNombre} setConsumidorFinalNombre={setConsumidorFinalNombre}
            divisa={divisa} setDivisa={changeDivisa}
            custSel={custSel} custQuery={custQuery} setCustQuery={setCustQuery}
            custResults={custResults} selectCust={selectCust} setCustSel={setCustSel}
            provSel={provSel} provQuery={provQuery} setProvQuery={setProvQuery}
            provResults={provResults} selectProv={selectProv} setProvSel={setProvSel}
            warehouses={warehouses} warehouseId={warehouseId} setWarehouseId={setWarehouseId}
            vendedores={vendedores} lastPrice={lastPrice} user={user}
            onSave={isEditing ? handleSaveEdit : handleCreate}
            onCancel={() => { if (initialCreating || editId) { window.close(); return; } setCreating(false); resetForm(); }}
            onReset={resetForm}
            onPresupuestar={isEditing && tipo === "Nota de Pedido" ? handlePresupuestar : undefined}
            saving={saving} isEditing={isEditing}
            total={total} itemCount={items.length}
            onObsEnter={() => prodSearchRef.current?.focus()}
          />

          {/* Panel central */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--bg)" }}>
            <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
              {items.length === 0 ? (
                <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text-dim)", gap:14 }}>
                  <span style={{ fontSize:48 }}>🧾</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:13 }}>Buscá un producto abajo para agregar</span>
                </div>
              ) : (
                <>
                  {/* Header de columnas */}
                  <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 90px 110px 110px 36px", gap:8, padding:"0 0 8px", borderBottom:"2px solid var(--border)", marginBottom:2 }}>
                    {["Código","Descripción","Cant.","Precio","Total",""].map((h) => (
                      <div key={h} style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</div>
                    ))}
                  </div>
                  {items.map((it, i) => (
                    <ItemRow key={i} item={it} idx={i}
                      onRemove={removeItem}
                      onChangeQty={changeItemQty}
                      onChangePrice={changeItemPrice}
                      onChangeDesc={changeItemDesc}
                    />
                  ))}
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:20, paddingTop:14, borderTop:"2px solid var(--border)", gap:24, alignItems:"flex-end" }}>
                    {admiteDescuento && (
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                        <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase" }}>Descuento / Recargo %</div>
                        <input
                          className="input"
                          type="text"
                          inputMode="decimal"
                          value={descuentoPct}
                          onChange={(e) => setDescuentoPct(e.target.value)}
                          style={{ width:90, height:32, fontSize:14, fontFamily:"var(--font-mono)", textAlign:"right" }}
                          title="Positivo = descuento, negativo = recargo"
                        />
                        {descuentoPctNum !== 0 && (
                          <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)" }}>
                            Subtotal: {divisa === "USD" ? "USD " : "$"}{fmt(subtotal)}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ textAlign:"right" }}>
                      {admiteDescuento && descuentoPctNum !== 0 && (
                        <div style={{ fontSize:12, fontFamily:"var(--font-mono)", color: descuentoPctNum > 0 ? "var(--success)" : "var(--danger)", marginBottom:2 }}>
                          {descuentoPctNum > 0 ? "−" : "+"}{fmt(Math.abs(subtotal - total))} ({Math.abs(descuentoPctNum)}%)
                        </div>
                      )}
                      <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Total</div>
                      <div style={{ fontSize:28, fontFamily:"var(--font-mono)", fontWeight:800, color:"var(--accent)" }}>
                        {divisa === "USD" ? "USD " : "$"}{fmt(total)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Barra de búsqueda */}
            <div style={{ borderTop:"2px solid var(--border)", background:"var(--bg2)", padding:"12px 24px 14px", flexShrink:0 }}>
              {prodSel && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ padding:"8px 12px", background:"var(--accent-dim)", border:"1px solid var(--accent)", borderRadius:6, display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:700 }}>{prodSel.code}</span>
                    <span style={{ fontSize:13, color:"var(--text)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{prodSel.name}</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent)", fontWeight:700, flexShrink:0 }}>
                      {divisa === "USD" ? "USD " : "$"}{fmt(Number(itemPrice || 0))}
                    </span>
                    <span style={{ fontSize:11, color:"var(--text-dim)", flexShrink:0 }}>← ingresá cantidad</span>
                  </div>
                  {lastPrice && custSel && (
                    <div style={{ marginTop:5, padding:"5px 10px", background:"rgba(255,200,0,0.08)", border:"1px solid rgba(255,200,0,0.25)", borderRadius:5, fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ color:"rgba(255,200,0,0.8)" }}>⏱</span>
                      <span>Última venta a <strong style={{ color:"var(--text)" }}>{custSel.name}</strong>:</span>
                      <span style={{ color:"var(--accent)", fontWeight:700 }}>
                        {(() => {
                          const lastUSD = (lastPrice.divisa === "USD" && lastPrice.cotizacion_dolar)
                            ? Number(lastPrice.unit_price) / Number(lastPrice.cotizacion_dolar)
                            : Number(lastPrice.unit_price) / cotizacion;
                          return divisa === "USD"
                            ? `USD ${fmt(lastUSD)}`
                            : `$${fmt(lastUSD * cotizacion)}`;
                        })()}
                      </span>
                      <span style={{ color:"var(--text-dim)" }}>el {new Date(lastPrice.created_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", whiteSpace:"nowrap" }}>Desc:</div>
                <input className="input" style={{ flex:1, fontSize:13, height:34 }} placeholder="Enter si no modifica"
                  value={itemDesc} onChange={(e) => setItemDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmItem(); }} />
              </div>

              <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                <div style={{ flex:2, minWidth:0 }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Código o descripción</div>
                  <ProductSearchBar ref={prodSearchRef} priceType={esReposicion ? "costo" : priceType} divisa={divisa} onSelect={handleProdSelect} onSearchFocus={() => setSearchActive(true)} autoFocus={!prodSel} dropUp />
                </div>
                <div style={{ flex:"0 0 100px" }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>Cantidad</div>
                  <input ref={qtyRef} className="input"
                    style={{ height:38, fontSize:15, fontFamily:"var(--font-mono)", textAlign:"center", width:"100%" }}
                    placeholder="0" value={itemQty} onChange={(e) => setItemQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (Number(itemQty) > 0) priceRef.current?.focus(); } }} />
                </div>
                <div style={{ flex:"0 0 120px" }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:4 }}>
                    {PRECIO_LBL[priceType]}
                  </div>
                  <input ref={priceRef} className="input"
                    style={{ height:38, fontSize:15, fontFamily:"var(--font-mono)", color:"var(--accent)", fontWeight:700, width:"100%" }}
                    placeholder="0.00" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmItem(); } }} />
                </div>
                <button className="btn btn-primary" onClick={confirmItem}
                  style={{ height:38, fontSize:13, padding:"0 18px", flexShrink:0 }}>
                  + Agregar
                </button>
              </div>

              {/* Stock por depósito del producto seleccionado */}
              {prodSel && !searchActive && (() => {
                const stockRows = (prodSel.stock || []).filter((s) => s.warehouse_name);
                if (!stockRows.length) return null;
                return (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8, padding:"7px 10px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:7 }}>
                    <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.06em", alignSelf:"center", marginRight:4 }}>
                      Stock:
                    </span>
                    {stockRows.map((s) => {
                      const qty = Number(s.quantity) || 0;
                      const pos = qty > 0;
                      return (
                        <span key={s.warehouse_id} style={{
                          display:"inline-flex", alignItems:"center", gap:5,
                          padding:"2px 10px", borderRadius:5, fontSize:12,
                          border:`1px solid ${pos ? "var(--accent)" : "var(--border)"}`,
                          background: pos ? "var(--accent-dim)" : "var(--bg2)",
                          fontFamily:"var(--font-mono)",
                        }}>
                          <span style={{ fontSize:11, color:"var(--text-muted)" }}>{s.warehouse_name}</span>
                          <span style={{ fontWeight:700, color: pos ? "var(--accent)" : "var(--text-dim)" }}>{qty}</span>
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
