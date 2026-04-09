// utils/calcGanancia.js

export const TRAMOS = [
  { desde: 1_000_000, tasa: 60, label: "más de $1.000.000" },
  { desde: 500_000,   tasa: 50, label: "más de $500.000"   },
  { desde: 100_000,   tasa: 45, label: "más de $100.000"   },
  { desde: 0,         tasa: 40, label: "hasta $100.000"    },
];

export function getTasa(gananciaBruta) {
  const tramo = TRAMOS.find((t) => gananciaBruta >= t.desde);
  return tramo ?? TRAMOS[TRAMOS.length - 1];
}

export function calcGanancia({ precio1, precioVenta, cantidad }) {
  const diferencia    = precioVenta - precio1;
  const gananciaBruta = diferencia * cantidad;
  const tramo         = getTasa(gananciaBruta);
  const gananciaFinal = gananciaBruta * (tramo.tasa / 100);

  return {
    diferencia,
    gananciaBruta,
    gananciaFinal,
    tasa:        tramo.tasa,
    tramoLabel:  tramo.label,
    porUnidad:   gananciaFinal / (cantidad || 1),
  };
}