import { NavLink, useLocation } from "react-router-dom";

const NAV = [
  {
    section: "Operaciones",
    items: [
      { to: "/comprobantes", label: "Comprobantes", icon: "🧾" },
      { to: "/remitos",      label: "Remitos",      icon: "📦" },
      { to: "/caja",         label: "Caja",         icon: "💰" },
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
          <h1>SistemaOnce</h1>
          <span>Pasteur 280 · Local 11</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className="sidebar-section">{section}</div>
              {items.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    "sidebar-link" + (isActive ? " active" : "")
                  }
                >
                  <span className="icon">{icon}</span>
                  {label}
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
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
              {new Date().toLocaleDateString("es-AR")}
            </span>
          </div>
        </header>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
