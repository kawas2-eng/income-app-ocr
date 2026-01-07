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
  const facilityInput = document.getElementById('facilityInput');
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

  // Spezielles Muster: "<stunden> Stunden ... <stundensatz> €"
  const hrRatePattern = /(\d+[\.,]?\d*)\s*Stunden?[^\d]*(\d+[\.,]?\d*)\s*(?:€|eur|euro)/i;
  const hrRateMatch = text.match(hrRatePattern);
  // Flag um zu verfolgen, ob der Stundensatz bereits gesetzt wurde
  let rateSet = false;
  if (hrRateMatch) {
    let hrsVal = hrRateMatch[1].replace(',', '.');
    let rateVal = hrRateMatch[2].replace(',', '.');
    if (!isNaN(parseFloat(hrsVal))) {
      hoursInput.value = parseFloat(hrsVal);
    }
    const rNum = parseFloat(rateVal);
    if (!isNaN(rNum) && rNum <= 120) {
      rateInput.value = rNum;
      rateSet = true;
    }
  }
  // Stunden suchen. Zuerst nach "Anzahl: <Zahl>" (z.B. "Anzahl: 12,00")
  const anzahlRegex = /Anzahl[:\s]*([\d\.,]+)/i;
  const anzahlMatch = text.match(anzahlRegex);
  if (!hoursInput.value && anzahlMatch) {
    let hrs = anzahlMatch[1].replace(',', '.');
    hoursInput.value = hrs;
  } else if (!hoursInput.value) {
    // Fallback: Zahl gefolgt von Einheiten (z.B. 5 h, 7,5 Std)
    const hoursRegex = /(\d+[\.,]?\d*)\s*(?:h|std|stunden)/i;
    const hoursMatch = text.match(hoursRegex);
    if (hoursMatch) {
      let hrs = hoursMatch[1].replace(',', '.');
      hoursInput.value = hrs;
    }
  }
  // Stundensatz suchen
  // 1. Explizite Angabe "Betrag: <Zahl>" oder "Stundensatz: <Zahl>" – wähle den ersten Wert <= 120
  const betragRegex = /(?:betrag|stundensatz)[:\s]*([\d\.,]+)/gi;
  // rateSet wird weiter oben beim speziellen Muster gesetzt
  let match;
  while (!rateSet && (match = betragRegex.exec(text)) !== null) {
    let val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val <= 120) {
      rateInput.value = val;
      rateSet = true;
      break;
    }
  }
  // 2. Fallback: erste gefundene Zahl mit Währung (€, EUR) <= 120
  if (!rateSet) {
    const rateRegex = /(\d+[\.,]\d{1,2})\s*(?:€|eur|euro)/gi;
    let rm;
    while ((rm = rateRegex.exec(text)) !== null) {
      let val = parseFloat(rm[1].replace(',', '.'));
      if (!isNaN(val) && val <= 120) {
        rateInput.value = val;
        rateSet = true;
        break;
      }
    }
  }

  // Einrichtung aus dem OCR-Text extrahieren
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  let facilityFound = false;
  for (let i = 0; i < lines.length; i++) {
    if (/auftraggeber/i.test(lines[i])) {
      if (i + 1 < lines.length) {
        facilityInput.value = lines[i + 1];
        facilityFound = true;
      }
      break;
    }
  }
  if (!facilityFound) {
    // Fallback: erste Zeile, die kein Datum, keine Stunden und keinen Betrag enthält
    const datePatterns = [/\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4}/];
    const hoursPattern = /(\d+[\.,]?\d*)\s*(?:h|std|stunden)/i;
    const ratePattern = /(\d+[\.,]\d{1,2})\s*(?:€|eur|euro)/i;
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lower = line.toLowerCase();
      const containsDate = datePatterns.some((p) => p.test(line));
      const containsHours = hoursPattern.test(line);
      const containsRate = ratePattern.test(line);
      if (!containsDate && !containsHours && !containsRate && lower.length > 2) {
        // Überspringe Zeilen, die wie ein Personenname oder eine Adresse aussehen
        const namePattern = /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]+\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]+$/;
        const addrPattern = /(strasse|straße|weg|platz|allee|gasse|stadt|[0-9]{4,5})/i;
        if ((namePattern.test(line) || addrPattern.test(lower)) && idx + 1 < lines.length) {
          const nextLine = lines[idx + 1];
          const nextLower = nextLine.toLowerCase();
          const nextContainsDate = datePatterns.some((p) => p.test(nextLine));
          const nextContainsHours = hoursPattern.test(nextLine);
          const nextContainsRate = ratePattern.test(nextLine);
          if (!nextContainsDate && !nextContainsHours && !nextContainsRate && nextLower.length > 2) {
            facilityInput.value = nextLine;
            facilityFound = true;
            break;
          }
        } else {
          facilityInput.value = line;
          facilityFound = true;
          break;
        }
      }
    }
  }
}

// PDF Verarbeitung: Konvertiere jede Seite des PDFs in ein Bild und führe OCR darauf aus
async function processPdf(file) {
  const ocrArea = document.getElementById('ocrText');
  ocrArea.value = 'PDF wird verarbeitet...';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result);
        // Setze Worker Pfad für pdf.js (notwendig in Browser ohne Bundler)
        if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        }
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          // Wähle einen Skalierungsfaktor für gute Lesbarkeit
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: context, viewport: viewport }).promise;
          const dataUrl = canvas.toDataURL('image/png');
          // OCR für die gerenderte Seite durchführen
          const { data: { text } } = await Tesseract.recognize(dataUrl, 'deu+eng');
          fullText += text + '\n';
        }
        ocrArea.value = fullText.trim();
        parseAndPrefill(fullText);
        resolve();
      } catch (error) {
        console.error(error);
        ocrArea.value = 'OCR fehlgeschlagen: ' + error.message;
        reject(error);
      }
    };
    reader.onerror = function(e) {
      ocrArea.value = 'Datei konnte nicht gelesen werden.';
      reject(e);
    };
    reader.readAsArrayBuffer(file);
  });
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
    // PDF separat verarbeiten, ansonsten direkt OCR
    if (file.type === 'application/pdf') {
      processPdf(file).catch((err) => {
        console.error(err);
      });
    } else {
      handleFile(file);
    }
  });
});