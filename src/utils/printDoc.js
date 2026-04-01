/**
 * Utilidades de impresión para remitos y comprobantes.
 * Abre una ventana emergente con el HTML del documento y llama a window.print().
 */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── CSS base para todos los documentos imprimibles ──────────────────────────
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
    color: #111;
    background: #fff;
    padding: 32px 40px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #111;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .header .empresa { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
  .header .doc-info { text-align: right; font-size: 12px; color: #444; line-height: 1.6; }
  .header .doc-tipo { font-size: 16px; font-weight: 700; color: #111; }
  .section { margin-bottom: 18px; }
  .section-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #666;
    margin-bottom: 6px;
  }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; font-size: 12px; }
  .meta-grid .key { color: #555; }
  .meta-grid .val { font-weight: 600; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 12px;
  }
  thead tr { background: #f0f0f0; border-bottom: 2px solid #111; }
  th { padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #444; }
  th.right, td.right { text-align: right; }
  td { padding: 7px 8px; border-bottom: 1px solid #e0e0e0; }
  tbody tr:last-child td { border-bottom: none; }
  .total-row { border-top: 2px solid #111; font-weight: 800; font-size: 14px; }
  .total-row td { padding: 10px 8px; }
  .footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #ccc;
    font-size: 11px;
    color: #888;
    text-align: center;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    background: #f0f0f0;
    color: #333;
  }
  @media print {
    body { padding: 16px 20px; }
    @page { margin: 1cm; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// IMPRIMIR REMITO
// ─────────────────────────────────────────────────────────────────────────────
export function printRemitoPDF(remito, sinPrecios = false) {
  const items = remito.items || [];
  const total = items.reduce((a, i) => a + i.quantity * Number(i.unit_price || 0), 0);

  const itemsHtml = items.map((it) => `
    <tr>
      <td style="font-family:monospace;font-size:11px;color:#555">${it.code || "—"}</td>
      <td>${it.name || it.description || "—"}</td>
      <td class="right" style="font-family:monospace">${it.quantity}</td>
      ${sinPrecios ? "" : `
        <td class="right" style="font-family:monospace">$${fmtMoney(it.unit_price)}</td>
        <td class="right" style="font-family:monospace;font-weight:700">$${fmtMoney(it.quantity * Number(it.unit_price || 0))}</td>
      `}
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Remito — ${remito.origen} → ${remito.destino}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="empresa">Remito de Transferencia</div>
      <div style="font-size:12px;color:#555;margin-top:4px">
        ${remito.origen || "—"} → ${remito.destino || "—"}
      </div>
    </div>
    <div class="doc-info">
      <div class="doc-tipo">REMITO</div>
      <div>Fecha: ${fmtDate(remito.created_at)}</div>
      ${remito.vendedor ? `<div>Vendedor: ${remito.vendedor}</div>` : ""}
      <div style="font-size:10px;color:#aaa;margin-top:4px">#${(remito.id || "").slice(0, 8).toUpperCase()}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Movimiento</div>
    <div class="meta-grid">
      <div class="key">Origen</div>   <div class="val">${remito.origen || "—"}</div>
      <div class="key">Destino</div>  <div class="val">${remito.destino || "—"}</div>
      ${remito.customer_name ? `<div class="key">Cliente</div><div class="val">${remito.customer_name}</div>` : ""}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Productos (${items.length})</div>
    <table>
      <thead>
        <tr>
          <th style="width:80px">Código</th>
          <th>Descripción</th>
          <th class="right" style="width:60px">Cant.</th>
          ${sinPrecios ? "" : `
            <th class="right" style="width:100px">P. Unit.</th>
            <th class="right" style="width:110px">Total</th>
          `}
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || "<tr><td colspan='5' style='text-align:center;color:#999'>Sin productos</td></tr>"}
      </tbody>
      ${!sinPrecios ? `
      <tfoot>
        <tr class="total-row">
          <td colspan="4" style="text-align:right;font-size:12px;color:#555">TOTAL</td>
          <td class="right" style="font-family:monospace">$${fmtMoney(total)}</td>
        </tr>
      </tfoot>` : ""}
    </table>
  </div>

  ${remito.texto_libre ? `
  <div class="section">
    <div class="section-title">Observaciones</div>
    <div style="font-size:12px;color:#444;line-height:1.6">${remito.texto_libre}</div>
  </div>` : ""}

  <div class="footer">
    Documento generado el ${new Date().toLocaleString("es-AR")}
  </div>
</body>
</html>`;

  openPrintWindow(html);
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPRIMIR NOTA DE PEDIDO / PRESUPUESTO
// ─────────────────────────────────────────────────────────────────────────────
export function printComprobantePDF(doc) {
  const items = doc.items || [];
  const total = doc.total || items.reduce((a, i) => a + i.quantity * Number(i.unit_price || 0), 0);

  const itemsHtml = items.map((it) => `
    <tr>
      <td style="font-family:monospace;font-size:11px;color:#555">${it.code || "—"}</td>
      <td>${it.name || it.description || "—"}</td>
      <td class="right" style="font-family:monospace">${it.quantity}</td>
      <td class="right" style="font-family:monospace">$${fmtMoney(it.unit_price)}</td>
      <td class="right" style="font-family:monospace;font-weight:700">$${fmtMoney(it.quantity * Number(it.unit_price || 0))}</td>
    </tr>
  `).join("");

  const tipoColor = doc.tipo === "Nota de Pedido" ? "#2563eb" : "#16a34a";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${doc.tipo || "Comprobante"} — ${doc.customer_name || ""}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="empresa">${doc.customer_name || "Cliente"}</div>
      ${doc.customer_city  ? `<div style="font-size:12px;color:#666">📍 ${doc.customer_city}</div>` : ""}
      ${doc.customer_phone ? `<div style="font-size:12px;color:#666">📞 ${doc.customer_phone}</div>` : ""}
      ${doc.customer_email ? `<div style="font-size:12px;color:#666">✉ ${doc.customer_email}</div>` : ""}
    </div>
    <div class="doc-info">
      <div class="doc-tipo" style="color:${tipoColor}">${(doc.tipo || "COMPROBANTE").toUpperCase()}</div>
      <div>Fecha: ${fmtDate(doc.created_at)}</div>
      ${doc.vendedor       ? `<div>Vendedor: ${doc.vendedor}</div>` : ""}
      ${doc.payment_method ? `<div>Pago: ${doc.payment_method}</div>` : ""}
      <div style="font-size:10px;color:#aaa;margin-top:4px">#${(doc.id || "").slice(0, 8).toUpperCase()}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Productos (${items.length})</div>
    <table>
      <thead>
        <tr>
          <th style="width:80px">Código</th>
          <th>Descripción</th>
          <th class="right" style="width:60px">Cant.</th>
          <th class="right" style="width:100px">P. Unit.</th>
          <th class="right" style="width:110px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || "<tr><td colspan='5' style='text-align:center;color:#999'>Sin productos</td></tr>"}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4" style="text-align:right;font-size:12px;color:#555">TOTAL</td>
          <td class="right" style="font-family:monospace">$${fmtMoney(total)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  ${doc.texto_libre ? `
  <div class="section">
    <div class="section-title">Observaciones</div>
    <div style="font-size:12px;color:#444;line-height:1.6">${doc.texto_libre}</div>
  </div>` : ""}

  ${doc.escenario && doc.escenario !== "Escenario" ? `
  <div class="section">
    <div class="section-title">Escenario</div>
    <span class="badge">${doc.escenario}</span>
  </div>` : ""}

  <div class="footer">
    Documento generado el ${new Date().toLocaleString("es-AR")}
  </div>
</body>
</html>`;

  openPrintWindow(html);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: abrir ventana de impresión
// ─────────────────────────────────────────────────────────────────────────────
function openPrintWindow(html) {
  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) {
    alert("Habilitá las ventanas emergentes para imprimir.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Pequeño delay para que el browser termine de renderizar antes de imprimir
  setTimeout(() => {
    w.focus();
    w.print();
  }, 300);
}
