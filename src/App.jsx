import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./utils/useAuth";
import Layout, { VENDEDOR_HOME, isPathAllowedForVendedor } from "./components/Layout";
import Login           from "./pages/Login";
import Comprobantes    from "./pages/Comprobantes";
import Remitos         from "./pages/Remitos";
import Cash            from "./pages/Cash";
import CajaListado     from "./pages/CajaListado";
import WebOrders       from "./pages/WebOrders";
import CuentaCorriente from "./pages/CuentaCorriente";
import Products        from "./pages/Products";
import Vendedores      from "./pages/Vendedores";
import Configuracion   from "./pages/Configuracion";
import Usuarios        from "./pages/Usuarios";
import Calculadora   from "./pages/Calculadora";
import Transportes   from "./pages/Transportes";
import Clientes        from "./pages/Clientes";
import UltimasCompras from "./pages/UltimasCompras";
import StockMovimientos from "./pages/StockMovimientos";
import CatalogosPersonalizados from "./pages/CatalogosPersonalizados";
import Dashboard from "./pages/Dashboard";
import Rentabilidad  from "./pages/Rentabilidad";
import AsistenteIA  from "./pages/AsistenteIA";
import Recordatorios from "./pages/Recordatorios";

// Ruta protegida: redirige a /login si no hay sesión.
// Si el usuario es vendedor y la ruta no está permitida, redirige a su home.
function PrivateRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === "vendedor" && !isPathAllowedForVendedor(location.pathname)) {
    return <Navigate to={VENDEDOR_HOME} replace />;
  }
  return children;
}

// Ruta exclusiva superadmin
function SuperAdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "superadmin") return <Navigate to="/dashboard" replace />;
  return children;
}

// Ruta exclusiva admin o superadmin
function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "admin" && user?.role !== "superadmin") return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const homePath = user?.role === "vendedor" ? VENDEDOR_HOME : "/dashboard";

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={homePath} replace /> : <Login />}
      />

      {/* Todas las rutas autenticadas comparten una sola instancia de Layout */}
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/" element={<Navigate to={homePath} replace />} />
        <Route path="/dashboard"                element={<Dashboard />} />
        <Route path="/comprobantes"             element={<Comprobantes />} />
        <Route path="/comprobantes/nuevo"       element={<Comprobantes initialCreating={true} />} />
        <Route path="/comprobantes/editar/:editId" element={<Comprobantes />} />
        <Route path="/remitos"                  element={<Remitos />} />
        <Route path="/remitos/nuevo"            element={<Remitos initialCreating={true} />} />
        <Route path="/remitos/editar/:editId"   element={<Remitos />} />
        <Route path="/caja"                     element={<Cash />} />
        <Route path="/caja/listado"             element={<CajaListado />} />
        <Route path="/pedidos-web"              element={<WebOrders />} />
        <Route path="/cuenta-corriente"         element={<CuentaCorriente />} />
        <Route path="/productos"                element={<Products />} />
        <Route path="/productos/ultimas-compras" element={<UltimasCompras />} />
        <Route path="/stock-movimientos"        element={<StockMovimientos />} />
        <Route path="/vendedores"               element={<Vendedores />} />
        <Route path="/configuracion"            element={<Configuracion />} />
        <Route path="/calculadora"              element={<Calculadora />} />
        <Route path="/usuarios"                 element={<Usuarios />} />
        <Route path="/transportes"              element={<Transportes />} />
        <Route path="/clientes"                 element={<Clientes />} />
        <Route path="/catalogos"               element={<CatalogosPersonalizados />} />
        <Route path="/asistente-ia"            element={<AdminRoute><AsistenteIA /></AdminRoute>} />
        <Route path="/rentabilidad"            element={<SuperAdminRoute><Rentabilidad /></SuperAdminRoute>} />
        <Route path="/recordatorios"           element={<SuperAdminRoute><Recordatorios /></SuperAdminRoute>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={homePath} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
