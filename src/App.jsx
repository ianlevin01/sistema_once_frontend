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
import Rentabilidad from "./pages/Rentabilidad";

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

      {/* Rutas protegidas */}
      <Route path="/" element={<PrivateRoute><Navigate to={homePath} replace /></PrivateRoute>} />

      <Route path="/dashboard" element={
        <PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>
      } />

      <Route path="/comprobantes" element={
        <PrivateRoute><Layout><Comprobantes /></Layout></PrivateRoute>
      } />
      <Route path="/comprobantes/nuevo" element={
        <PrivateRoute><Layout><Comprobantes initialCreating={true} /></Layout></PrivateRoute>
      } />
      <Route path="/comprobantes/editar/:editId" element={
        <PrivateRoute><Layout><Comprobantes /></Layout></PrivateRoute>
      } />
      <Route path="/remitos" element={
        <PrivateRoute><Layout><Remitos /></Layout></PrivateRoute>
      } />
      <Route path="/remitos/nuevo" element={
        <PrivateRoute><Layout><Remitos initialCreating={true} /></Layout></PrivateRoute>
      } />
      <Route path="/remitos/editar/:editId" element={
        <PrivateRoute><Layout><Remitos /></Layout></PrivateRoute>
      } />
      <Route path="/caja" element={
        <PrivateRoute><Layout><Cash /></Layout></PrivateRoute>
      } />
      <Route path="/caja/listado" element={
        <PrivateRoute><Layout><CajaListado /></Layout></PrivateRoute>
      } />
      <Route path="/pedidos-web" element={
        <PrivateRoute><Layout><WebOrders /></Layout></PrivateRoute>
      } />
      <Route path="/cuenta-corriente" element={
        <PrivateRoute><Layout><CuentaCorriente /></Layout></PrivateRoute>
      } />
      <Route path="/productos" element={
        <PrivateRoute><Layout><Products /></Layout></PrivateRoute>
      } />
      <Route path="/productos/ultimas-compras" element={
        <PrivateRoute><Layout><UltimasCompras /></Layout></PrivateRoute>
      } />
      <Route path="/stock-movimientos" element={
        <PrivateRoute><Layout><StockMovimientos /></Layout></PrivateRoute>
      } />
      <Route path="/vendedores" element={
        <PrivateRoute><Layout><Vendedores /></Layout></PrivateRoute>
      } />
      <Route path="/configuracion" element={
        <PrivateRoute><Layout><Configuracion /></Layout></PrivateRoute>
      } />
      <Route path="/calculadora" element={
        <PrivateRoute><Layout><Calculadora /></Layout></PrivateRoute>
      } />
      <Route path="/usuarios" element={
        <PrivateRoute><Layout><Usuarios /></Layout></PrivateRoute>
      } />
      <Route path="/transportes" element={
        <PrivateRoute><Layout><Transportes /></Layout></PrivateRoute>
      } />
      <Route path="/clientes" element={
        <PrivateRoute><Layout><Clientes /></Layout></PrivateRoute>
      } />
      <Route path="/catalogos" element={
        <PrivateRoute><Layout><CatalogosPersonalizados /></Layout></PrivateRoute>
      } />
      <Route path="/rentabilidad" element={
        <SuperAdminRoute><Layout><Rentabilidad /></Layout></SuperAdminRoute>
      } />

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
