'use strict';
/* ══════════════════════════════════════════════════════════════
   Bulk Actions + Export — Excel (CSV) / PDF helpers
   Adds checkbox selection and Export buttons to tables
══════════════════════════════════════════════════════════════ */

/**
 * Export table data to CSV (Excel-compatible).
 * @param {Array<Object>} rows  - array of row objects
 * @param {string} filename     - file name without extension
 * @param {Array<string>} [columns] - optional column order; if omitted, keys of first row
 */
function exportToCSV(rows, filename, columns) {
  if (!Array.isArray(rows) || !rows.length) {
    if (typeof showToast === 'function') showToast('⚠️', 'Bo\'sh', 'Eksport uchun ma\'lumot yo\'q');
    return;
  }
  var cols = columns || Object.keys(rows[0]);
  var csv = '﻿'; // BOM for Excel UTF-8
  csv += cols.map(_csvEscape).join(',') + '\n';
  csv += rows.map(function(r) {
    return cols.map(function(c) { return _csvEscape(r[c] == null ? '' : r[c]); }).join(',');
  }).join('\n');

  _downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), (filename || 'export') + '.csv');
}

function _csvEscape(v) {
  var s = String(v);
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * Export to PDF using printable HTML window.
 * @param {string} title  - PDF title
 * @param {string} html   - HTML body content
 */
function exportToPDF(title, html) {
  var w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Popup bloklangan — ruxsat bering');
    return;
  }
  w.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title>' +
    '<style>' +
      'body{font-family:Arial,sans-serif;padding:30px;color:#0F172A}' +
      'h1{font-size:22px;margin:0 0 4px;border-bottom:3px solid #1B4FD8;padding-bottom:8px}' +
      '.sub{color:#64748B;font-size:12px;margin-bottom:24px}' +
      'table{border-collapse:collapse;width:100%;font-size:12px;margin-top:10px}' +
      'th,td{border:1px solid #CBD5E1;padding:8px 10px;text-align:left}' +
      'th{background:#F1F5F9;font-weight:700;color:#475569}' +
      'tr:nth-child(even){background:#F8FAFC}' +
      '@media print{body{padding:10px}}' +
    '</style></head><body>' +
    '<h1>' + title + '</h1>' +
    '<div class="sub">IDU Platform · ' + new Date().toLocaleString('uz-UZ') + '</div>' +
    html +
    '<script>window.onload=function(){window.print();}<\/script>' +
    '</body></html>'
  );
  w.document.close();
}

function _downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 100);
}

/**
 * Convert HTML table to {headers, rows} for export.
 * @param {string} tableSelector
 */
function tableToData(tableSelector) {
  var tbl = document.querySelector(tableSelector);
  if (!tbl) return null;
  var headers = [].slice.call(tbl.querySelectorAll('thead th'))
    .map(function(th) { return th.textContent.trim(); });
  var rows = [].slice.call(tbl.querySelectorAll('tbody tr')).map(function(tr) {
    var obj = {};
    [].slice.call(tr.querySelectorAll('td')).forEach(function(td, i) {
      obj[headers[i] || ('col' + i)] = td.textContent.trim();
    });
    return obj;
  });
  return { headers, rows };
}

/**
 * Add Export buttons next to a table (idempotent).
 */
function addExportButtons(containerSelector, tableSelector, filename) {
  var container = document.querySelector(containerSelector);
  if (!container || container.querySelector('.export-btn-group')) return;
  var group = document.createElement('div');
  group.className = 'export-btn-group';
  group.innerHTML =
    '<button class="btn btn-secondary btn-sm" data-export="csv">📊 Excel (CSV)</button>' +
    '<button class="btn btn-secondary btn-sm" data-export="pdf">📄 PDF</button>';
  container.appendChild(group);

  group.querySelector('[data-export="csv"]').onclick = function() {
    var d = tableToData(tableSelector);
    if (d) exportToCSV(d.rows, filename || 'export', d.headers);
  };
  group.querySelector('[data-export="pdf"]').onclick = function() {
    var tbl = document.querySelector(tableSelector);
    if (!tbl) return;
    exportToPDF(filename || 'Export', tbl.outerHTML);
  };
}

// ── Bulk select helper for any table ─────────────────────────────────────────
function addBulkSelectAll(tableSelector) {
  var tbl = document.querySelector(tableSelector);
  if (!tbl) return;
  var ths = tbl.querySelectorAll('thead tr');
  if (!ths.length) return;
  var headerRow = ths[0];
  if (headerRow.querySelector('.bulk-checkbox-all')) return;

  var th = document.createElement('th');
  th.style.width = '32px';
  th.innerHTML = '<input type="checkbox" class="bulk-checkbox-all" onchange="_toggleBulkAll(this,\'' + tableSelector + '\')">';
  headerRow.insertBefore(th, headerRow.firstChild);

  tbl.querySelectorAll('tbody tr').forEach(function(tr) {
    if (tr.querySelector('.bulk-checkbox')) return;
    var td = document.createElement('td');
    td.innerHTML = '<input type="checkbox" class="bulk-checkbox">';
    tr.insertBefore(td, tr.firstChild);
  });
}

function _toggleBulkAll(checkbox, tableSelector) {
  var tbl = document.querySelector(tableSelector);
  if (!tbl) return;
  tbl.querySelectorAll('tbody .bulk-checkbox').forEach(function(cb) { cb.checked = checkbox.checked; });
}

window.exportToCSV  = exportToCSV;
window.exportToPDF  = exportToPDF;
window.tableToData  = tableToData;
window.addExportButtons = addExportButtons;
window.addBulkSelectAll = addBulkSelectAll;
window._toggleBulkAll   = _toggleBulkAll;

console.log('✅ Bulk Export module loaded');
