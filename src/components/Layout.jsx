import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

const NAV = [
  {
    section: "Operaciones",
    items: [
      { to: "/comprobantes", label: "Comprobantes", icon: "🧾" },
      { to: "/remitos",      label: "Remitos",      icon: "📦" },
      {
        label: "Caja", icon: "💰",
        submenu: [
          { to: "/caja",          label: "Imputaciones" },
          { to: "/caja/listado",  label: "Listado"      },
        ],
      },
      { to: "/pedidos-web",  label: "Pedidos Web",  icon: "🌐" },
    ],
  },
  {
    section: "Maestros",
    items: [
      { to: "/cuenta-corriente", label: "Cuenta Corriente", icon: "💳" },
      { to: "/productos",        label: "Productos",        icon: "🏷️" },
      { to: "/vendedores",       label: "Vendedores",       icon: "🧑‍💼" },
    ],
  },
];

const PAGE_TITLES = {
  "/comprobantes":      "Comprobantes",
  "/remitos":           "Remitos",
  "/caja":              "Caja · Imputaciones",
  "/caja/listado":      "Caja · Listado",
  "/pedidos-web":       "Pedidos Web",
  "/cuenta-corriente":  "Cuenta Corriente",
  "/productos":         "Productos",
  "/vendedores":        "Vendedores",
};

function CajaNavItem({ item, location }) {
  const isCajaActive = location.pathname.startsWith("/caja");
  const [open, setOpen] = useState(isCajaActive);

  return (
    <div>
      {/* Ítem principal — toggle al hacer click */}
      <div
        className={"sidebar-link" + (isCajaActive ? " active" : "")}
        style={{ cursor: "pointer", userSelect: "none" }}
        title={item.label}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="icon">{item.icon}</span>
        <span className="link-label">{item.label}</span>
        <span style={{
          marginLeft: "auto",
          fontSize: 10,
          opacity: 0.5,
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 0.15s",
          paddingRight: 4,
        }}>▶</span>
      </div>

      {/* Submenú expandible hacia abajo dentro del sidebar */}
      {open && (
        <div style={{ paddingLeft: 16 }}>
          {item.submenu.map((sub) => (
            <NavLink
              key={sub.to}
              to={sub.to}
              end
              className={({ isActive }) =>
                "sidebar-link" + (isActive ? " active" : "")
              }
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
  const title = PAGE_TITLES[location.pathname] || "Sistema";

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
              {items.map((item) =>
                item.submenu ? (
                  <CajaNavItem key={item.label} item={item} location={location} />
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      "sidebar-link" + (isActive ? " active" : "")
                    }
                    title={item.label}
                  >
                    <span className="icon">{item.icon}</span>
                    <span className="link-label">{item.label}</span>
                  </NavLink>
                )
              )}
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
              {new Date().toLocaleDateString("es-AR", { weekday:"short", day:"numeric", month:"short", year:"numeric" })}
            </span>
          </div>
        </header>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
