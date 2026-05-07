import axios from "axios";

const api = axios.create({
  baseURL: "https://oncepuntos.duckdns.org/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── AUTH ──────────────────────────────────────────────────────
export const login           = (email, password) => api.post("/auth/login", { email, password });
export const loginWithGoogle = (id_token)        => api.post("/auth/google", { id_token });
export const logout = () => {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
};

// ── USUARIOS DEL SISTEMA ──────────────────────────────────────
export const getUsers    = ()           => api.get("/users");
export const createUser  = (data)       => api.post("/users", data);
export const updateUser  = (id, data)   => api.put(`/users/${id}`, data);
export const deleteUser  = (id)         => api.delete(`/users/${id}`);

// ── WAREHOUSES ────────────────────────────────────────────────
export const getWarehouses    = ()       => api.get("/warehouses");
export const createWarehouse  = (name)   => api.post("/warehouses", { name });

// ── VENDEDORES ────────────────────────────────────────────────
export const getVendedores        = ()         => api.get("/vendedores");
export const getVendedoresActivos = ()         => api.get("/vendedores/activos");
export const createVendedor       = (data)     => api.post("/vendedores", data);
export const updateVendedor       = (id, data) => api.put(`/vendedores/${id}`, data);
export const deleteVendedor       = (id)       => api.delete(`/vendedores/${id}`);

// ── CUSTOMERS ─────────────────────────────────────────────────
export const getClientes       = ()           => api.get("/customers");
export const searchCustomers   = (name, conCC = false) =>
  api.get(`/customers/search?name=${encodeURIComponent(name)}${conCC ? "&con_cc=true" : ""}`);
export const getCustomer       = (id)         => api.get(`/customers/${id}`);
export const createCustomer    = (data)       => api.post("/customers", data);
export const updateCustomer    = (id, data)   => api.put(`/customers/${id}`, data);
export const deleteCustomer    = (id)         => api.delete(`/customers/${id}`);
export const openCuentaCorriente = (id)       => api.post(`/customers/${id}/cuenta-corriente`);

// ── PROVEEDORES ───────────────────────────────────────────────
export const searchProveedores          = (q)         => api.get(`/proveedores/search?q=${encodeURIComponent(q)}`);
export const getProveedor               = (id)        => api.get(`/proveedores/${id}`);
export const getProveedores             = ()          => api.get("/proveedores");
export const createProveedor            = (data)      => api.post("/proveedores", data);
export const updateProveedor            = (id, data)  => api.put(`/proveedores/${id}`, data);
export const deleteProveedor            = (id)        => api.delete(`/proveedores/${id}`);
export const getCCProveedor             = (id)        => api.get(`/proveedores/${id}/cuenta-corriente`);
export const getCCProveedoresSummary    = ()          => api.get("/proveedores/cc-summary");
export const registrarPagoProveedor     = (id, data)  => api.post(`/proveedores/${id}/pago`, data);
export const registrarCobranzaProveedor = (id, data)  => api.post(`/proveedores/${id}/cobranza`, data);
// Editar / eliminar movimientos de proveedor
export const editarMovimientoProv   = (movId, data) => api.put(`/proveedores/movimientos/${movId}`, data);
export const eliminarMovimientoProv = (movId)       => api.delete(`/proveedores/movimientos/${movId}`);

// ── CUENTA CORRIENTE (clientes) ───────────────────────────────
export const getCuentaCorrienteGeneral  = ()         => api.get("/cuenta-corriente");
export const getCuentaCorrienteCliente  = (id)       => api.get(`/cuenta-corriente/cliente/${id}`);
export const registrarPagoCC            = (id, data) => api.post(`/cuenta-corriente/cliente/${id}/pago`, data);
export const agregarSaldoCC             = (id, data) => api.post(`/cuenta-corriente/cliente/${id}/saldo`, data);
export const registrarCobranzaCC        = (id, data) => api.post(`/cuenta-corriente/cliente/${id}/cobranza`, data);
export const getCobranzasCC             = (from, to) => api.get(`/cuenta-corriente/cobranzas${from && to ? `?from=${from}&to=${to}` : ""}`);
// Editar / eliminar movimientos de cliente
export const editarMovimientoCC   = (movId, data) => api.put(`/cuenta-corriente/movimientos/${movId}`, data);
export const eliminarMovimientoCC = (movId)       => api.delete(`/cuenta-corriente/movimientos/${movId}`);

// ── PRICE CONFIG (cotización del dólar) ───────────────────────
export const getPriceConfig = () => api.get("/config/precios");

// ── PRODUCTS ──────────────────────────────────────────────────
export const searchProducts       = (name)       => api.get(`/products/search?name=${name}`);
export const getProductsForCatalog = (categoryId) =>
  api.get(`/products?category_id=${categoryId}&limit=300&sort=name_asc`);
export const getProduct           = (id)         => api.get(`/products/${id}`);
export const createProduct        = (data)       => api.post("/products", data);
export const updateProduct        = (id, data)   => api.put(`/products/${id}`, data);
export const deleteProduct        = (id)         => api.delete(`/products/${id}`);
export const getCategories        = ()           => api.get("/products/categories");
export const createCategory       = (name, parent_id = null) => api.post("/products/categories", { name, parent_id });
export const getProductOverride   = (id)         => api.get(`/products/${id}/price-overrides`);
export const setProductOverride   = (id, data)   => api.put(`/products/${id}/price-overrides`, data);
export const deleteProductOverride = (id)        => api.delete(`/products/${id}/price-overrides`);

// ── REMITOS ───────────────────────────────────────────────────
export const getRemitos    = (from, to) =>
  api.get(`/remitos${from && to ? `?from=${from}&to=${to}` : ""}`);
export const getRemito     = (id)   => api.get(`/remitos/${id}`);
export const createRemito  = (data) => api.post("/remitos", data);
export const updateRemito  = (id, data) => api.put(`/remitos/${id}`, data);
export const deleteRemito  = (id, password) => api.delete(`/remitos/${id}`, { data: { password } });

// ── TRANSPORTES ───────────────────────────────────────────────
export const getTransportes    = ()           => api.get("/transportes").then(r => r.data);
export const createTransporte  = (data)       => api.post("/transportes", data).then(r => r.data);
export const updateTransporte  = (id, data)   => api.put(`/transportes/${id}`, data).then(r => r.data);
export const deleteTransporte  = (id)         => api.delete(`/transportes/${id}`);

// ── REMITOS DE TRANSPORTE ─────────────────────────────────────
export const getTransportRemitos    = (from, to) =>
  api.get(`/transport-remitos${from && to ? `?from=${from}&to=${to}` : ""}`).then(r => r.data);
export const createTransportRemito  = (data) => api.post("/transport-remitos", data).then(r => r.data);
export const deleteTransportRemito  = (id)   => api.delete(`/transport-remitos/${id}`);

// ── COMPROBANTES ──────────────────────────────────────────────
export const getComprobantes   = (from, to) =>
  api.get(`/comprobantes${from && to ? `?from=${from}&to=${to}` : ""}`);
export const getComprobante    = (id)        => api.get(`/comprobantes/${id}`);
export const createComprobante = (data)      => api.post("/comprobantes", data);
export const updateComprobante = (id, data)  => api.put(`/comprobantes/${id}`, data);
export const deleteComprobante = (id, password) => api.delete(`/comprobantes/${id}`, { data: { password } });
export const getLastSalePrice  = (customer_id, product_id) =>
  api.get(`/comprobantes/last-price?customer_id=${customer_id}&product_id=${product_id}`);
export const getUltimasCompras = (from, to) =>
  api.get(`/comprobantes/ultimas-compras${from && to ? `?from=${from}&to=${to}` : ""}`);

// ── CAJA LISTADO ──────────────────────────────────────────────
export const getListadoCaja = (from, to) =>
  api.get(`/comprobantes/listado${from && to ? `?from=${from}&to=${to}` : ""}`);

// ── CASH ──────────────────────────────────────────────────────
export const getCashMovements   = (from, to) =>
  api.get(`/cash${from && to ? `?from=${from}&to=${to}` : ""}`);
export const getCashMovement    = (id)   => api.get(`/cash/${id}`);
export const createCashMovement = (data) => api.post("/cash", data);

// ── WEB ORDERS ────────────────────────────────────────────────
export const getWebOrders         = (params)        => api.get("/web-orders", { params });
export const getWebOrder          = (id)            => api.get(`/web-orders/${id}`);
export const createWebOrder       = (data)          => api.post("/web-orders", data);
export const updateWebOrder       = (id, data)      => api.put(`/web-orders/${id}`, data);
export const deleteWebOrder       = (id)            => api.delete(`/web-orders/${id}`);
export const setWebOrderColor     = (id, color)     => api.patch(`/web-orders/${id}/color`, { color });
export const setWebOrderReservado = (id, reservado) => api.patch(`/web-orders/${id}/reservado`, { reservado });

export default api;
