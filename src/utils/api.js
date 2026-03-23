import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  headers: { "Content-Type": "application/json" },
});

// CUSTOMERS
export const searchCustomers = (name) => api.get(`/customers/search?name=${name}`);
export const getCustomer = (id) => api.get(`/customers/${id}`);
export const createCustomer = (data) => api.post("/customers", data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);

// PRODUCTS
export const searchProducts = (name) => api.get(`/products/search?name=${name}`);
export const getProduct = (id) => api.get(`/products/${id}`);
export const createProduct = (data) => api.post("/products", data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data);
export const deleteProduct = (id) => api.delete(`/products/${id}`);

// REMITOS
export const getRemitos = () => api.get("/remitos");
export const getRemito = (id) => api.get(`/remitos/${id}`);
export const createRemito = (data) => api.post("/remitos", data);
export const deleteRemito = (id) => api.delete(`/remitos/${id}`);

// COMPROBANTES
export const getComprobantes = (from, to) =>
  api.get(`/comprobantes${from && to ? `?from=${from}&to=${to}` : ""}`);
export const getComprobante = (id) => api.get(`/comprobantes/${id}`);
export const createComprobante = (data) => api.post("/comprobantes", data);
export const deleteComprobante = (id) => api.delete(`/comprobantes/${id}`);

// CASH
export const getCashMovements = () => api.get("/cash");
export const getCashMovement = (id) => api.get(`/cash/${id}`);
export const createCashMovement = (data) => api.post("/cash", data);

export default api;

// WEB ORDERS
export const getWebOrders    = (params) => api.get("/web-orders", { params });
export const getWebOrder     = (id)     => api.get(`/web-orders/${id}`);
export const createWebOrder  = (data)   => api.post("/web-orders", data);
export const updateWebOrder  = (id, data) => api.put(`/web-orders/${id}`, data);
export const deleteWebOrder  = (id)     => api.delete(`/web-orders/${id}`);
export const setWebOrderColor     = (id, color)     => api.patch(`/web-orders/${id}/color`, { color });
export const setWebOrderReservado = (id, reservado) => api.patch(`/web-orders/${id}/reservado`, { reservado });
