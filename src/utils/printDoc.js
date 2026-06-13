/**
 * Utilidades de impresión para remitos y comprobantes.
 */
import api from "./api.js";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }) : "—";

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Dividir items en páginas (máx. 25 items por página para dejar espacio)
const divideIntoPages = (items, itemsPerPage = 25) => {
  const pages = [];
  for (let i = 0; i < items.length; i += itemsPerPage) {
    pages.push(items.slice(i, i + itemsPerPage));
  }
  return pages.length > 0 ? pages : [[]];
};

// Devuelve el símbolo de moneda según divisa
const currencyPrefix = (divisa) => divisa === "USD" ? "USD " : "$";

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
    display: table;
    width: 100%;
    border-bottom: 2px solid #111;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .header > div { display: table-cell; vertical-align: top; }
  .header .empresa { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
  .header .doc-info { text-align: right; font-size: 12px; color: #444; line-height: 1.6; width: 40%; }
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
  .meta-grid { font-size: 12px; }
  .meta-grid .row { display: block; margin-bottom: 2px; }
  .meta-grid .key { color: #555; display: inline-block; width: 45%; vertical-align: top; }
  .meta-grid .val { font-weight: 600; display: inline-block; width: 50%; vertical-align: top; }
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
  tbody tr:nth-child(even) { background: #c8c8c8; }
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
  .page { break-after: page; position: relative; padding-bottom: 60px; }
  .page:last-child { break-after: auto; }
  .page-number { position: absolute; bottom: 10px; right: 20px; font-size: 10px; color: #999; }
  @media print {
    body { padding: 16px 20px; }
    @page { margin: 1cm; }
    .page { break-after: page; }
    .page:last-child { break-after: auto; }
  }
`;

// ─────────────────────────────────────────────────────────────
// IMPRIMIR PEDIDO WEB
// ─────────────────────────────────────────────────────────────
export function printWebOrderPDF(order) {
  const items = (order.items || []).slice().sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "es")
  );
  const total = Number(order.total) || items.reduce((a, i) => a + i.quantity * Number(i.unit_price || 0), 0);
  const pages = divideIntoPages(items, 25);
  const totalPages = pages.length;

  const headerHtml = `
    <div class="header">
      <div>
        <div class="empresa">${order.customer_name || "—"}</div>
        ${order.customer_city  ? `<div style="font-size:12px;color:#666">📍 ${order.customer_city}</div>` : ""}
        ${order.customer_phone ? `<div style="font-size:12px;color:#666">📞 ${order.customer_phone}</div>` : ""}
        ${order.customer_email ? `<div style="font-size:12px;color:#666">✉ ${order.customer_email}</div>` : ""}
      </div>
      <div class="doc-info">
        <div class="doc-tipo">PEDIDO WEB</div>
        <div>N° ${order.numero || "—"}</div>
        <div>Fecha: ${fmtDate(order.created_at)}</div>
        ${order.comprobante_numero ? `<div style="font-weight:700">Nota de Pedido #${order.comprobante_numero}</div>` : ""}
        <div style="font-size:10px;color:#aaa;margin-top:4px">#${(order.id || "").slice(0, 8).toUpperCase()}</div>
      </div>
    </div>`;

  const pagesHtml = pages.map((pageItems, pageIdx) => {
    const pageNumber = pageIdx + 1;
    const itemsHtml = pageItems.map((it, idx) => `
      <tr>
        <td style="font-family:monospace;font-size:11px;color:#999;text-align:center;width:30px">${pageIdx * 25 + idx + 1}</td>
        <td style="font-family:monospace;font-size:11px;color:#555">${it.code || "—"}</td>
        <td>${it.name || "—"}</td>
        <td class="right" style="font-family:monospace">${it.quantity}</td>
        <td class="right" style="font-family:monospace">$${fmtMoney(it.unit_price)}</td>
        <td class="right" style="font-family:monospace;font-weight:700">$${fmtMoney(it.quantity * Number(it.unit_price || 0))}</td>
      </tr>
    `).join("");

    const isLastPage = pageNumber === totalPages;

    return `
    <div class="page">
      ${pageIdx === 0 ? headerHtml : ""}
      <div class="section" style="margin-top: ${pageIdx > 0 ? "0" : "0"}">
        <div class="section-title">Productos (${pageIdx === 0 ? items.length : "continuación"})</div>
        <table>
          <thead>
            <tr>
              <th style="width:30px;text-align:center">Nº</th>
              <th style="width:80px">Código</th>
              <th>Descripción</th>
              <th class="right" style="width:60px">Cant.</th>
              <th class="right" style="width:110px">P. Unit.</th>
              <th class="right" style="width:120px">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          ${isLastPage ? `
          <tfoot>
            <tr class="total-row">
              <td colspan="5" style="text-align:right;font-size:12px;color:#555">TOTAL</td>
              <td class="right" style="font-family:monospace">$${fmtMoney(total)}</td>
            </tr>
          </tfoot>` : ""}
        </table>
      </div>
      ${isLastPage && order.observaciones ? `
      <div class="section">
        <div class="section-title">Observaciones</div>
        <div style="font-size:12px;color:#444;line-height:1.6">${order.observaciones}</div>
      </div>` : ""}
      <div class="page-number">${totalPages > 1 ? `${pageNumber}/${totalPages}` : ""}</div>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Pedido Web N° ${order.numero || "—"}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  ${pagesHtml}
  <div class="footer">
    Documento generado el ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
  </div>
</body>
</html>`;

  openPrintWindow(html);
}

// ─────────────────────────────────────────────────────────────
// IMPRIMIR REMITO — 2 copias por hoja
// ─────────────────────────────────────────────────────────────
function buildRemitoHtml(remito, sinPrecios = false) {
  const items = (remito.items || []).slice().sort((a, b) =>
    (a.name || a.description || "").localeCompare(b.name || b.description || "", "es")
  );
  const total = items.reduce((a, i) => a + i.quantity * Number(i.unit_price || 0), 0);
  const cols = sinPrecios ? 4 : 6;
  const pages = divideIntoPages(items, 18);
  const totalPages = pages.length;

  const buildCopyForPage = (pageItems, pageIdx, isLastPage) => {
    const itemsHtml = pageItems.map((it, idx) => `
      <tr>
        <td style="font-family:monospace;color:#999;text-align:center;width:25px">${pageIdx * 18 + idx + 1}</td>
        <td style="font-family:monospace;color:#555">${it.code || "—"}</td>
        <td>${it.name || it.description || "—"}</td>
        <td class="right" style="font-family:monospace">${it.quantity}</td>
        ${sinPrecios ? "" : `
          <td class="right" style="font-family:monospace">$${fmtMoney(it.unit_price)}</td>
          <td class="right" style="font-family:monospace;font-weight:700">$${fmtMoney(it.quantity * Number(it.unit_price || 0))}</td>
        `}
      </tr>
    `).join("");

    return `
    <div class="remito-copy">
      <div class="header">
        <div>
          <div class="empresa">Remito</div>
          <div style="font-size:11px;color:#555;margin-top:2px">${remito.origen || "—"} → ${remito.destino || "—"}</div>
        </div>
        <div class="doc-info">
          <div class="doc-tipo">REMITO</div>
          ${remito.remito_numero ? `<div style="font-weight:700">N° ${remito.remito_numero}</div>` : ""}
          <div>Fecha: ${fmtDate(remito.created_at)}</div>
          ${remito.vendedor ? `<div>Vendedor: ${remito.vendedor}</div>` : ""}
          <div style="font-size:9px;color:#aaa;margin-top:2px">#${(remito.id || "").slice(0, 8).toUpperCase()}</div>
          ${totalPages > 1 ? `<div style="font-size:9px;color:#aaa">${pageIdx + 1}/${totalPages}</div>` : ""}
        </div>
      </div>
      <div style="font-size:11px;margin-bottom:8px;line-height:1.8">
        <div><span style="color:#555;display:inline-block;width:52px">Origen</span><span style="font-weight:600">${remito.origen || "—"}</span></div>
        <div><span style="color:#555;display:inline-block;width:52px">Destino</span><span style="font-weight:600">${remito.destino || "—"}</span></div>
        ${remito.customer_name ? `<div><span style="color:#555;display:inline-block;width:52px">Cliente</span><span style="font-weight:600">${remito.customer_name}</span></div>` : ""}
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:25px;text-align:center">Nº</th>
            <th style="width:70px">Código</th>
            <th>Descripción</th>
            <th class="right" style="width:50px">Cant.</th>
            ${sinPrecios ? "" : `
              <th class="right" style="width:90px">P. Unit.</th>
              <th class="right" style="width:100px">Total</th>
            `}
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || `<tr><td colspan="${cols}" style="text-align:center;color:#999">Sin productos</td></tr>`}
        </tbody>
        ${!sinPrecios && isLastPage ? `
        <tfoot>
          <tr class="total-row">
            <td colspan="5" style="text-align:right;font-size:11px;color:#555">TOTAL</td>
            <td class="right" style="font-family:monospace">$${fmtMoney(total)}</td>
          </tr>
        </tfoot>` : ""}
      </table>
      ${isLastPage && remito.texto_libre ? `<div style="margin-top:6px;font-size:10px;color:#555">${remito.texto_libre}</div>` : ""}
    </div>`;
  };

  const pagesHtml = pages.map((pageItems, pageIdx) => {
    const isLastPage = pageIdx === totalPages - 1;
    const copyHtml = buildCopyForPage(pageItems, pageIdx, isLastPage);
    return `${copyHtml}\n<hr class="cut" />\n${copyHtml}`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Remito — ${remito.origen} → ${remito.destino}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
    .remito-copy { padding: 14px 20px; }
    .header { display:table; width:100%; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:10px; }
    .header > div { display:table-cell; vertical-align:top; }
    .header .doc-info { width:40%; }
    .empresa { font-size:16px; font-weight:800; letter-spacing:-0.5px; }
    .doc-info { text-align:right; font-size:10px; color:#444; line-height:1.5; }
    .doc-tipo { font-size:13px; font-weight:700; color:#111; }
    table { width:100%; border-collapse:collapse; font-size:10px; margin-top:4px; }
    thead tr { background:#f0f0f0; border-bottom:2px solid #111; }
    th { padding:5px 6px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:#444; }
    th.right, td.right { text-align:right; }
    td { padding:5px 6px; border-bottom:1px solid #e0e0e0; }
    tbody tr:last-child td { border-bottom:none; }
    tbody tr:nth-child(even) { background:#c8c8c8; }
    .total-row { border-top:2px solid #111; font-weight:800; }
    .total-row td { padding:6px 6px; }
    .cut { border:none; border-top:1px dashed #bbb; margin:2px 0; }
    @media print {
      @page { margin: 0.8cm; size: A4; }
      .remito-copy { padding: 10px 16px; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;

  return html;
}

export function printRemitoPDF(remito, sinPrecios = false) {
  openPrintWindow(buildRemitoHtml(remito, sinPrecios));
}

// ─────────────────────────────────────────────────────────────
// IMPRIMIR COMPROBANTE (presupuesto, devolución, reposición, etc.)
// ─────────────────────────────────────────────────────────────
function buildComprobanteHtml(doc) {
  const items  = doc.items || [];
  const divisa = doc.divisa || "ARS";
  const prefix = currencyPrefix(divisa);

  const normalizeItem = (it) => ({
    code:       it.product_code || it.code || "—",
    name:       it.product_name || it.name || it.description || "—",
    quantity:   it.quantity,
    unit_price: Number(it.unit_price || 0),
  });

  const normalizedItems = items.map(normalizeItem).sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );

  const itemsTotalARS = normalizedItems.reduce((a, i) => a + i.quantity * i.unit_price, 0);
  const total = Number(doc.total) || itemsTotalARS;
  const cotizacion = (divisa === "USD" && total > 0 && itemsTotalARS > 0)
    ? itemsTotalARS / total
    : 1;
  const toDisplayPrice = (arsPrice) => divisa === "USD" ? arsPrice / cotizacion : arsPrice;

  const descuentoPct  = Number(doc.descuento_pct ?? 0) || 0;
  const subtotalDisp  = toDisplayPrice(itemsTotalARS);

  const tipoColorMap = {
    "Nota de Pedido":     "#2563eb",
    "Nota de Pedido Web": "#2563eb",
    "Presupuesto":        "#16a34a",
    "Presupuesto Web":    "#16a34a",
    "Devolucion":         "#dc2626",
    "Reposicion":         "#7c3aed",
    "Devol a proveedor":  "#7c3aed",
  };
  const tipoColor = tipoColorMap[doc.tipo] || "#111";

  const entityName = doc.customer_name
    || doc.supplier_name
    || (doc.es_consumidor_final ? (doc.consumidor_final_nombre || "Consumidor Final") : null)
    || "—";

  const paymentMethod = doc.payment_method
    || doc.payments?.[0]?.method
    || null;

  const headerHtml = `
    <div class="header">
      <div>
        <div class="empresa">${entityName}</div>
        ${doc.customer_city  ? `<div style="font-size:12px;color:#666">📍 ${doc.customer_city}</div>` : ""}
        ${doc.customer_phone ? `<div style="font-size:12px;color:#666">📞 ${doc.customer_phone}</div>` : ""}
        ${doc.customer_email ? `<div style="font-size:12px;color:#666">✉ ${doc.customer_email}</div>` : ""}
      </div>
      <div class="doc-info">
        <div class="doc-tipo" style="color:${tipoColor}">${(doc.tipo || "COMPROBANTE").toUpperCase()}</div>
        <div>Fecha: ${fmtDate(doc.created_at)}</div>
        ${doc.vendedor      ? `<div>Vendedor: ${doc.vendedor}</div>` : ""}
        ${paymentMethod     ? `<div>Pago: ${paymentMethod}</div>` : ""}
        ${divisa === "USD"  ? `<div style="font-weight:700;color:#059669">Divisa: USD</div>` : ""}
        <div style="font-size:10px;color:#aaa;margin-top:4px">#${(doc.id || "").slice(0, 8).toUpperCase()}</div>
      </div>
    </div>`;

  const pages = divideIntoPages(normalizedItems, 25);
  const totalPages = pages.length;

  const pagesHtml = pages.map((pageItems, pageIdx) => {
    const pageNumber = pageIdx + 1;
    const isLastPage = pageNumber === totalPages;
    const itemsHtml = pageItems.map((it, idx) => `
      <tr>
        <td style="font-family:monospace;font-size:11px;color:#999;text-align:center;width:30px">${pageIdx * 25 + idx + 1}</td>
        <td style="font-family:monospace;font-size:11px;color:#555">${it.code}</td>
        <td>${it.name}</td>
        <td class="right" style="font-family:monospace">${it.quantity}</td>
        <td class="right" style="font-family:monospace">${prefix}${fmtMoney(toDisplayPrice(it.unit_price))}</td>
        <td class="right" style="font-family:monospace;font-weight:700">${prefix}${fmtMoney(toDisplayPrice(it.quantity * it.unit_price))}</td>
      </tr>
    `).join("");

    return `
    <div class="page">
      ${pageIdx === 0 ? headerHtml : ""}
      <div class="section" style="margin-top: ${pageIdx > 0 ? "0" : "0"}">
        <div class="section-title">Productos (${pageIdx === 0 ? normalizedItems.length : "continuación"})</div>
        <table>
          <thead>
            <tr>
              <th style="width:30px;text-align:center">Nº</th>
              <th style="width:80px">Código</th>
              <th>Descripción</th>
              <th class="right" style="width:60px">Cant.</th>
              <th class="right" style="width:110px">P. Unit.</th>
              <th class="right" style="width:120px">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || "<tr><td colspan='6' style='text-align:center;color:#999;padding:20px'>Sin productos</td></tr>"}
          </tbody>
          ${isLastPage ? `
          <tfoot>
            ${descuentoPct !== 0 ? `
            <tr style="border-top:1px solid #ddd">
              <td colspan="4" style="text-align:right;font-size:11px;color:#555">SUBTOTAL</td>
              <td class="right" style="font-family:monospace;font-size:12px">${prefix}${fmtMoney(subtotalDisp)}</td>
            </tr>
            <tr>
              <td colspan="4" style="text-align:right;font-size:11px;color:${descuentoPct > 0 ? '#16a34a' : '#dc2626'};font-weight:700">
                ${descuentoPct > 0 ? 'DESCUENTO' : 'RECARGO'} ${Math.abs(descuentoPct)}%
              </td>
              <td class="right" style="font-family:monospace;font-size:12px;color:${descuentoPct > 0 ? '#16a34a' : '#dc2626'};font-weight:700">
                ${descuentoPct > 0 ? '−' : '+'}${prefix}${fmtMoney(Math.abs(subtotalDisp - total))}
              </td>
            </tr>` : ''}
            <tr class="total-row">
              <td colspan="4" style="text-align:right;font-size:12px;color:#555">TOTAL</td>
              <td class="right" style="font-family:monospace">${prefix}${fmtMoney(total)}</td>
            </tr>
          </tfoot>` : ""}
        </table>
      </div>
      ${isLastPage && doc.texto_libre ? `
      <div class="section">
        <div class="section-title">Observaciones</div>
        <div style="font-size:12px;color:#444;line-height:1.6">${doc.texto_libre}</div>
      </div>` : ""}
      <div class="page-number">${totalPages > 1 ? `${pageNumber}/${totalPages}` : ""}</div>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${doc.tipo || "Comprobante"} — ${entityName}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  ${pagesHtml}
  <div class="footer">
    Documento generado el ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
  </div>
</body>
</html>`;

  return html;
}

export async function printComprobantePDF(doc) {
  await openPrintWindow(buildComprobanteHtml(doc));
}

// ─────────────────────────────────────────────────────────────
// IMPRIMIR REMITO DE TRANSPORTE (documento formal A4)
// ─────────────────────────────────────────────────────────────
export function printRemitoTransporte(remito) {
  const numero  = String(remito.numero || 0).padStart(8, "0");
  const nroFull = `00001-${numero}`;
  const bultos  = remito.bultos || 1;
  const valor   = fmtMoney(remito.valor || 0);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Remito de Transporte ${nroFull}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #111;
      background: #fff;
      padding: 24px 32px;
    }
    /* ── Cabecera ── */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      border: 1px solid #444;
      margin-bottom: 16px;
    }
    .doc-header-left {
      padding: 12px 16px;
      border-right: 1px solid #444;
      flex: 1;
    }
    .empresa-name {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #003399;
    }
    .empresa-sub { font-size: 11px; color: #444; margin-top: 3px; }
    .doc-header-stamp {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 70px;
      border-right: 1px solid #444;
      padding: 8px;
    }
    .stamp-r {
      font-size: 32px;
      font-weight: 900;
      border: 3px solid #111;
      width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 4px;
    }
    .stamp-cod { font-size: 9px; text-align: center; }
    .doc-header-right {
      padding: 12px 16px;
      flex: 1.2;
    }
    .doc-number { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
    .doc-meta   { font-size: 12px; line-height: 1.7; }
    /* ── Datos destinatario ── */
    .destinatario {
      border-bottom: 1px solid #888;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .dest-row { display: flex; justify-content: space-between; font-size: 13px; }
    .dest-name { font-size: 15px; font-weight: 700; margin: 4px 0 6px; }
    .dest-addr     { font-size: 13px; margin-bottom: 2px; }
    .dest-location { font-size: 12px; color: #444; margin-bottom: 4px; }
    .dest-cuit { font-size: 12px; color: #444; }
    /* ── Cuerpo ── */
    .cuerpo {
      border: 1px solid #444;
      min-height: 260px;
      padding: 40px 32px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .bultos-line { font-size: 18px; font-weight: 700; letter-spacing: 1px; }
    .valor-line  { font-size: 16px; text-align: center; margin-top: 40px; }
    /* ── Pie transporte ── */
    .transporte-box {
      border: 1px solid #444;
      padding: 14px 16px;
    }
    .transporte-label { font-weight: 700; font-size: 13px; }
    .transporte-dir   { font-size: 12px; color: #444; margin-top: 3px; padding-left: 88px; }
    .copy { page-break-after: always; }
    .copy:last-child { page-break-after: auto; }
    @media print {
      body { padding: 12px 16px; }
      @page { margin: 0.8cm; size: A4; }
    }
  </style>
</head>
<body>`;

  const copyLabels = ["ORIGINAL", "DUPLICADO", "TRIPLICADO"];
  const copyHtml = copyLabels.map((label) => `
  <div class="copy">
    <!-- Cabecera -->
    <div class="doc-header">
      <div class="doc-header-left">
        <div class="empresa-name">•O•N•C•E•P•U•N•T•O•S•</div>
        <div class="empresa-sub">www.oncepuntos.com.ar</div>
        <div class="empresa-sub">(011) 3838-5284</div>
      </div>
      <div class="doc-header-stamp">
        <div class="stamp-r">R</div>
        <div class="stamp-cod">COD 001<br>DOCUMENTO<br>NO VALIDO<br>COMO FACTURA</div>
      </div>
      <div class="doc-header-right">
        <div class="doc-number">Remito No. ${nroFull}</div>
        <div class="doc-meta">
          Fecha: ${fmtDate(remito.created_at)}<br>
          IVA RESPONSABLE INSCRIPTO<br>
          CUIT.: 30-71634628-1
        </div>
      </div>
    </div>

    <!-- Destinatario -->
    <div class="destinatario">
      <div class="dest-row">
        <span>Señores: <span class="dest-name">${remito.customer_name || "—"}</span></span>
        <span style="font-weight:700">${label}</span>
      </div>
      ${remito.customer_domicilio ? `<div class="dest-addr">${remito.customer_domicilio}</div>` : ""}
      ${(remito.customer_localidad || remito.customer_provincia)
        ? `<div class="dest-location">${[remito.customer_localidad, remito.customer_provincia].filter(Boolean).join(" — ")}</div>`
        : ""}
      <div class="dest-cuit">
        CUIT: ${remito.customer_document || "0"}&nbsp;&nbsp;&nbsp;
        ${remito.customer_condicion_iva || "IVA RESPONSABLE INSCRIPTO"}
      </div>
    </div>

    <!-- Cuerpo -->
    <div class="cuerpo">
      <div class="bultos-line">${bultos}&nbsp;&nbsp;&nbsp;BULTO/S DE ARTICULO IMPORTADO</div>
      <div class="valor-line">Valor aproximado: ${valor}</div>
    </div>

    <!-- Pie transporte -->
    <div class="transporte-box">
      <span class="transporte-label">Transporte:&nbsp;&nbsp;</span>
      <span style="font-weight:700">${remito.transporte_nombre || "—"}</span>
      ${remito.transporte_domicilio
        ? `<div class="transporte-dir">${remito.transporte_domicilio}${remito.transporte_localidad ? ` - ${remito.transporte_localidad}` : ""}</div>`
        : remito.transporte_localidad ? `<div class="transporte-dir">${remito.transporte_localidad}</div>` : ""}
    </div>
  </div>`).join("");

  const html2 = html + copyHtml + `
</body>
</html>`;

  openPrintWindow(html2);
}

// ─────────────────────────────────────────────────────────────
// IMPRIMIR ETIQUETAS DE ENVÍO (4 etiquetas por hoja)
// ─────────────────────────────────────────────────────────────
export function printEtiquetasEnvio(remito) {
  const bultos = remito.bultos || 1;

  const etiqueta = `
    <div class="label">
      <div class="lbl-para-key">PARA:</div>
      <div class="lbl-name">${remito.customer_name || "—"}</div>
      ${remito.customer_domicilio ? `<div class="lbl-address">${remito.customer_domicilio}</div>` : ""}
      ${(remito.customer_localidad || remito.customer_provincia) ? `
        <div class="lbl-location">
          <span class="lbl-city">${remito.customer_localidad || ""}</span>
          <span class="lbl-province">${remito.customer_provincia || ""}</span>
        </div>` : ""}
      <hr class="lbl-divider" />
      <div class="lbl-envia-row">
        <span class="lbl-envia-label">Envía:</span>
        <div class="lbl-envia-val">${remito.envia || "—"}</div>
      </div>
      <hr class="lbl-divider" />
      <div class="lbl-bottom">
        <div class="lbl-transport-info">
          <div class="lbl-transport-key">Transporte:</div>
          <div class="lbl-transport-name">${remito.transporte_nombre || "—"}</div>
          ${remito.transporte_domicilio ? `<div class="lbl-transport-dir">${remito.transporte_domicilio}</div>` : ""}
          ${remito.transporte_localidad ? `<div class="lbl-transport-dir">${remito.transporte_localidad}</div>` : ""}
        </div>
        <div class="lbl-bultos-box">
          <div class="lbl-bultos-label">BULTOS:</div>
          <div class="lbl-bultos-num">${bultos}</div>
        </div>
      </div>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Etiquetas de Envío</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
    html, body { height: 100%; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      width: 100%; height: 100%; gap: 0;
    }
    .label {
      border: 1px solid #888;
      padding: 12pt 14pt;
      display: flex; flex-direction: column;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .lbl-para-key { font-size: 9pt; text-transform: uppercase; color: #555; letter-spacing: 0.08em; margin-bottom: 2pt; }
    .lbl-name     { font-size: 24pt; font-weight: 800; font-style: italic; line-height: 1.1; margin-bottom: 4pt; }
    .lbl-address  { font-size: 16pt; font-weight: 700; font-style: italic; margin-bottom: 3pt; }
    .lbl-location { display: flex; justify-content: space-between; font-size: 12pt; font-weight: 600; font-style: italic; }
    .lbl-city     { flex: 1; }
    .lbl-province { text-align: right; }
    .lbl-divider  { border: none; border-top: 1px dashed #999; margin: 6pt 0; }
    .lbl-envia-row { }
    .lbl-envia-label { font-size: 10pt; font-style: italic; color: #444; }
    .lbl-envia-val   { font-size: 13pt; font-weight: 700; margin-top: 2pt; }
    .lbl-bottom {
      display: flex; align-items: flex-end; justify-content: space-between;
      gap: 8pt; flex: 1; margin-top: 2pt;
    }
    .lbl-transport-info { flex: 1; }
    .lbl-transport-key  { font-size: 9pt; color: #555; }
    .lbl-transport-name { font-size: 11pt; font-weight: 700; margin: 2pt 0; }
    .lbl-transport-dir  { font-size: 8pt; color: #444; line-height: 1.4; }
    .lbl-bultos-box     { text-align: center; flex-shrink: 0; }
    .lbl-bultos-label   { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #444; margin-bottom: 2pt; }
    .lbl-bultos-num     {
      font-size: 40pt; font-weight: 900; line-height: 1;
      border: 2px solid #111; padding: 2pt 8pt; text-align: center;
    }
    @media print {
      html, body { height: 100%; margin: 0; }
      @page { margin: 0.5cm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="grid">
    ${etiqueta}
    ${etiqueta}
    ${etiqueta}
    ${etiqueta}
  </div>
</body>
</html>`;

  openPrintWindow(html);
}

// ─────────────────────────────────────────────────────────────
// IMPRIMIR CATÁLOGO DE PRODUCTOS
// items: [{ displayName, description, price, imageUrl }]
// opts:  { columns: 2|3, title: string }
// ─────────────────────────────────────────────────────────────
export function printCatalogoPDF(items, opts = {}) {
  const { columns = 3, title = "Catálogo de Productos" } = opts;

  const cardsHtml = items.map((item) => `
    <div class="card">
      ${item.imageUrl
        ? `<div class="card-img-wrap"><img src="${item.imageUrl}" class="card-img" alt="" /></div>`
        : `<div class="card-img-wrap card-img-placeholder"><span>Sin foto</span></div>`}
      <div class="card-body">
        <div class="card-name">${item.displayName || "—"}</div>
        ${item.description ? `<div class="card-desc">${item.description}</div>` : ""}
        ${item.price != null ? `<div class="card-price">$${fmtMoney(item.price)}</div>` : ""}
      </div>
    </div>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      color: #111;
      padding: 28px 32px;
    }
    .catalog-header {
      border-bottom: 3px solid #1d6fb8;
      padding-bottom: 14px;
      margin-bottom: 24px;
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    .catalog-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #111;
    }
    .catalog-sub {
      font-size: 12px;
      color: #888;
      font-style: italic;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(${columns}, 1fr);
      gap: 16px;
    }
    .card {
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
      background: #fff;
    }
    .card-img-wrap {
      width: 100%;
      aspect-ratio: 1 / 1;
      background: #f5f5f5;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .card-img-placeholder {
      color: #bbb;
      font-size: 11px;
    }
    .card-body {
      padding: 10px 12px 12px;
      border-top: 1px solid #f0f0f0;
    }
    .card-name {
      font-size: 13px;
      font-weight: 700;
      color: #111;
      line-height: 1.3;
      margin-bottom: 4px;
    }
    .card-desc {
      font-size: 11px;
      color: #666;
      line-height: 1.4;
      margin-bottom: 6px;
    }
    .card-price {
      font-size: 16px;
      font-weight: 800;
      color: #1d6fb8;
      font-variant-numeric: tabular-nums;
    }
    .catalog-footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #e0e0e0;
      font-size: 10px;
      color: #aaa;
      text-align: center;
    }
    @media print {
      body { padding: 14px 18px; }
      @page { margin: 1cm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="catalog-header">
    <div class="catalog-title">${title}</div>
    <div class="catalog-sub">${items.length} producto${items.length !== 1 ? "s" : ""}</div>
  </div>

  <div class="grid">
    ${cardsHtml || "<p style='color:#aaa;grid-column:1/-1;text-align:center;padding:40px'>Sin productos</p>"}
  </div>

  <div class="catalog-footer">
    Catálogo generado el ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} · oncepuntos.com.ar
  </div>
</body>
</html>`;

  openPrintWindow(html);
}

// ─────────────────────────────────────────────────────────────
// IMPRIMIR LISTA DE PRECIOS
// items: [{ displayName, priceValue, code, qxb }]
// ─────────────────────────────────────────────────────────────
export function printPreciosPDF(items, opts = {}) {
  const { title = "Lista de Precios" } = opts;

  const itemsHtml = items.map((item) => `
    <div class="price-card">
      <div class="price-name">${item.displayName || "—"}</div>
      <div class="price-codes">
        <span class="price-code"><strong>Código:</strong> ${item.code || "—"}</span>
        <span class="price-qxb"><strong>QxB:</strong> ${item.qxb || "—"}</span>
      </div>
      <div class="price-big">${item.priceValue != null ? `$${fmtMoney(item.priceValue)}` : "$0"}</div>
    </div>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      color: #111;
      padding: 16px 20px;
    }
    .prices-header {
      border-bottom: 2px solid #111;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .prices-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #111;
    }
    .prices-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .price-card {
      border: 1px solid #333;
      padding: 14px 12px;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      min-height: 160px;
      justify-content: space-between;
    }
    .price-name {
      font-size: 12px;
      font-weight: 700;
      color: #111;
      line-height: 1.2;
      margin-bottom: 6px;
    }
    .price-codes {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      margin-bottom: 8px;
      font-family: 'Courier New', monospace;
      font-weight: 700;
      color: #333;
    }
    .price-code {
      flex: 1;
    }
    .price-qxb {
      flex: 1;
      text-align: right;
    }
    .price-big {
      font-size: 52px;
      font-weight: 900;
      color: #111;
      text-align: center;
      font-family: 'Courier New', monospace;
      line-height: 1;
    }
    .prices-footer {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #e0e0e0;
      font-size: 9px;
      color: #999;
      text-align: center;
    }
    @media print {
      body { padding: 10px 14px; }
      @page { margin: 0.8cm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="prices-header">
    <div class="prices-title">${title}</div>
  </div>

  <div class="prices-grid">
    ${itemsHtml || "<p style='color:#aaa;grid-column:1/-1;text-align:center;padding:40px'>Sin productos</p>"}
  </div>

  <div class="prices-footer">
    Lista de precios generada el ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} · oncepuntos.com.ar
  </div>
</body>
</html>`;

  openPrintWindow(html);
}

// ─────────────────────────────────────────────────────────────
// IMPRIMIR CUENTA CORRIENTE INDIVIDUAL
// ─────────────────────────────────────────────────────────────
export function printCCPDF({ entity, cc, mode, cotizacion }) {
  const cuenta      = cc?.cuenta || cc;
  const movimientos = cc?.movimientos || cuenta?.movimientos || [];
  const saldo       = Number(cuenta?.saldo || 0);
  const divisa      = cuenta?.divisa ?? "ARS";
  const prefix      = divisa === "USD" ? "USD " : "$";
  const esProveedor = mode === "proveedor";
  const saldoLabel  = esProveedor
    ? (saldo > 0 ? "Le debemos" : "Sin deuda")
    : (saldo > 0 ? "Debe" : "Saldo a favor");

  const fmt = (n, dv) => `${dv === "USD" ? "USD " : "$"}${fmtMoney(n)}`;

  const rowsHtml = movimientos.map((m) => {
    const divisaCC    = m.divisa_cuenta ?? divisa;
    const hayConv     = m.divisa_cobro && m.divisa_cobro !== divisaCC;
    const signo       = m.tipo === "debito" ? "+" : "−";
    const col         = m.tipo === "debito" ? "color:#dc2626" : "color:#16a34a";
    return `
      <tr>
        <td style="font-family:monospace;font-size:11px">${fmtDate(m.created_at)}</td>
        <td>${m.order_id ? `<a href="/comprobantes/editar/${m.order_id}" target="_blank" style="color:#2563eb;text-decoration:underline">${m.concepto || "Comprobante"}</a>` : (m.concepto || "—")}</td>
        <td style="font-family:monospace;font-size:11px">${m.metodo_pago || "—"}</td>
        <td class="right" style="font-family:monospace;font-weight:700;${col}">${signo}${fmt(Number(m.monto || 0), divisaCC)}</td>
        <td class="right" style="font-family:monospace;font-size:11px">${hayConv && m.monto_original != null ? fmt(m.monto_original, m.divisa_cobro) : "—"}</td>
        <td style="font-size:11px">${m.tipo === "debito" ? "Débito" : "Cobro"}</td>
      </tr>`;
  }).join("");

  const now = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Cuenta corriente — ${entity?.name || "—"}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="empresa">${entity?.name || "—"}</div>
      ${entity?.document  ? `<div style="font-size:12px;color:#666">CUIT: ${entity.document}</div>` : ""}
      ${entity?.phone     ? `<div style="font-size:12px;color:#666">📞 ${entity.phone}</div>` : ""}
      ${entity?.domicilio ? `<div style="font-size:12px;color:#666">📍 ${entity.domicilio}${entity.localidad ? `, ${entity.localidad}` : ""}</div>` : ""}
    </div>
    <div class="doc-info">
      <div class="doc-tipo">CUENTA CORRIENTE</div>
      <div>${esProveedor ? "Proveedor" : "Cliente"}</div>
      <div style="font-size:10px;color:#aaa;margin-top:4px">Generado: ${now}</div>
    </div>
  </div>

  <div class="section">
    <div style="display:inline-block;background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:14px 20px;margin-bottom:20px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#666;margin-bottom:4px">Saldo actual (${divisa})</div>
      <div style="font-size:24px;font-weight:800;font-family:monospace;color:${saldo > 0 ? "#dc2626" : "#16a34a"}">${prefix}${fmtMoney(Math.abs(saldo))}</div>
      <div style="font-size:11px;color:#666;margin-top:2px">${saldoLabel}</div>
      ${cotizacion > 0 ? `<div style="font-size:10px;color:#999;margin-top:4px">≈ ${divisa === "USD" ? `$${fmtMoney(Math.abs(saldo) * cotizacion)}` : `USD ${fmtMoney(Math.abs(saldo) / cotizacion)}`} · cotiz. $${Number(cotizacion).toLocaleString("es-AR")}</div>` : ""}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Historial de movimientos (${movimientos.length})</div>
    <table>
      <thead>
        <tr>
          <th style="width:90px">Fecha</th>
          <th>Concepto</th>
          <th style="width:90px">Método</th>
          <th class="right" style="width:120px">Monto CC</th>
          <th class="right" style="width:100px">Original</th>
          <th style="width:60px">Tipo</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || "<tr><td colspan='6' style='text-align:center;color:#999;padding:20px'>Sin movimientos</td></tr>"}
      </tbody>
    </table>
  </div>

  <div class="footer">Documento generado el ${now}</div>
</body>
</html>`;

  openPrintWindow(html);
}

// ─────────────────────────────────────────────────────────────
// IMPRIMIR RESUMEN GENERAL DE CUENTAS CORRIENTES
// ─────────────────────────────────────────────────────────────
export function printCCGeneralPDF({ clientes, proveedores, cotizacion }) {
  const fmt    = (n, dv) => `${dv === "USD" ? "USD " : "$"}${fmtMoney(n)}`;
  const toARS  = (monto, dv) => dv === "USD" ? Number(monto) * (cotizacion || 1) : Number(monto);

  const clientesHtml = clientes.map((c) => {
    const dv    = c.divisa ?? "ARS";
    const saldo = Number(c.saldo || 0);
    const col   = saldo > 0 ? "color:#dc2626" : saldo < 0 ? "color:#16a34a" : "color:#666";
    return `
      <tr>
        <td>
          <div style="font-weight:500;font-size:13px">${c.customer_name || "—"}</div>
          ${c.customer_document ? `<div style="font-size:11px;color:#888;font-family:monospace">${c.customer_document}</div>` : ""}
        </td>
        <td style="font-size:11px">${dv}</td>
        <td class="right" style="font-family:monospace;font-weight:700;${col}">${fmt(saldo, dv)}</td>
        <td class="right" style="font-family:monospace;font-size:11px;color:#666">${dv === "USD" ? `$${fmtMoney(saldo * (cotizacion || 1))}` : "—"}</td>
        <td style="font-size:11px;color:#666;font-family:monospace">${fmtDate(c.ultimo_debito)}</td>
        <td style="font-size:11px;color:#666;font-family:monospace">${fmtDate(c.ultimo_pago)}</td>
      </tr>`;
  }).join("");

  const proveedoresHtml = proveedores.map((p) => {
    const dv    = p.divisa ?? "ARS";
    const saldo = Number(p.saldo || 0);
    const col   = saldo > 0 ? "color:#dc2626" : saldo < 0 ? "color:#16a34a" : "color:#666";
    const lbl   = saldo > 0 ? "Le debemos" : saldo < 0 ? "A favor" : "—";
    return `
      <tr>
        <td style="font-weight:500;font-size:13px">${p.name || "—"}</td>
        <td style="font-size:11px;color:#666;font-family:monospace">${p.document || "—"}</td>
        <td style="font-size:11px">${dv}</td>
        <td class="right" style="font-family:monospace;font-weight:700;${col}">${fmt(Math.abs(saldo), dv)}</td>
        <td class="right" style="font-family:monospace;font-size:11px;color:#666">${dv === "USD" ? `$${fmtMoney(Math.abs(saldo) * (cotizacion || 1))}` : "—"}</td>
        <td style="font-size:11px;color:#666">${lbl}</td>
      </tr>`;
  }).join("");

  const totalClientes    = clientes.reduce((a, c) => a + Math.max(0, toARS(c.saldo || 0, c.divisa ?? "ARS")), 0);
  const totalProveedores = proveedores.reduce((a, p) => a + Math.max(0, toARS(p.saldo || 0, p.divisa ?? "ARS")), 0);
  const now = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Cuentas corrientes — Resumen</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="empresa">Cuentas Corrientes</div>
      <div style="font-size:12px;color:#666;margin-top:4px">Resumen general</div>
    </div>
    <div class="doc-info">
      ${cotizacion > 0 ? `<div>💱 USD: $${Number(cotizacion).toLocaleString("es-AR")}</div>` : ""}
      <div style="font-size:10px;color:#aaa;margin-top:4px">Generado: ${now}</div>
    </div>
  </div>

  ${clientes.length > 0 ? `
  <div class="section">
    <div class="section-title">Clientes (${clientes.length})</div>
    <table>
      <thead><tr>
        <th>Cliente</th><th style="width:50px">Div.</th>
        <th class="right" style="width:120px">Saldo</th>
        <th class="right" style="width:110px">Equiv. ARS</th>
        <th style="width:90px">Último débito</th>
        <th style="width:90px">Último pago</th>
      </tr></thead>
      <tbody>${clientesHtml}</tbody>
      <tfoot><tr class="total-row">
        <td colspan="3" style="text-align:right;font-size:12px;color:#555">TOTAL DEUDA (ARS equiv.)</td>
        <td class="right" style="font-family:monospace;color:#dc2626">$${fmtMoney(totalClientes)}</td>
        <td colspan="2"></td>
      </tr></tfoot>
    </table>
  </div>` : ""}

  ${proveedores.length > 0 ? `
  <div class="section">
    <div class="section-title">Proveedores (${proveedores.length})</div>
    <table>
      <thead><tr>
        <th>Proveedor</th><th style="width:120px">CUIT</th><th style="width:50px">Div.</th>
        <th class="right" style="width:120px">Saldo</th>
        <th class="right" style="width:110px">Equiv. ARS</th>
        <th style="width:80px">Estado</th>
      </tr></thead>
      <tbody>${proveedoresHtml}</tbody>
      <tfoot><tr class="total-row">
        <td colspan="4" style="text-align:right;font-size:12px;color:#555">TOTAL DEUDA (ARS equiv.)</td>
        <td class="right" style="font-family:monospace;color:#dc2626">$${fmtMoney(totalProveedores)}</td>
        <td></td>
      </tr></tfoot>
    </table>
  </div>` : ""}

  <div class="footer">Documento generado el ${now}</div>
</body>
</html>`;

  openPrintWindow(html);
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Genera PDF en el backend (Puppeteer) y lo abre en el visor de PDF del navegador.
// El PDF se ve idéntico al documento — renderizado por Chrome headless.
// ─────────────────────────────────────────────────────────────
async function openPrintWindow(html) {
  try {
    // Usa la instancia de axios (misma baseURL y token que el resto de la app)
    const res  = await api.post("/print/pdf", { html }, { responseType: "blob" });
    const blob = res.data;
    const url  = URL.createObjectURL(blob);
    const tab  = window.open(url, "_blank");
    if (!tab) {
      alert("Habilitá las ventanas emergentes para ver el documento.");
      URL.revokeObjectURL(url);
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch (err) {
    console.error("[openPrintWindow]", err);
    alert("No se pudo generar el PDF. Verificá tu conexión e intentá de nuevo.");
  }
}

export async function downloadComprobantePDF(doc) {
  await openPrintWindow(buildComprobanteHtml(doc));
}

export async function downloadRemitoPDF(remito, sinPrecios = false) {
  await openPrintWindow(buildRemitoHtml(remito, sinPrecios));
}
