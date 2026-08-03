import { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, useLocation, useNavigate, Outlet } from "react-router-dom";

import { useAuth } from "../utils/useAuth";
import { getRecordatoriosPendientes } from "../utils/api";

const NAV_ADMIN = [
  {
    section: "Operaciones",
    items: [
      { to: "/comprobantes", label: "Comprobantes", icon: "🧾" },
      { to: "/remitos",      label: "Remitos Internos",      icon: "📦" },
      {
        label: "Caja", icon: "💰",
        submenu: [
          { to: "/caja",         label: "Imputaciones" },
          { to: "/caja/listado", label: "Listado"      },
        ],
      },
      { to: "/pedidos-web", label: "Pedidos Web", icon: "🌐" },
    ],
  },
  {
    section: "Maestros",
    items: [
      { to: "/clientes",         label: "Clientes",         icon: "👤" },
      { to: "/cuenta-corriente", label: "Cuenta Corriente", icon: "💳" },
      {
        label: "Productos", icon: "🏷️", rootPath: "/productos",
        submenu: [
          { to: "/productos",                label: "Catálogo"            },
          { to: "/productos/ultimas-compras", label: "Últimas Compras"   },
          { to: "/stock-movimientos",        label: "Movimientos de Stock" },
          { to: "/catalogos",                label: "Imprimir catálogo"  },
        ],
      },
      { to: "/vendedores",       label: "Vendedores",       icon: "🧑‍💼" },
      { to: "/transportes",      label: "Transportes",      icon: "🚚"   },
    ],
  },
  {
    section: "Sistema",
    items: [
      { to: "/usuarios",      label: "Usuarios",      icon: "👥" },
      { to: "/configuracion", label: "Configuración", icon: "⚙️" },
    ],
  },
];

const NAV_SUPERADMIN_EXTRA = [
  { to: "/rentabilidad",   label: "Rentabilidad",   icon: "📈" },
  { to: "/recordatorios",  label: "Recordatorios",  icon: "🔔" },
  { to: "/whatsapp",       label: "WhatsApp",        icon: "💬" },
];

const NAV_VENDEDOR = [
  {
    section: "Maestros",
    items: [
      {
        label: "Productos", icon: "🏷️", rootPath: "/productos",
        submenu: [
          { to: "/productos", label: "Catálogo"          },
          { to: "/catalogos", label: "Imprimir catálogo" },
        ],
      },
    ],
  },
];

const VENDEDOR_ALLOWED_PATHS = ["/productos", "/catalogos"];
export const VENDEDOR_HOME = "/productos";

export function isPathAllowedForVendedor(pathname) {
  return VENDEDOR_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

const PAGE_TITLES = {
  "/dashboard":        "Inicio",
  "/comprobantes":     "Comprobantes",
  "/remitos":          "Remitos Internos",
  "/caja":             "Caja · Imputaciones",
  "/caja/listado":     "Caja · Listado",
  "/pedidos-web":      "Pedidos Web",
  "/clientes":         "Clientes",
  "/cuenta-corriente": "Cuenta Corriente",
  "/productos":                    "Productos",
  "/productos/ultimas-compras":    "Últimas Compras",
  "/stock-movimientos":           "Movimientos de Stock",
  "/vendedores":       "Vendedores",
  "/usuarios":         "Usuarios del Sistema",
  "/configuracion":    "Configuración",
  "/transportes":      "Transportes",
  "/catalogos":        "Catálogos Personalizados",
  "/rentabilidad":    "Rentabilidad",
  "/asistente-ia":   "Asistente IA",
  "/recordatorios":  "Recordatorios",
  "/whatsapp":       "WhatsApp",
};

function CajaNavItem({ item, location }) {
  const navigate = useNavigate();
  const rootPath = item.rootPath || "/caja";
  const isCajaActive = location.pathname.startsWith(rootPath);
  const [open, setOpen] = useState(isCajaActive);

  const handleClick = () => {
    navigate(rootPath);
    setOpen(true);
  };

  return (
    <div>
      <div
        className={"sidebar-link" + (isCajaActive ? " active" : "")}
        style={{ cursor: "pointer", userSelect: "none" }}
        title={item.label}
        onClick={handleClick}
      >
        <span className="icon">{item.icon}</span>
        <span className="link-label">{item.label}</span>
        <span style={{
          marginLeft: "auto", fontSize: 10, opacity: 0.5,
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 0.15s", paddingRight: 4,
        }}>▶</span>
      </div>
      {open && (
        <div style={{ paddingLeft: 16 }}>
          {item.submenu.map((sub) => (
            <NavLink
              key={sub.to} to={sub.to} end
              className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
              style={{ fontSize: 13 }}
            >
              <span className="link-label">{sub.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isVendedor    = user?.role === "vendedor";
  const isSuperAdmin  = user?.role === "superadmin";
  const isAdmin       = user?.role === "admin" || isSuperAdmin;
  const NAV = isVendedor ? NAV_VENDEDOR : NAV_ADMIN;
  const title = PAGE_TITLES[location.pathname] || "Sistema";

  // ── Recordatorios polling (solo superadmin) ────────────────────────────
  const [pendientesCount,  setPendientesCount]  = useState(0);
  const [notifVisible,     setNotifVisible]      = useState(false);
  const [notifItems,       setNotifItems]        = useState([]);
  const prevCountRef = useRef(null); // null = primera carga, no mostrar popup

  const checkRecordatorios = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await getRecordatoriosPendientes();
      const count = data.length;
      if (count > 0 && prevCountRef.current === 0) {
        setNotifItems(data.slice(0, 1));
        setNotifVisible(true);
        setTimeout(() => setNotifVisible(false), 8000);
      }
      prevCountRef.current = count;
      setPendientesCount(count);
    } catch { /* silencioso */ }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    checkRecordatorios().then(() => {});
    const interval = setInterval(checkRecordatorios, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAdmin, checkRecordatorios]);

  useEffect(() => {
    const handler = () => {
      prevCountRef.current = 0;
      setPendientesCount(0);
    };
    window.addEventListener('recordatorios-todos-leidos', handler);
    return () => window.removeEventListener('recordatorios-todos-leidos', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Cierre automático por inactividad (25 minutos) — global entre pestañas
  const INACTIVITY_MS = 25 * 60 * 1000;
  const checkIntervalRef = useRef(null);

  const updateLastActivity = useCallback(() => {
    localStorage.setItem("lastActivity", Date.now().toString());
  }, []);

  useEffect(() => {
    updateLastActivity(); // inicializar al montar
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, updateLastActivity, { passive: true }));

    // Chequear inactividad cada 60 segundos
    checkIntervalRef.current = setInterval(() => {
      const lastActivity = localStorage.getItem("lastActivity");
      if (lastActivity && Date.now() - Number(lastActivity) > INACTIVITY_MS) {
        logout();
        navigate("/login");
      }
    }, 60000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, updateLastActivity));
      clearInterval(checkIntervalRef.current);
    };
  }, [updateLastActivity, logout, navigate, INACTIVITY_MS]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">S</div>
          <div className="sidebar-logo-text">
            <h1>{user?.negocio_name || "Sistema"}</h1>
          </div>
        </div>

        <nav className="sidebar-nav">
          {!isVendedor && (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
                title="Inicio"
              >
                <span className="icon">🏠</span>
                <span className="link-label">Inicio</span>
              </NavLink>
              <div style={{ height: 1, background: "var(--border)", margin: "8px 10px 10px" }} />
            </>
          )}
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className="sidebar-section">
                <span className="sidebar-section-label">{section}</span>
              </div>
              {items.map((item) =>
                item.submenu ? (
                  <CajaNavItem key={item.label} item={item} location={location} />
                ) : (
                  <NavLink
                    key={item.to} to={item.to}
                    className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
                    title={item.label}
                  >
                    <span className="icon">{item.icon}</span>
                    <span className="link-label">{item.label}</span>
                  </NavLink>
                )
              )}
            </div>
          ))}
          {isAdmin && (
            <div>
              <div className="sidebar-section">
                <span className="sidebar-section-label">Herramientas</span>
              </div>
              <NavLink
                to="/asistente-ia"
                className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
                title="Asistente IA"
              >
                <span className="icon">🤖</span>
                <span className="link-label">Asistente IA</span>
              </NavLink>
            </div>
          )}
          {isSuperAdmin && (
            <div>
              <div className="sidebar-section">
                <span className="sidebar-section-label">Analytics</span>
              </div>
              {NAV_SUPERADMIN_EXTRA.map((item) => (
                <NavLink
                  key={item.to} to={item.to}
                  className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
                  title={item.label}
                >
                  <span className="icon">{item.icon}</span>
                  <span className="link-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {user && (
          // ── Footer del sidebar ──────────────────────────────────────────
          // min-width: 0 + overflow: hidden evitan que el contenido
          // se expanda y aplaste el sidebar cuando está colapsado.
          <div style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg3)",
            flexShrink: 0,
            minWidth: 0,
            overflow: "hidden",
          }}>
            {isVendedor && (
              <div style={{
                fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent)",
                background: "var(--accent-light)", border: "1px solid var(--accent)",
                borderRadius: 3, padding: "2px 7px", marginBottom: 6,
                display: "inline-block", textTransform: "uppercase", letterSpacing: "0.06em",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
              }}>
                Vendedor
              </div>
            )}
            <div style={{
              fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {user.name}
            </div>
            {user.warehouse_name && (
              <div style={{
                fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 8,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                🏭 {user.warehouse_name}
              </div>
            )}
            <button
              onClick={handleLogout}
              style={{
                width: "100%", padding: "5px 0", fontSize: 11, cursor: "pointer",
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: 4, color: "var(--text-dim)", fontFamily: "var(--font-mono)",
                textTransform: "uppercase", letterSpacing: "0.06em",
                whiteSpace: "nowrap", overflow: "hidden",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--danger)"; e.currentTarget.style.color = "var(--danger)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; }}
            >
              Salir
            </button>
          </div>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {user?.warehouse_name && (
              <span style={{
                fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-dim)",
                background: "var(--bg3)", padding: "4px 10px",
                borderRadius: "var(--radius)", border: "1px solid var(--border)",
              }}>
                🏭 {user.warehouse_name}
              </span>
            )}
            <span style={{
              fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-dim)",
              background: "var(--bg3)", padding: "4px 10px",
              borderRadius: "var(--radius)", border: "1px solid var(--border)",
            }}>
              {new Date().toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" })}
            </span>
            {isAdmin && (
              <button
                onClick={() => navigate("/recordatorios")}
                title="Recordatorios"
                style={{
                  position: "relative", background: pendientesCount > 0 ? "var(--accent-light)" : "var(--bg3)",
                  border: `1px solid ${pendientesCount > 0 ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "var(--radius)", padding: "4px 10px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, fontSize: 14,
                }}
              >
                🔔
                {pendientesCount > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
                    color: "var(--accent)", lineHeight: 1,
                  }}>
                    {pendientesCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </header>
        <div className="page">{children ?? <Outlet />}</div>
      </div>

      {/* ── Notificación flotante de nuevos recordatorios ── */}
      {isAdmin && notifVisible && notifItems.length > 0 && (
        <div style={{
          position: "fixed", top: 64, right: 20, zIndex: 9999,
          maxWidth: 340, display: "flex", flexDirection: "column", gap: 8,
        }}>
          {notifItems.slice(0, 3).map((r, i) => (
            <div key={i} style={{
              background: "var(--bg2)", border: "1px solid var(--accent)",
              borderRadius: 10, padding: "12px 16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
              display: "flex", gap: 10, alignItems: "flex-start",
              animation: "slideIn 0.25s ease",
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🔔</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                  {r.customer_name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {r.mensaje}
                </div>
              </div>
              <button
                onClick={() => setNotifVisible(false)}
                style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}
              >✕</button>
            </div>
          ))}
          {notifItems.length > 3 && (
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "8px 16px", fontSize: 12,
              color: "var(--text-dim)", textAlign: "center",
            }}>
              +{notifItems.length - 3} más · <button
                onClick={() => { navigate("/recordatorios"); setNotifVisible(false); }}
                style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0 }}
              >Ver todos</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
