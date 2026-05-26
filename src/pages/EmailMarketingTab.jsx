import { useState, useEffect, useRef } from "react";
import { getEmailRecipients, emailCampaignAI, sendEmailCampaign } from "../utils/api";
import { useToast } from "../utils/useToast";

export default function EmailMarketingTab() {
  const { addToast, ToastContainer } = useToast();

  const [subject,     setSubject]     = useState("");
  const [messages,    setMessages]    = useState([]); // formato OpenAI: [{ role, content }]
  const [chatDisplay, setChatDisplay] = useState([]); // [{ role, text, hasHtml }]
  const [currentHtml, setCurrentHtml] = useState("");
  const [input,       setInput]       = useState("");
  const [loadingAI,   setLoadingAI]   = useState(false);
  const [sending,     setSending]     = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testEmail,   setTestEmail]   = useState("");
  const [recipients,  setRecipients]  = useState(null);
  const [sendResult,  setSendResult]  = useState(null);

  const chatRef = useRef(null);

  useEffect(() => {
    getEmailRecipients().then(({ data }) => setRecipients(data.total)).catch(() => {});
  }, []);

  // Auto-scroll al final del chat cuando llegan mensajes nuevos
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatDisplay, loadingAI]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loadingAI) return;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setChatDisplay((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoadingAI(true);

    try {
      const { data } = await emailCampaignAI(newMessages);
      const { reply, html } = data;

      // Guardamos el mensaje completo del asistente (con bloque HTML) para mantener contexto
      const assistantContent = html
        ? `${reply}\n\`\`\`html\n${html}\n\`\`\``
        : reply;
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
      setChatDisplay((prev) => [...prev, { role: "assistant", text: reply || "✓ Email generado", hasHtml: !!html }]);

      if (html) setCurrentHtml(html);
    } catch {
      addToast("Error al comunicarse con la IA", "error");
      setChatDisplay((prev) => [
        ...prev,
        { role: "assistant", text: "❌ Error al generar el email. Intentá de nuevo.", hasHtml: false },
      ]);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleTestSend = async () => {
    if (!subject.trim()) { addToast("Escribí un asunto antes de enviar", "error"); return; }
    if (!currentHtml)    { addToast("Generá el email primero con la IA", "error"); return; }
    if (!testEmail.trim()) { addToast("Ingresá un email de prueba", "error"); return; }
    setTestSending(true);
    try {
      await sendEmailCampaign(subject, currentHtml, testEmail.trim());
      addToast(`✅ Email de prueba enviado a ${testEmail.trim()}`, "success");
    } catch (err) {
      const msg = err?.response?.data?.message || "Error al enviar email de prueba";
      addToast(msg, "error");
    } finally {
      setTestSending(false);
    }
  };

  const handleSendAll = async () => {
    if (!subject.trim()) { addToast("Escribí un asunto antes de enviar", "error"); return; }
    if (!currentHtml)    { addToast("Generá el email primero con la IA", "error"); return; }
    if (!window.confirm(`¿Enviar este email a ${recipients ?? "todos los"} destinatarios de Oncepuntos?`)) return;
    setSending(true);
    setSendResult(null);
    try {
      const { data } = await sendEmailCampaign(subject, currentHtml);
      setSendResult(data);
      addToast(
        `✅ Enviado a ${data.sent} destinatario${data.sent !== 1 ? "s" : ""}${data.errors ? ` (${data.errors} error${data.errors !== 1 ? "es" : ""})` : ""}`,
        "success"
      );
    } catch {
      addToast("Error al enviar la campaña", "error");
    } finally {
      setSending(false);
    }
  };

  const copyHtml = () => {
    navigator.clipboard.writeText(currentHtml)
      .then(() => addToast("HTML copiado al portapapeles", "success"))
      .catch(() => addToast("No se pudo copiar", "error"));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <ToastContainer />

      {/* Asunto */}
      <div style={{ padding: "12px 0 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.06em", color: "var(--text-dim)", whiteSpace: "nowrap",
          }}>
            Asunto
          </span>
          <input
            className="input"
            style={{ flex: 1 }}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ej: 🎉 ¡Nuevos productos disponibles en Oncepuntos!"
          />
          {recipients !== null && (
            <span style={{ fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>
              👥 {recipients.toLocaleString("es-AR")} destinatarios
            </span>
          )}
        </div>
      </div>

      {/* Panel principal: chat + preview */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ── Panel izquierdo: Chat ── */}
        <div style={{
          width: "42%", display: "flex", flexDirection: "column",
          borderRight: "1px solid var(--border)", overflow: "hidden",
        }}>

          {/* Historial de mensajes */}
          <div ref={chatRef} style={{
            flex: 1, overflowY: "auto", padding: "14px 12px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {chatDisplay.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-dim)" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>
                  Asistente de Email Marketing
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  Describí qué querés comunicar y generaré el email completo listo para previsualizar y enviar.
                  <br />
                  Podés pedirle cambios cuantas veces quieras.
                </div>
              </div>
            )}

            {chatDisplay.map((msg, i) => (
              <div key={i} style={{
                display: "flex", flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "87%", padding: "8px 12px", fontSize: 13, lineHeight: 1.55,
                  borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: msg.role === "user" ? "var(--accent)" : "var(--bg3)",
                  color: msg.role === "user" ? "#fff" : "var(--text)",
                }}>
                  {msg.text}
                </div>
                {msg.hasHtml && (
                  <span style={{ fontSize: 11, color: "var(--success)", marginTop: 3, paddingLeft: 4 }}>
                    ✓ Email generado — ver previsualización →
                  </span>
                )}
              </div>
            ))}

            {loadingAI && (
              <div style={{ display: "flex" }}>
                <div style={{
                  padding: "8px 14px", borderRadius: "12px 12px 12px 2px",
                  background: "var(--bg3)", color: "var(--text-dim)", fontSize: 13,
                }}>
                  Generando email...
                </div>
              </div>
            )}
          </div>

          {/* Input de chat */}
          <div style={{
            borderTop: "1px solid var(--border)", padding: "10px 12px",
            display: "flex", gap: 8, flexShrink: 0,
          }}>
            <textarea
              className="input"
              style={{ flex: 1, resize: "none", fontSize: 13, minHeight: 58, maxHeight: 120 }}
              placeholder="Ej: Hacé un email de oferta con 20% off en todos los juguetes..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loadingAI}
            />
            <button
              className="btn btn-primary"
              style={{ alignSelf: "flex-end", padding: "8px 16px", fontSize: 16 }}
              onClick={sendMessage}
              disabled={loadingAI || !input.trim()}
            >
              →
            </button>
          </div>
        </div>

        {/* ── Panel derecho: Preview ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header del preview */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 14px", borderBottom: "1px solid var(--border)",
            background: "var(--bg2)", flexShrink: 0,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.06em", color: "var(--text-dim)",
            }}>
              Previsualización
            </span>
            {currentHtml && (
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} onClick={copyHtml}>
                📋 Copiar HTML
              </button>
            )}
          </div>

          {/* iframe */}
          <div style={{ flex: 1, overflow: "hidden", background: "#e8eaed" }}>
            {currentHtml ? (
              <iframe
                srcDoc={currentHtml}
                sandbox="allow-same-origin"
                style={{ width: "100%", height: "100%", border: "none" }}
                title="Previsualización del email"
              />
            ) : (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: "100%", color: "var(--text-dim)", gap: 10,
              }}>
                <div style={{ fontSize: 52 }}>✉️</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                  La previsualización aparecerá aquí
                </div>
                <div style={{ fontSize: 12 }}>
                  Usá el chat para pedirle a la IA que genere el email
                </div>
              </div>
            )}
          </div>

          {/* Controles de envío */}
          <div style={{
            borderTop: "1px solid var(--border)", padding: "10px 14px",
            background: "var(--bg2)", flexShrink: 0,
          }}>
            {/* Email de prueba */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input
                className="input"
                style={{ flex: 1, fontSize: 12 }}
                placeholder="Email para prueba..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, whiteSpace: "nowrap" }}
                onClick={handleTestSend}
                disabled={testSending || !currentHtml || !testEmail.trim()}
              >
                {testSending ? "Enviando..." : "🧪 Enviar prueba"}
              </button>
            </div>

            {/* Envío masivo + resultado */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {sendResult && (
                <span style={{ fontSize: 12, color: "var(--success)", fontFamily: "var(--font-mono)" }}>
                  ✅ {sendResult.sent}/{sendResult.total} enviados
                  {sendResult.errors > 0 ? ` · ${sendResult.errors} errores` : ""}
                </span>
              )}
              <div style={{ marginLeft: "auto" }}>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12 }}
                  onClick={handleSendAll}
                  disabled={sending || !currentHtml}
                >
                  {sending
                    ? "Enviando..."
                    : `📨 Enviar a ${recipients !== null ? recipients.toLocaleString("es-AR") : "todos los"} clientes`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
