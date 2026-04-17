import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./utils/useAuth";
import Layout          from "./components/Layout";
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
import Clientes      from "./pages/Clientes";

// Ruta protegida: redirige a /login si no hay sesión
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/comprobantes" replace /> : <Login />}
      />

      {/* Rutas protegidas */}
      <Route path="/" element={<PrivateRoute><Navigate to="/comprobantes" replace /></PrivateRoute>} />

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

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/comprobantes" replace />} />
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
