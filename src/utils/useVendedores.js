import { useState, useEffect } from "react";
import { getVendedoresActivos } from "./api";

/**
 * Hook que devuelve la lista de vendedores activos desde la API.
 * Devuelve un array de { id, nombre } listo para usar en selects.
 * Mientras carga devuelve [].
 */
export function useVendedores() {
  const [vendedores, setVendedores] = useState([]);

  useEffect(() => {
    getVendedoresActivos()
      .then(({ data }) => setVendedores(data))
      .catch(() => {});
  }, []);

  return vendedores;
}
