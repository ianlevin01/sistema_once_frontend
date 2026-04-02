import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
});

// VENDEDORES
export const getVendedores       = ()         => api.get("/vendedores");
export const getVendedoresActivos = ()        => api.get("/vendedores/activos");
export const createVendedor      = (data)     => api.post("/vendedores", data);
export const updateVendedor      = (id, data) => api.put(`/vendedores/${id}`, data);
export const deleteVendedor      = (id)       => api.delete(`/vendedores/${id}`);

// CUSTOMERS
export const searchCustomers = (name) => api.get(`/customers/search?name=${name}`);
export const getCustomer     = (id)   => api.get(`/customers/${id}`);
export const createCustomer  = (data) => api.post("/customers", data);
export const updateCustomer  = (id, data) => api.put(`/customers/${id}`, data);
export const deleteCustomer  = (id)   => api.delete(`/customers/${id}`);

// CUENTA CORRIENTE
export const getCuentaCorrienteGeneral  = ()         => api.get("/cuenta-corriente");
export const getCuentaCorrienteCliente  = (id)       => api.get(`/cuenta-corriente/cliente/${id}`);
export const registrarPagoCC            = (id, data) => api.post(`/cuenta-corriente/cliente/${id}/pago`, data);
export const agregarSaldoCC             = (id, data) => api.post(`/cuenta-corriente/cliente/${id}/saldo`, data);
export const registrarCobranzaCC        = (id, data) => api.post(`/cuenta-corriente/cliente/${id}/cobranza`, data);
export const getCobranzasCC             = (from, to) => api.get(`/cuenta-corriente/cobranzas${from && to ? `?from=${from}&to=${to}` : ""}`);

// PRODUCTS
export const searchProducts  = (name)     => api.get(`/products/search?name=${name}`);
export const getProduct      = (id)       => api.get(`/products/${id}`);
export const createProduct   = (data)     => api.post("/products", data);
export const updateProduct   = (id, data) => api.put(`/products/${id}`, data);
export const deleteProduct   = (id)       => api.delete(`/products/${id}`);
export const getCategories   = ()         => api.get("/products/categories");
export const createCategory  = (name, parent_id = null) => api.post("/products/categories", { name, parent_id });

// REMITOS
export const getRemitos    = (from, to) =>
  api.get(`/remitos${from && to ? `?from=${from}&to=${to}` : ""}`);
export const getRemito     = (id)   => api.get(`/remitos/${id}`);
export const createRemito  = (data) => api.post("/remitos", data);
export const deleteRemito  = (id)   => api.delete(`/remitos/${id}`);

// COMPROBANTES
export const getComprobantes  = (from, to) =>
  api.get(`/comprobantes${from && to ? `?from=${from}&to=${to}` : ""}`);
export const getComprobante   = (id)   => api.get(`/comprobantes/${id}`);
export const createComprobante = (data) => api.post("/comprobantes", data);
export const deleteComprobante = (id)   => api.delete(`/comprobantes/${id}`);

// CAJA LISTADO (presupuestos + notas de pedido + remitos agrupados)
export const getListadoCaja = (from, to) =>
  api.get(`/comprobantes/listado${from && to ? `?from=${from}&to=${to}` : ""}`);

// CASH
export const getCashMovements  = (from, to) =>
  api.get(`/cash${from && to ? `?from=${from}&to=${to}` : ""}`);
export const getCashMovement   = (id)   => api.get(`/cash/${id}`);
export const createCashMovement = (data) => api.post("/cash", data);

// WEB ORDERS
export const getWebOrders         = (params)      => api.get("/web-orders", { params });
export const getWebOrder          = (id)          => api.get(`/web-orders/${id}`);
export const createWebOrder       = (data)        => api.post("/web-orders", data);
export const updateWebOrder       = (id, data)    => api.put(`/web-orders/${id}`, data);
export const deleteWebOrder       = (id)          => api.delete(`/web-orders/${id}`);
export const setWebOrderColor     = (id, color)   => api.patch(`/web-orders/${id}/color`, { color });
export const setWebOrderReservado = (id, reservado) => api.patch(`/web-orders/${id}/reservado`, { reservado });

export default api;
