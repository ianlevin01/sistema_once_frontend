import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout      from "./components/Layout";
import Comprobantes from "./pages/Comprobantes";
import Remitos     from "./pages/Remitos";
import Cash        from "./pages/Cash";
import CajaListado from "./pages/CajaListado";   // ← NUEVO
import WebOrders   from "./pages/WebOrders";
import Customers   from "./pages/Customers";
import Products    from "./pages/Products";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/comprobantes" replace />} />
        <Route path="/comprobantes" element={<Layout><Comprobantes /></Layout>} />
        <Route path="/remitos"      element={<Layout><Remitos /></Layout>} />
        <Route path="/caja"         element={<Layout><Cash /></Layout>} />
        <Route path="/caja/listado" element={<Layout><CajaListado /></Layout>} />  {/* ← NUEVO */}
        <Route path="/pedidos-web"  element={<Layout><WebOrders /></Layout>} />
        <Route path="/clientes"     element={<Layout><Customers /></Layout>} />
        <Route path="/productos"    element={<Layout><Products /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}
