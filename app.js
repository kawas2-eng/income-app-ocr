/*
 * Einnahmen OCR App (PWA)
 * Diese Datei implementiert die Logik für eine Einnahmen‑Übersicht mit optionaler OCR via Tesseract.js.
 * Nutzer können ein Bild oder PDF hochladen, der Text wird erkannt und relevante Felder (Datum, Stunden, Stundensatz) werden vorbefüllt.
 * Danach kann der Eintrag überprüft, gespeichert, gefiltert und exportiert werden.
 */

// LocalStorage-Schlüssel
const STORAGE_KEY_RECORDS = 'income_records_ocr';
const STORAGE_KEY_SETTINGS = 'income_settings_ocr';

// Globale Variablen
let records = [];
let settings = { taxRate: 0, taxPaid: 0 };

function loadData() {
  const rec = localStorage.getItem(STORAGE_KEY_RECORDS);
  records = rec ? JSON.parse(rec) : [];
  const set = localStorage.getItem(STORAGE_KEY_SETTINGS);
  settings = set ? JSON.parse(set) : { taxRate: 0, taxPaid: 0 };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

// Formatierungen
function formatDate(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  return date.toLocaleDateString('de-DE');
}

function formatCurrency(val) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
}

function updateSummary(list) {
  const div = document.getElementById('summaryContent');
  const total = list.reduce((sum, r) => sum + r.income, 0);
  const taxRate = settings.taxRate || 0;
  const taxAmount = total * (taxRate / 100);
  const net = total - taxAmount;
  const openTax = taxAmount - (settings.taxPaid || 0);
  let openLabel, openValue;
  if (openTax > 0) {
    openLabel = 'Offene Steuer';
    openValue = openTax;
  } else if (openTax < 0) {
    openLabel = 'Überzahlung';
    openValue = Math.abs(openTax);
  } else {
    openLabel = 'Ausgeglichen';
    openValue = 0;
  }
  div.innerHTML = `
    <p><strong>Gesamt-Einnahmen:</strong> ${formatCurrency(total)}</p>
    <p><strong>Steuersatz:</strong> ${taxRate}%</p>
    <p><strong>Steuerbetrag:</strong> ${formatCurrency(taxAmount)}</p>
    <p><strong>Bereits abgeführte Steuern:</strong> ${formatCurrency(settings.taxPaid || 0)}</p>
    <p><strong>${openLabel}:</strong> ${formatCurrency(openValue)}</p>
    <p><strong>Netto nach Steuern:</strong> ${formatCurrency(net)}</p>
  `;
}

function updateTable() {
  const tbody = document.getElementById('recordTableBody');
  tbody.innerHTML = '';
  const list = getFilteredRecords();
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  list.forEach((rec) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(rec.date)}</td>
      <td>${rec.facility}</td>
      <td>${rec.hours}</td>
      <td>${formatCurrency(rec.rate)}</td>
      <td>${formatCurrency(rec.income)}</td>
      <td><button data-id="${rec.id}" class="deleteBtn">Löschen</button></td>
    `;
    tbody.appendChild(tr);
  });
  updateSummary(list);
  document.querySelectorAll('.deleteBtn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      records = records.filter((r) => r.id !== id);
      saveData();
      updateTable();
    });
  });
}

// Filterlogik
function getFilteredRecords() {
  const monthSel = document.getElementById('monthFilter').value;
  const yearSel = document.getElementById('yearFilter').value;
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;
  return records.filter((rec) => {
    const d = new Date(rec.date);
    let ok = true;
    if (monthSel !== 'all') ok = ok && d.getMonth() + 1 === parseInt(monthSel);
    if (yearSel !== 'all') ok = ok && d.getFullYear() === parseInt(yearSel);
    if (fromDate) ok = ok && d >= new Date(fromDate);
    if (toDate) {
      const t = new Date(toDate);
      t.setHours(23, 59, 59, 999);
      ok = ok && d <= t;
    }
    return ok;
  });
}

function populateFilters() {
  const monthSelect = document.getElementById('monthFilter');
  const yearSelect = document.getElementById('yearFilter');
  const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  // Monate nur einmal hinzufügen
  if (monthSelect.options.length <= 1) {
    monthNames.forEach((name, idx) => {
      const opt = document.createElement('option');
      opt.value = idx + 1;
      opt.textContent = name;
      monthSelect.appendChild(opt);
    });
  }
  // Jahre
  const years = new Set(records.map(r => new Date(r.date).getFullYear()));
  yearSelect.innerHTML = '<option value="all">Alle</option>';
  [...years].sort((a,b) => b-a).forEach((yr) => {
    const opt = document.createElement('option');
    opt.value = yr;
    opt.textContent = yr;
    yearSelect.appendChild(opt);
  });
}

// CSV Export
function exportToCsv() {
  const list = getFilteredRecords();
  if (list.length === 0) {
    alert('Keine Einträge zum Export.');
    return;
  }
  const header = ['Datum','Einrichtung','Stunden','Stundensatz','Einnahmen'];
  let csv = header.join(',') + '\n';
  list.forEach((r) => {
    csv += `${formatDate(r.date)},${r.facility},${r.hours},${r.rate},${r.income}\n`;
  });
  const total = list.reduce((sum,r) => sum + r.income,0);
  const taxRate = settings.taxRate || 0;
  const taxAmount = total * (taxRate/100);
  const net = total - taxAmount;
  csv += '\n';
  csv += `Gesamt Einnahmen:,${total}\n`;
  csv += `Steuersatz:,${taxRate}%\n`;
  csv += `Steuerbetrag:,${taxAmount}\n`;
  csv += `Bereits abgeführte Steuern:,${settings.taxPaid || 0}\n`;
  const openTax = taxAmount - (settings.taxPaid || 0);
  let openLabel, openValue;
  if (openTax > 0) {openLabel = 'Offene Steuer'; openValue = openTax;} else if (openTax < 0) {openLabel = 'Überzahlung'; openValue = Math.abs(openTax);} else {openLabel = 'Ausgeglichen'; openValue = 0;}
  csv += `${openLabel}:,${openValue}\n`;
  csv += `Netto nach Steuern:,${net}\n`;
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dt = new Date();
  a.download = `einnahmen_ocr_${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// OCR Verarbeitung
async function handleFile(file) {
  const ocrArea = document.getElementById('ocrText');
  ocrArea.value = 'Erkenne Text...';
  try {
    const { data: { text } } = await Tesseract.recognize(file, 'deu+eng', { logger: m => {
      // optional: Fortschritt anzeigen
    }});
    ocrArea.value = text;
    parseAndPrefill(text);
  } catch (err) {
    console.error(err);
    ocrArea.value = 'OCR fehlgeschlagen: ' + err.message;
  }
}

// Versuche Datum, Stunden und Stundensatz aus Text zu extrahieren
function parseAndPrefill(text) {
  const dateInput = document.getElementById('dateInput');
  const hoursInput = document.getElementById('hoursInput');
  const rateInput = document.getElementById('rateInput');
  // Datum suchen (Formate: 01.02.2026 oder 1.2.26 etc.)
  const dateRegex = /(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4})/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    const parts = dateMatch[1].replace(/\//g,'.').replace(/-/g,'.').split('.');
    let d = parts[0].padStart(2,'0');
    let m = parts[1].padStart(2,'0');
    let y = parts[2];
    if (y.length === 2) {
      y = (parseInt(y) < 50 ? '20' : '19') + y;
    }
    dateInput.value = `${y}-${m}-${d}`;
  }
  // Stunden suchen. Zuerst nach "Anzahl: <Zahl>" (z.B. "Anzahl: 12,00")
  const anzahlRegex = /Anzahl[:\s]*([\d\.,]+)/i;
  const anzahlMatch = text.match(anzahlRegex);
  if (anzahlMatch) {
    let hrs = anzahlMatch[1].replace(',', '.');
    hoursInput.value = hrs;
  } else {
    // Fallback: Zahl gefolgt von Einheiten (z.B. 5 h, 7,5 Std)
    const hoursRegex = /(\d+[\.,]?\d*)\s*(?:h|std|stunden)/i;
    const hoursMatch = text.match(hoursRegex);
    if (hoursMatch) {
      let hrs = hoursMatch[1].replace(',', '.');
      hoursInput.value = hrs;
    }
  }
  // Stundensatz suchen (z.B. 50,00 €, 50 €)
  const rateRegex = /(?:€|eur)?\s*(\d+[\.,]\d{1,2})/i;
  const rateMatch = text.match(rateRegex);
  if (rateMatch) {
    let rate = rateMatch[1].replace(',', '.');
    rateInput.value = rate;
  }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  populateFilters();
  updateTable();
  // Datepicker initial default to today
  const dateInput = document.getElementById('dateInput');
  if (!dateInput.value) {
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];
  }
  // Form-Submit
  const form = document.getElementById('recordForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('dateInput').value;
    const facility = document.getElementById('facilityInput').value.trim();
    const hours = parseFloat(document.getElementById('hoursInput').value);
    const rate = parseFloat(document.getElementById('rateInput').value);
    if (!date || !facility || isNaN(hours) || isNaN(rate)) {
      alert('Bitte alle Felder ausfüllen.');
      return;
    }
    const income = hours * rate;
    const id = Date.now().toString();
    records.push({ id, date, facility, hours, rate, income });
    saveData();
    populateFilters();
    updateTable();
    form.reset();
    // set default date again
    const today = new Date();
    document.getElementById('dateInput').value = today.toISOString().split('T')[0];
  });
  // Filter anwenden
  document.getElementById('applyFilter').addEventListener('click', () => {
    updateTable();
  });
  // CSV export
  document.getElementById('exportCsv').addEventListener('click', exportToCsv);
  // Einstellungen laden und speichern
  document.getElementById('taxRateInput').value = settings.taxRate;
  document.getElementById('taxPaidInput').value = settings.taxPaid;
  document.getElementById('saveSettings').addEventListener('click', () => {
    const taxRateVal = parseFloat(document.getElementById('taxRateInput').value);
    const taxPaidVal = parseFloat(document.getElementById('taxPaidInput').value);
    settings.taxRate = isNaN(taxRateVal) ? 0 : taxRateVal;
    settings.taxPaid = isNaN(taxPaidVal) ? 0 : taxPaidVal;
    saveData();
    updateTable();
    alert('Einstellungen gespeichert');
  });
  // Dateiinput
  document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Wenn PDF, lese erste Seite als DatenURL
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async function() {
        const pdfData = new Uint8Array(this.result);
        // Verwende pdf.js aus tesseract.js (tesseract verarbeiten PDF intern), also direkt recognize
        await handleFile(pdfData);
      };
      reader.readAsArrayBuffer(file);
    } else {
      handleFile(file);
    }
  });
});