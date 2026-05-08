/**
 * Utilidades de impresión para remitos y comprobantes.
 */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }) : "—";

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  tbody tr:nth-child(even) { background: #f7f7f7; }
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

// ─────────────────────────────────────────────────────────────
// IMPRIMIR PEDIDO WEB
// ─────────────────────────────────────────────────────────────
export function printWebOrderPDF(order) {
  const items = (order.items || []).slice().sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "es")
  );
  const total = Number(order.total) || items.reduce((a, i) => a + i.quantity * Number(i.unit_price || 0), 0);

  const itemsHtml = items.map((it) => `
    <tr>
      <td style="font-family:monospace;font-size:11px;color:#555">${it.code || "—"}</td>
      <td>${it.name || "—"}</td>
      <td class="right" style="font-family:monospace">${it.quantity}</td>
      <td class="right" style="font-family:monospace">$${fmtMoney(it.unit_price)}</td>
      <td class="right" style="font-family:monospace;font-weight:700">$${fmtMoney(it.quantity * Number(it.unit_price || 0))}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Pedido Web N° ${order.numero || "—"}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
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
  </div>

  <div class="section">
    <div class="section-title">Productos (${items.length})</div>
    <table>
      <thead>
        <tr>
          <th style="width:80px">Código</th>
          <th>Descripción</th>
          <th class="right" style="width:60px">Cant.</th>
          <th class="right" style="width:110px">P. Unit.</th>
          <th class="right" style="width:120px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || "<tr><td colspan='5' style='text-align:center;color:#999;padding:20px'>Sin productos</td></tr>"}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4" style="text-align:right;font-size:12px;color:#555">TOTAL</td>
          <td class="right" style="font-family:monospace">$${fmtMoney(total)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  ${order.observaciones ? `
  <div class="section">
    <div class="section-title">Observaciones</div>
    <div style="font-size:12px;color:#444;line-height:1.6">${order.observaciones}</div>
  </div>` : ""}

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

  const itemsHtml = items.map((it) => `
    <tr>
      <td style="font-family:monospace;color:#555">${it.code || "—"}</td>
      <td>${it.name || it.description || "—"}</td>
      <td class="right" style="font-family:monospace">${it.quantity}</td>
      ${sinPrecios ? "" : `
        <td class="right" style="font-family:monospace">$${fmtMoney(it.unit_price)}</td>
        <td class="right" style="font-family:monospace;font-weight:700">$${fmtMoney(it.quantity * Number(it.unit_price || 0))}</td>
      `}
    </tr>
  `).join("");

  const cols = sinPrecios ? 3 : 5;

  const copyHtml = `
  <div class="remito-copy">
    <div class="header">
      <div>
        <div class="empresa">Remito</div>
        <div style="font-size:11px;color:#555;margin-top:2px">${remito.origen || "—"} → ${remito.destino || "—"}</div>
      </div>
      <div class="doc-info">
        <div class="doc-tipo">REMITO</div>
        <div>Fecha: ${fmtDate(remito.created_at)}</div>
        ${remito.vendedor ? `<div>Vendedor: ${remito.vendedor}</div>` : ""}
        <div style="font-size:9px;color:#aaa;margin-top:2px">#${(remito.id || "").slice(0, 8).toUpperCase()}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;font-size:11px;margin-bottom:8px">
      <div style="color:#555">Origen</div>   <div style="font-weight:600">${remito.origen || "—"}</div>
      <div style="color:#555">Destino</div>  <div style="font-weight:600">${remito.destino || "—"}</div>
      ${remito.customer_name ? `<div style="color:#555">Cliente</div><div style="font-weight:600">${remito.customer_name}</div>` : ""}
    </div>
    <table>
      <thead>
        <tr>
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
      ${!sinPrecios ? `
      <tfoot>
        <tr class="total-row">
          <td colspan="4" style="text-align:right;font-size:11px;color:#555">TOTAL</td>
          <td class="right" style="font-family:monospace">$${fmtMoney(total)}</td>
        </tr>
      </tfoot>` : ""}
    </table>
    ${remito.texto_libre ? `<div style="margin-top:6px;font-size:10px;color:#555">${remito.texto_libre}</div>` : ""}
  </div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Remito — ${remito.origen} → ${remito.destino}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
    .remito-copy { padding: 14px 20px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:10px; }
    .empresa { font-size:16px; font-weight:800; letter-spacing:-0.5px; }
    .doc-info { text-align:right; font-size:10px; color:#444; line-height:1.5; }
    .doc-tipo { font-size:13px; font-weight:700; color:#111; }
    table { width:100%; border-collapse:collapse; font-size:10px; margin-top:4px; }
    thead tr { background:#f0f0f0; border-bottom:2px solid #111; }
    th { padding:5px 6px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:#444; }
    th.right, td.right { text-align:right; }
    td { padding:5px 6px; border-bottom:1px solid #e0e0e0; }
    tbody tr:last-child td { border-bottom:none; }
    tbody tr:nth-child(even) { background:#f7f7f7; }
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
  ${copyHtml}
  <hr class="cut" />
  ${copyHtml}
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

  // Normalizar campos de items: orderRepo.getById devuelve product_name/product_code,
  // pero algunos flujos devuelven name/code directamente.
  const normalizeItem = (it) => ({
    code:       it.product_code || it.code || "—",
    name:       it.product_name || it.name || it.description || "—",
    quantity:   it.quantity,
    unit_price: Number(it.unit_price || 0),
  });

  const normalizedItems = items.map(normalizeItem).sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );

  // Total: usar el guardado en doc.total, o recalcular desde items
  // Para comprobantes USD: doc.total está en USD, pero unit_price de items está en ARS.
  // Derivamos la cotizacion implícita para mostrar items en la moneda correcta.
  const itemsTotalARS = normalizedItems.reduce((a, i) => a + i.quantity * i.unit_price, 0);
  const total = Number(doc.total) || itemsTotalARS;
  const cotizacion = (divisa === "USD" && total > 0 && itemsTotalARS > 0)
    ? itemsTotalARS / total
    : 1;
  const toDisplayPrice = (arsPrice) => divisa === "USD" ? arsPrice / cotizacion : arsPrice;

  const itemsHtml = normalizedItems.map((it) => `
    <tr>
      <td style="font-family:monospace;font-size:11px;color:#555">${it.code}</td>
      <td>${it.name}</td>
      <td class="right" style="font-family:monospace">${it.quantity}</td>
      <td class="right" style="font-family:monospace">${prefix}${fmtMoney(toDisplayPrice(it.unit_price))}</td>
      <td class="right" style="font-family:monospace;font-weight:700">${prefix}${fmtMoney(toDisplayPrice(it.quantity * it.unit_price))}</td>
    </tr>
  `).join("");

  // Color según tipo
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

  // Nombre a mostrar en el header
  const entityName = doc.customer_name
    || doc.supplier_name
    || (doc.es_consumidor_final ? (doc.consumidor_final_nombre || "Consumidor Final") : null)
    || "—";

  // Línea de pago — buscar en payments array o en payment_method directo
  const paymentMethod = doc.payment_method
    || doc.payments?.[0]?.method
    || null;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${doc.tipo || "Comprobante"} — ${entityName}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
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
  </div>

  <div class="section">
    <div class="section-title">Productos (${normalizedItems.length})</div>
    <table>
      <thead>
        <tr>
          <th style="width:80px">Código</th>
          <th>Descripción</th>
          <th class="right" style="width:60px">Cant.</th>
          <th class="right" style="width:110px">P. Unit.</th>
          <th class="right" style="width:120px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || "<tr><td colspan='5' style='text-align:center;color:#999;padding:20px'>Sin productos</td></tr>"}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4" style="text-align:right;font-size:12px;color:#555">TOTAL</td>
          <td class="right" style="font-family:monospace">${prefix}${fmtMoney(total)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  ${doc.texto_libre ? `
  <div class="section">
    <div class="section-title">Observaciones</div>
    <div style="font-size:12px;color:#444;line-height:1.6">${doc.texto_libre}</div>
  </div>` : ""}

  <div class="footer">
    Documento generado el ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
  </div>
</body>
</html>`;

  return html;
}

export function printComprobantePDF(doc) {
  openPrintWindow(buildComprobanteHtml(doc));
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
      <div style="margin-bottom:4px">—</div>
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
        ? `<div class="transporte-dir">${remito.transporte_domicilio}</div>`
        : ""}
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

  const customerAddr = [remito.customer_domicilio, remito.customer_localidad].filter(Boolean).join(", ");

  const etiqueta = `
    <div class="label">
      <div class="label-body">
        <div class="lbl-row">
          <span class="lbl-key">PARA:</span>
        </div>
        <div class="lbl-name">*${remito.customer_name || "—"}</div>
        ${customerAddr ? `<div class="lbl-address">${customerAddr}</div>` : ""}
        <div style="margin: 6px 0; border-top: 1px dashed #aaa;"></div>
        <div class="lbl-row">
          <span class="lbl-key">Envía:</span>
          <span class="lbl-val">${remito.envia || "—"}</span>
        </div>
        <div style="height:6px"></div>
        <div class="lbl-transport-row">
          <div class="lbl-transport-info">
            <div class="lbl-key">Transporte:</div>
            <div class="lbl-transport-name">${remito.transporte_nombre || "—"}</div>
            ${remito.transporte_domicilio
              ? `<div class="lbl-transport-dir">${remito.transporte_domicilio}</div>`
              : ""}
          </div>
          <div class="lbl-bultos">${bultos}</div>
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
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
    }
    html, body { height: 100%; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      width: 100%;
      height: 100%;
      gap: 0;
    }
    .label {
      border: 1px solid #bbb;
      padding: 18px 16px;
      page-break-inside: avoid;
      overflow: hidden;
    }
    .label-body { height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
    .lbl-key     { font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: 0.06em; }
    .lbl-val     { font-size: 12px; font-weight: 600; }
    .lbl-name    { font-size: 18px; font-weight: 800; margin: 2px 0; }
    .lbl-address { font-size: 15px; color: #222; font-weight: 600; margin-bottom: 4px; }
    .lbl-row     { display: flex; align-items: baseline; gap: 6px; margin-bottom: 2px; }
    .lbl-transport-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 8px;
      margin-top: 4px;
    }
    .lbl-transport-info { flex: 1; }
    .lbl-transport-name { font-size: 11px; font-weight: 700; }
    .lbl-transport-dir  { font-size: 10px; color: #555; line-height: 1.3; }
    .lbl-bultos {
      font-size: 48px;
      font-weight: 900;
      line-height: 1;
      color: #111;
      text-align: right;
      min-width: 54px;
      border: 2px solid #111;
      padding: 2px 10px;
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
// Helper: abrir ventana de impresión
// ─────────────────────────────────────────────────────────────
function openPrintWindow(html) {
  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) {
    alert("Habilitá las ventanas emergentes para imprimir.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 300);
}

// ─────────────────────────────────────────────────────────────
// Helper: descargar HTML como PDF usando html2pdf.js
// ─────────────────────────────────────────────────────────────
async function downloadAsPdf(fullHtml, filename) {
  let iframe = null;
  try {
    const mod = await import("html2pdf.js");
    const html2pdf = mod.default ?? mod;

    // Renderizar el HTML completo en un iframe oculto para que
    // <head>/<style> se apliquen correctamente (innerHTML los descarta).
    iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-10000px;left:0;width:794px;height:1123px;border:none;";
    document.body.appendChild(iframe);

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), 10000);
      iframe.onload = () => { clearTimeout(t); resolve(); };
      iframe.srcdoc = fullHtml;
    });

    // Pausa breve para que los estilos terminen de aplicarse
    await new Promise((r) => setTimeout(r, 300));

    await html2pdf()
      .set({
        margin: 0.8,
        filename: `${filename}.pdf`,
        html2canvas: { scale: 2, logging: false, useCORS: true, backgroundColor: "#fff" },
        jsPDF: { unit: "cm", format: "a4", orientation: "portrait" },
      })
      .from(iframe.contentDocument.body)
      .save();
  } catch (err) {
    console.error("[downloadAsPdf]", err);
    alert("No se pudo generar el PDF. Intentá de nuevo.");
  } finally {
    if (iframe?.parentNode) iframe.parentNode.removeChild(iframe);
  }
}

export async function downloadComprobantePDF(doc) {
  const entityName = doc.customer_name
    || doc.supplier_name
    || (doc.es_consumidor_final ? (doc.consumidor_final_nombre || "Consumidor Final") : null)
    || "comprobante";
  const tipo     = (doc.tipo || "Comprobante").replace(/\s+/g, "-");
  const filename = `${tipo}-${entityName}-${(doc.id || "").slice(0, 8)}`
    .toLowerCase().replace(/[^a-z0-9-]/g, "");
  await downloadAsPdf(buildComprobanteHtml(doc), filename);
}

export async function downloadRemitoPDF(remito, sinPrecios = false) {
  const filename = `remito-${remito.origen || ""}-${remito.destino || ""}-${(remito.id || "").slice(0, 8)}`
    .toLowerCase().replace(/[^a-z0-9-]/g, "");
  await downloadAsPdf(buildRemitoHtml(remito, sinPrecios), filename);
}
