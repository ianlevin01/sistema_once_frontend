import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../utils/useAuth";

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
  { to: "/rentabilidad", label: "Rentabilidad", icon: "📈" },
];

const NAV_VENDEDOR = [
  {
    section: "Operaciones",
    items: [
      { to: "/remitos",   label: "Remitos Internos", icon: "📦" },
      { to: "/productos", label: "Productos",        icon: "🏷️" },
    ],
  },
];

const VENDEDOR_ALLOWED_PATHS = ["/remitos", "/productos"];
export const VENDEDOR_HOME = "/remitos";

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
  "/rentabilidad":     "Rentabilidad",
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
  const NAV = isVendedor ? NAV_VENDEDOR : NAV_ADMIN;
  const title = PAGE_TITLES[location.pathname] || "Sistema";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">S</div>
          <div className="sidebar-logo-text">
            <h1>SistemaOnce</h1>
            <span>Pasteur 280 · Local 11</span>
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
          </div>
        </header>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
