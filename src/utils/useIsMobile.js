import { useState, useEffect } from "react";

// Hook para ramificar estilos inline según el ancho de pantalla, en páginas
// con layouts complejos (grids de columnas fijas, paneles con altura fija)
// que no se pueden resolver solo con CSS/media queries.
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= breakpoint
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);

  return isMobile;
}
