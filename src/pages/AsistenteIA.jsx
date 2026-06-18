import { useState, useRef, useEffect } from "react";
import { aiAgentChat } from "../utils/api";

const STORAGE_KEY = "asistente_ia_messages";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function renderContent(content) {
  const parts = content.split(/(!\[.*?\]\(https?:\/\/[^\)]+\))/g);
  return parts.map((part, i) => {
    const imgMatch = part.match(/!\[(.*?)\]\((https?:\/\/[^\)]+)\)/);
    if (imgMatch) {
      return (
        <img
          key={i}
          src={imgMatch[2]}
          alt={imgMatch[1]}
          style={{
            maxWidth: "100%", maxHeight: 220, borderRadius: 8,
            display: "block", marginTop: 6, objectFit: "contain",
            background: "#fff",
          }}
        />
      );
    }
    return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{part}</span>;
  });
}

export default function AsistenteIA() {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const next    = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const { data } = await aiAgentChat(next);
      setMessages((prev) => [...prev, { role: data.role, content: data.content }]);
    } catch (err) {
      const msg = err.response?.data?.message || "Error conectando con el asistente";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}`, isError: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleNewConversation() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    inputRef.current?.focus();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", maxWidth: 800, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, color: "#666", fontSize: 13 }}>
            Consulta clientes, comprobantes, productos y más en lenguaje natural.
          </p>
        </div>
        <button
          onClick={handleNewConversation}
          style={{
            padding: "6px 14px", fontSize: 13, cursor: "pointer",
            background: "none", border: "1px solid #ddd", borderRadius: 6,
            color: "#555",
          }}
        >
          Nueva conversación
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 4px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#999", marginTop: 60, fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
            <div>Podés preguntarme cosas como:</div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "¿Cuál es el saldo de Juan García?",
                "Mostrá los últimos comprobantes de esta semana",
                "Buscá el producto 'cable hdmi'",
                "¿Cuánto stock tiene el producto código EXC-001?",
              ].map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                  style={{
                    background: "#f5f5f5", border: "1px solid #e0e0e0",
                    borderRadius: 8, padding: "8px 14px", cursor: "pointer",
                    fontSize: 13, color: "#444", textAlign: "left",
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{
              maxWidth: "80%",
              padding: "10px 14px",
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.role === "user"
                ? "#1a1a1a"
                : msg.isError ? "#fff3f3" : "#f0f0f0",
              color: msg.role === "user" ? "#fff" : msg.isError ? "#c00" : "#222",
              fontSize: 14,
              lineHeight: 1.5,
              wordBreak: "break-word",
            }}>
              {msg.role === "user" ? msg.content : renderContent(msg.content)}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "10px 16px", borderRadius: "16px 16px 16px 4px",
              background: "#f0f0f0", color: "#888", fontSize: 14,
            }}>
              Consultando...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: "flex", gap: 8, paddingTop: 12,
        borderTop: "1px solid #e8e8e8",
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Preguntá algo... (Enter para enviar)"
          rows={2}
          style={{
            flex: 1, resize: "none", padding: "10px 12px",
            border: "1px solid #ddd", borderRadius: 8,
            fontSize: 14, fontFamily: "inherit",
            outline: "none", lineHeight: 1.5,
          }}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: "0 20px", borderRadius: 8, border: "none",
            background: loading || !input.trim() ? "#ccc" : "#1a1a1a",
            color: "#fff", fontSize: 14, cursor: loading || !input.trim() ? "default" : "pointer",
            alignSelf: "stretch",
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
