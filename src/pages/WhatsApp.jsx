import { useState, useEffect, useRef, useCallback } from "react";
import {
  getWhatsAppStatus, connectWhatsApp, disconnectWhatsApp,
  getWhatsAppFeatures, updateWhatsAppFeatures, getWhatsAppQR,
  searchCustomers, searchProducts, sendWhatsAppMessage,
} from "../utils/api";
import { useToast } from "../utils/useToast";

export default function WhatsApp() {
  useEffect(() => { document.title = "WhatsApp — Once"; }, []);
  const { addToast, ToastContainer } = useToast();

  const [status,     setStatus]     = useState(null);
  const [features,   setFeatures]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [qrBlobUrl,  setQrBlobUrl]  = useState(null);
  const [modalCustomer, setModalCustomer] = useState(null);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await getWhatsAppStatus();
      setStatus(data.status);
      return data.status;
    } catch {
      setStatus("openwa_offline");
      return "openwa_offline";
    }
  }, []);

  const fetchFeatures = useCallback(async () => {
    try {
      const { data } = await getWhatsAppFeatures();
      setFeatures(data);
    } catch {}
  }, []);

  const refreshQR = useCallback(async () => {
    try {
      const { data } = await getWhatsAppQR();
      if (data?.qrCode) setQrBlobUrl(data.qrCode);
    } catch {}
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    refreshQR();
    pollRef.current = setInterval(async () => {
      const s = await fetchStatus();
      if (s === "qr_pending") refreshQR();
      if (s === "connected") {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setQrBlobUrl(null);
        fetchFeatures();
      }
    }, 4000);
  }, [fetchStatus, fetchFeatures, refreshQR]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = await fetchStatus();
      if (s === "connected") await fetchFeatures();
      if (s === "qr_pending") startPolling();
      setLoading(false);
    })();
    return () => stopPolling();
  }, [fetchStatus, fetchFeatures, startPolling, stopPolling]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectWhatsApp();
      setStatus("qr_pending");
      startPolling();
    } catch (err) {
      addToast(err?.response?.data?.message || "Error al iniciar sesión", "error");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWhatsApp();
      stopPolling();
      setStatus("disconnected");
      setFeatures(null);
      setModalCustomer(null);
      addToast("Sesión desconectada", "success");
    } catch {
      addToast("Error al desconectar", "error");
    }
  };

  const toggleFeature = async (key) => {
    const next = { ...features, [key]: !features[key] };
    setFeatures(next);
    try {
      await updateWhatsAppFeatures(next);
    } catch {
      addToast("Error al guardar", "error");
      setFeatures(features);
    }
  };

  if (loading) return <div style={{ padding: 40, color: "var(--text-dim)" }}>Cargando...</div>;

  const isConnected  = status === "connected";
  const isQrPending  = status === "qr_pending";
  const isOffline    = status === "openwa_offline";
  const notConnected = !isConnected && !isQrPending;

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <ToastContainer />

      {/* ── Panel izquierdo: conexión ── */}
      <div style={{ width: 440, flexShrink: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: 28 }}>💬</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text)" }}>WhatsApp</h2>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              Integración con OpenWA — mensajería automática
            </div>
          </div>
        </div>

        {/* Estado */}
        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
              background: isConnected ? "var(--success)" : isQrPending ? "#f59e0b" : "var(--danger)",
            }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                {isConnected  ? "Conectado"
                : isQrPending ? "Esperando escaneo de QR..."
                : isOffline   ? "OpenWA offline"
                : "Desconectado"}
              </div>
              {isOffline && (
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                  El servicio OpenWA no está corriendo — verificá la URL y la API key
                </div>
              )}
            </div>
          </div>
          {isConnected && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleDisconnect}>
              Desconectar
            </button>
          )}
        </div>

        {/* Botón conectar */}
        {notConnected && !isOffline && (
          <button className="btn btn-primary" style={{ marginBottom: 20 }} onClick={handleConnect} disabled={connecting}>
            {connecting ? "Iniciando..." : "Conectar WhatsApp"}
          </button>
        )}

        {/* QR */}
        {isQrPending && (
          <div style={{
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: 24, marginBottom: 20,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          }}>
            <div style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "center" }}>
              Escaneá este código QR con WhatsApp en tu teléfono<br />
              <span style={{ fontSize: 11 }}>Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo</span>
            </div>
            {qrBlobUrl
              ? <img src={qrBlobUrl} alt="QR WhatsApp" style={{ width: 220, height: 220, borderRadius: 8, background: "#fff", padding: 8 }} />
              : <div style={{ width: 220, height: 220, borderRadius: 8, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--text-dim)" }}>Cargando QR...</div>
            }
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>El QR se actualiza automáticamente cada 4 segundos</div>
          </div>
        )}

        {/* Funcionalidades */}
        {isConnected && features && (
          <div style={{
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "16px 20px",
          }}>
            <div style={{
              fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)",
              textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14,
            }}>
              Funcionalidades
            </div>
            <FeatureToggle
              label="Enviar WhatsApp al mandar campaña de email"
              description="Cuando enviás una campaña masiva de email, también se manda un mensaje de WhatsApp a los clientes que tengan teléfono registrado."
              enabled={!!features.campaign_send}
              onToggle={() => toggleFeature("campaign_send")}
            />
          </div>
        )}
      </div>

      {/* ── Panel derecho: recomendaciones ── */}
      {isConnected && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <CustomerPanel onRecommend={setModalCustomer} addToast={addToast} />
        </div>
      )}

      {/* Modal de recomendación */}
      {modalCustomer && (
        <RecommendModal
          customer={modalCustomer}
          onClose={() => setModalCustomer(null)}
          addToast={addToast}
        />
      )}
    </div>
  );
}

/* ── CustomerPanel ───────────────────────────────────────────────── */
function CustomerPanel({ onRecommend, addToast }) {
  const [query,     setQuery]     = useState("");
  const [customers, setCustomers] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) { setCustomers([]); return; }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await searchCustomers(query);
        setCustomers(data || []);
      } catch {
        addToast("Error buscando clientes", "error");
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query, addToast]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
          Recomendaciones
        </h2>
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          Buscá un cliente y enviále una recomendación de producto por WhatsApp
        </div>
      </div>

      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", overflow: "hidden",
      }}>
        {/* Buscador */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <input
            className="input"
            type="text"
            placeholder="Buscar cliente..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box" }}
            autoComplete="off"
          />
        </div>

        {/* Lista */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {searching && (
            <div style={{ padding: "16px", fontSize: 13, color: "var(--text-dim)", textAlign: "center" }}>
              Buscando...
            </div>
          )}
          {!searching && query && customers.length === 0 && (
            <div style={{ padding: "16px", fontSize: 13, color: "var(--text-dim)", textAlign: "center" }}>
              Sin resultados
            </div>
          )}
          {!query && (
            <div style={{ padding: "16px", fontSize: 13, color: "var(--text-dim)", textAlign: "center" }}>
              Escribí el nombre de un cliente para buscar
            </div>
          )}
          {customers.map(c => (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", borderBottom: "1px solid var(--border)",
              gap: 12,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                  {c.phone || "Sin teléfono registrado"}
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: "5px 12px", flexShrink: 0 }}
                disabled={!c.phone}
                onClick={() => onRecommend(c)}
              >
                Recomendar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── RecommendModal ──────────────────────────────────────────────── */
function RecommendModal({ customer, onClose, addToast }) {
  const [mode,            setMode]            = useState("manual");
  const [productQuery,    setProductQuery]     = useState("");
  const [productResults,  setProductResults]   = useState([]);
  const [selectedProduct, setSelectedProduct]  = useState(null);
  const [message,         setMessage]          = useState("");
  const [sending,         setSending]          = useState(false);
  const productTimer = useRef(null);

  useEffect(() => {
    clearTimeout(productTimer.current);
    if (!productQuery.trim()) { setProductResults([]); return; }
    productTimer.current = setTimeout(async () => {
      try {
        const { data } = await searchProducts(productQuery);
        setProductResults(data || []);
      } catch {}
    }, 300);
  }, [productQuery]);

  const handleSend = async () => {
    if (!selectedProduct || !message.trim()) return;
    setSending(true);
    try {
      const imageUrl = selectedProduct.images?.[0]?.url || "";
      const fullMessage = `${message.trim()}\n\n*${selectedProduct.name}*${imageUrl ? `\n${imageUrl}` : ""}`;
      await sendWhatsAppMessage({ phone: customer.phone, message: fullMessage });
      addToast(`Mensaje enviado a ${customer.name}`, "success");
      onClose();
    } catch (err) {
      addToast(err?.response?.data?.message || "Error al enviar", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "var(--bg)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", width: "100%", maxWidth: 560,
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
              Recomendar a {customer.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              {customer.phone}
            </div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 18, padding: "2px 8px" }} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Selector de modo */}
        <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <button
            style={{
              flex: 1, padding: "8px 0", borderRadius: "var(--radius)",
              border: "1px solid var(--border)", cursor: "not-allowed",
              background: "var(--bg3)", color: "var(--text-dim)", fontSize: 13,
              opacity: 0.5,
            }}
            disabled
          >
            🤖 Con IA (próximamente)
          </button>
          <button
            onClick={() => setMode("manual")}
            style={{
              flex: 1, padding: "8px 0", borderRadius: "var(--radius)",
              border: `1px solid ${mode === "manual" ? "var(--accent)" : "var(--border)"}`,
              cursor: "pointer",
              background: mode === "manual" ? "var(--accent)" : "var(--bg3)",
              color: mode === "manual" ? "#fff" : "var(--text)",
              fontWeight: mode === "manual" ? 600 : 400,
              fontSize: 13,
            }}
          >
            🔍 Producto manual
          </button>
        </div>

        {/* Contenido scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Buscador de productos */}
          <div>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 6 }}>
              Buscar producto
            </label>
            <input
              className="input"
              type="text"
              placeholder="Nombre del producto..."
              value={productQuery}
              onChange={e => { setProductQuery(e.target.value); setSelectedProduct(null); }}
              style={{ width: "100%", boxSizing: "border-box" }}
              autoComplete="off"
            />
          </div>

          {/* Resultados de productos */}
          {productResults.length > 0 && !selectedProduct && (
            <div style={{
              border: "1px solid var(--border)", borderRadius: "var(--radius)",
              overflow: "hidden", maxHeight: 200, overflowY: "auto",
            }}>
              {productResults.map(p => (
                <div
                  key={p.id}
                  onClick={() => { setSelectedProduct(p); setProductQuery(""); setProductResults([]); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg2)"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}
                >
                  {p.images?.[0]?.url
                    ? <img src={p.images[0].url} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                    : <div style={{ width: 36, height: 36, background: "var(--bg3)", borderRadius: 4, flexShrink: 0 }} />
                  }
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.name}
                    </div>
                    {p.code && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{p.code}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Producto seleccionado */}
          {selectedProduct && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", background: "var(--bg2)",
              border: "1px solid var(--accent)", borderRadius: "var(--radius)",
            }}>
              {selectedProduct.images?.[0]?.url
                ? <img src={selectedProduct.images[0].url} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                : <div style={{ width: 44, height: 44, background: "var(--bg3)", borderRadius: 4, flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{selectedProduct.name}</div>
                {selectedProduct.code && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{selectedProduct.code}</div>}
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, flexShrink: 0 }}
                onClick={() => setSelectedProduct(null)}
              >
                Cambiar
              </button>
            </div>
          )}

          {/* Mensaje */}
          <div>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 6 }}>
              Mensaje
            </label>
            <textarea
              className="input"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Ej: Hola! Pensé en vos para este producto..."
              rows={3}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={!selectedProduct || !message.trim() || sending}
          >
            {sending ? "Enviando..." : "Enviar por WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── FeatureToggle ───────────────────────────────────────────────── */
function FeatureToggle({ label, description, enabled, onToggle }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14,
      padding: "12px 0", borderBottom: "1px solid var(--border)",
    }}>
      <button
        onClick={onToggle}
        style={{
          width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
          background: enabled ? "var(--success)" : "var(--bg3)",
          position: "relative", flexShrink: 0, transition: "background .15s", marginTop: 2,
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 3, left: enabled ? 21 : 3,
          transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
        }} />
      </button>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3, lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
    </div>
  );
}
