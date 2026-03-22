import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Customers from "./pages/Customers";
import Products from "./pages/Products";
import Remitos from "./pages/Remitos";
import Comprobantes from "./pages/Comprobantes";
import Cash from "./pages/Cash";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/comprobantes" replace />} />
          <Route path="/clientes"     element={<Customers />} />
          <Route path="/productos"    element={<Products />} />
          <Route path="/remitos"      element={<Remitos />} />
          <Route path="/comprobantes" element={<Comprobantes />} />
          <Route path="/caja"         element={<Cash />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
