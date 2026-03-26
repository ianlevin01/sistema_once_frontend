import { NavLink, useLocation } from "react-router-dom";

const NAV = [
  {
    section: "Operaciones",
    items: [
      { to: "/comprobantes", label: "Comprobantes", icon: "🧾" },
      { to: "/remitos",      label: "Remitos",      icon: "📦" },
      { to: "/caja",         label: "Caja",         icon: "💰" },
      { to: "/pedidos-web",  label: "Pedidos Web",  icon: "🌐" },
    ],
  },
  {
    section: "Maestros",
    items: [
      { to: "/clientes",  label: "Clientes",  icon: "👤" },
      { to: "/productos", label: "Productos", icon: "🏷️" },
    ],
  },
];

const PAGE_TITLES = {
  "/comprobantes": "Comprobantes",
  "/remitos":      "Remitos",
  "/caja":         "Caja",
  "/pedidos-web":  "Pedidos Web",
  "/clientes":     "Clientes",
  "/productos":    "Productos",
};

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || "Sistema";

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
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className="sidebar-section">
                <span className="sidebar-section-label">{section}</span>
              </div>
              {items.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    "sidebar-link" + (isActive ? " active" : "")
                  }
                  title={label}
                >
                  <span className="icon">{icon}</span>
                  <span className="link-label">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-actions">
            <span style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--text-dim)",
              background: "var(--bg3)",
              padding: "4px 10px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
            }}>
              {new Date().toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </header>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
