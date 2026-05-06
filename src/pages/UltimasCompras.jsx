import { useState, useEffect } from "react";
import { getUltimasCompras } from "../utils/api";
import { useToast } from "../utils/useToast";

const today = () => new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });
const fmt   = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"2-digit", timeZone:"America/Argentina/Buenos_Aires" }) : "—";

export default function UltimasCompras() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [from,    setFrom]    = useState("");
  const [to,      setTo]      = useState("");
  const [search,  setSearch]  = useState("");
  const { addToast, ToastContainer } = useToast();

  const load = async (f, t) => {
    setLoading(true);
    try {
      const { data } = await getUltimasCompras(f || null, t || null);
      setRows(data);
    } catch {
      addToast("Error cargando compras", "error");
    }
    setLoading(false);
  };

  useEffect(() => { load(null, null); }, []);

  const filtered = search.trim()
    ? rows.filter((r) =>
        (r.descripcion || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.codigo      || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.proveedor   || "").toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <ToastContainer />

      {/* Filtros */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
        <div>
          <div className="input-label">Desde</div>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width:140 }} />
        </div>
        <div>
          <div className="input-label">Hasta</div>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width:140 }} />
        </div>
        <button className="btn btn-primary" onClick={() => load(from, to)}>Filtrar</button>
        <button className="btn btn-ghost" onClick={() => { setFrom(""); setTo(""); load(null, null); }}>
          Todo
        </button>
        <input
          className="input"
          placeholder="Buscar por código, descripción o proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width:280, marginLeft:"auto" }}
        />
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"var(--text-dim)" }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:40, color:"var(--text-dim)" }}>Sin resultados</div>
      ) : (
        <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"var(--bg3)", borderBottom:"1px solid var(--border)" }}>
                {["Fecha","Código","Descripción","Cantidad","Precio","Proveedor"].map((h) => (
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--text-dim)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding:"9px 14px", fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-dim)" }}>{fmtDate(r.fecha)}</td>
                  <td style={{ padding:"9px 14px", fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent)", fontWeight:600 }}>{r.codigo || "—"}</td>
                  <td style={{ padding:"9px 14px", fontSize:13, fontWeight:500 }}>{r.descripcion}</td>
                  <td style={{ padding:"9px 14px", fontFamily:"var(--font-mono)", fontSize:13, textAlign:"right" }}>{Number(r.cantidad).toLocaleString("es-AR")}</td>
                  <td style={{ padding:"9px 14px", fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"var(--danger)", textAlign:"right" }}>${fmt(r.precio)}</td>
                  <td style={{ padding:"9px 14px", fontSize:12, color:"var(--text-muted)" }}>{r.proveedor || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:"8px 14px", borderTop:"1px solid var(--border)", fontSize:11, color:"var(--text-dim)", fontFamily:"var(--font-mono)" }}>
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
