#!/usr/bin/env node
'use strict';

/**
 * parse-clickstream-sheet.js
 * Parses a detected clickstream definition file into structured JSON.
 * Supports .json, .md, .csv, .xlsx, .pdf, .pptx
 * Legacy .ppt files are not deterministically supported — requests conversion.
 * Auto-detects and installs missing parser dependencies.
 *
 * Usage: node parse-clickstream-sheet.js --path <file> [--root <project-root>]
 *
 * Output (stdout — machine-readable JSON):
 *   { "success": true, "events": [...], "params": { KEY: { rawValue, isDynamic, expectedValue } } }
 *   { "success": false, "reason": "..." }
 *
 * Does NOT: normalize names, validate mappings, compare implementations, modify source code.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
const PARSER_CONFIG_PATH = path.join(SKILL_DIR, 'assets', 'parser-config.json');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { filePath: null, root: process.cwd() };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--path' || argv[i] === '--file') {
      args.filePath = argv[++i];
    } else if (argv[i] === '--root') {
      args.root = argv[++i];
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Parser config
// ---------------------------------------------------------------------------
function loadParserConfig() {
  try {
    return JSON.parse(fs.readFileSync(PARSER_CONFIG_PATH, 'utf8'));
  } catch {
    return { xlsx: { package: 'xlsx', import: 'xlsx' }, csv: { package: 'csv-parse', import: 'csv-parse/sync' }, md: {}, json: {} };
  }
}

// ---------------------------------------------------------------------------
// Package manager detection
// ---------------------------------------------------------------------------
function detectPackageManager(root) {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

// ---------------------------------------------------------------------------
// Dependency installation
// ---------------------------------------------------------------------------
function tryInstall(packageName, root) {
  const pm = detectPackageManager(root);
  const cmd = pm === 'yarn'
    ? `yarn add ${packageName} --dev`
    : pm === 'pnpm'
      ? `pnpm add ${packageName} -D`
      : `npm install ${packageName} --save-dev`;
  try {
    process.stderr.write(`Installing ${packageName} via ${pm}...\n`);
    execSync(cmd, { cwd: root, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function requireWithFallback(importPath, root) {
  try {
    return require(importPath);
  } catch {
    try {
      return require(path.join(root, 'node_modules', importPath));
    } catch {
      return null;
    }
  }
}

function ensurePackage(packageName, importPath, root) {
  let mod = requireWithFallback(importPath, root);
  if (mod) return mod;
  const ok = tryInstall(packageName, root);
  if (!ok) return null;
  return requireWithFallback(importPath, root);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const IGNORED_KEYS = new Set([
  'parameter', 'parameter_name', 'field', 'field_name', 'key', 'value',
  'type', 'description', 'remarks', 'event', 'event_name', 'trigger',
  'sr', 's.no', 'no', '#'
]);

function buildParam(rawValue) {
  const isDynamic = /\{\{/.test(rawValue) || /\bdynamic\b/i.test(rawValue);
  const expectedValue = isDynamic ? null : rawValue.replace(/^[`'""]|[`'""]$/g, '').trim() || null;
  return { rawValue, isDynamic, expectedValue };
}

// ---------------------------------------------------------------------------
// Tabular rows parser (shared by CSV and XLSX)
// Auto-detects row-per-event vs row-per-parameter layout.
// ---------------------------------------------------------------------------
function parseTabularRows(headers, rows) {
  const params = {};
  const events = [];

  const norm = h => h.trim().toLowerCase().replace(/\s+/g, '_');
  const eventColIdx = headers.findIndex(h => /^(event[_ ]?name|event)$/.test(norm(h)));
  const triggerColIdx = headers.findIndex(h => /^trigger$/.test(norm(h)));
  const keyColIdx = headers.findIndex(h => /^(parameter|param|key|field)$/.test(norm(h)));
  const valueColIdx = headers.findIndex(h => /^(value|expected[_ ]?value|default)$/.test(norm(h)));

  if (eventColIdx !== -1) {
    // Row-per-event: each row is an event; remaining columns are parameter values
    const paramCols = headers
      .map((h, i) => ({ h: h.trim(), i }))
      .filter(({ i }) => i !== eventColIdx && i !== triggerColIdx && headers[i].trim() !== '');
    for (const row of rows) {
      const eventName = String(row[eventColIdx] || '').trim();
      if (!eventName) continue;
      const trigger = triggerColIdx !== -1 ? String(row[triggerColIdx] || '').trim() : '';
      const properties = [];
      for (const { h, i } of paramCols) {
        const rawValue = String(row[i] || '').trim();
        if (!rawValue || IGNORED_KEYS.has(norm(h))) continue;
        params[h] = buildParam(rawValue);
        properties.push(h);
      }
      events.push({ name: eventName, trigger, properties });
    }
  } else {
    // Row-per-parameter: first column = key, second = value
    const kIdx = keyColIdx !== -1 ? keyColIdx : 0;
    const vIdx = valueColIdx !== -1 ? valueColIdx : 1;
    for (const row of rows) {
      const key = String(row[kIdx] || '').trim();
      const rawValue = String(row[vIdx] || '').trim();
      if (!key || IGNORED_KEYS.has(norm(key)) || /^[-:]+$/.test(key)) continue;
      params[key] = buildParam(rawValue);
    }
  }

  return { events, params };
}

// ---------------------------------------------------------------------------
// .md parser
// ---------------------------------------------------------------------------
function parseMd(content) {
  const params = {};
  const events = [];
  const lines = content.split('\n');
  const rowRegex = /^\|\s*([^\|]+?)\s*\|\s*(.*?)\s*\|/;

  for (const line of lines) {
    const match = line.match(rowRegex);
    if (!match) continue;
    const key = match[1].trim();
    const rawValue = match[2].trim();
    const normKey = key.toLowerCase().replace(/\s+/g, '_');
    if (IGNORED_KEYS.has(normKey) || /^:?-{3,}:?$/.test(key) || /^:?-{3,}:?$/.test(rawValue)) continue;
    // Detect event name rows (ALL_CAPS with action words)
    if (/^[A-Z][A-Z0-9_]+$/.test(key) && /(VIEW|CLICK|SUBMIT|TAP|LOAD|OPEN|CLOSE|PAGE)/.test(key)) {
      events.push({ name: key, trigger: rawValue });
      continue;
    }
    params[key] = buildParam(rawValue);
  }

  return { success: true, events, params };
}

// ---------------------------------------------------------------------------
// .csv parser
// ---------------------------------------------------------------------------
function parseCsv(content, root) {
  const config = loadParserConfig();
  const csvCfg = config.csv || {};
  const pkg = csvCfg.package || 'csv-parse';
  const importPath = csvCfg.import || 'csv-parse/sync';

  const csvParse = ensurePackage(pkg, importPath, root);
  if (!csvParse) {
    return { success: false, reason: 'csv parser installation failed' };
  }

  let records;
  try {
    const parseFn = typeof csvParse.parse === 'function' ? csvParse.parse : csvParse;
    records = parseFn(content, { skip_empty_lines: true });
  } catch (e) {
    return { success: false, reason: `csv parse error: ${e.message}` };
  }

  if (!records || records.length < 2) return { success: true, events: [], params: {} };

  const headers = records[0].map(h => String(h));
  const dataRows = records.slice(1);
  const { events, params } = parseTabularRows(headers, dataRows);
  return { success: true, events, params };
}

// ---------------------------------------------------------------------------
// .xlsx parser
// ---------------------------------------------------------------------------
function parseXlsx(filePath, root) {
  const config = loadParserConfig();
  const xlsxCfg = config.xlsx || {};
  const pkg = xlsxCfg.package || 'xlsx';
  const importPath = xlsxCfg.import || 'xlsx';

  const XLSX = ensurePackage(pkg, importPath, root);
  if (!XLSX) {
    return { success: false, reason: 'xlsx parser installation failed' };
  }

  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (e) {
    return { success: false, reason: `xlsx read error: ${e.message}` };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rows || rows.length < 2) return { success: true, events: [], params: {} };

  const headers = rows[0].map(h => String(h));
  const dataRows = rows.slice(1).map(row => row.map(c => String(c)));
  const { events, params } = parseTabularRows(headers, dataRows);
  return { success: true, events, params };
}

// ---------------------------------------------------------------------------
// Confidence scoring — shared by PDF and PPTX parsers
// Returns { confident: boolean, reason?: string }
// ---------------------------------------------------------------------------
const MIN_TEXT_LENGTH = 50;          // minimum character threshold for extracted text
const MIN_TABLE_ROWS  = 2;           // minimum number of detectable table-like rows

function scoreExtractionConfidence(text) {
  if (!text || text.trim().length < MIN_TEXT_LENGTH) {
    return { confident: false, reason: 'extracted text is too short — document may be scanned or image-only' };
  }

  // Look for table-like rows: lines with multiple pipe, tab, or multi-space separators
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const tableLikeRows = lines.filter(l =>
    (l.match(/\|/g) || []).length >= 2 ||
    (l.match(/\t/g)  || []).length >= 2 ||
    (l.match(/  {2,}/g) || []).length >= 2
  );

  if (tableLikeRows.length < MIN_TABLE_ROWS) {
    return {
      confident: false,
      reason: `no structured table patterns found in extracted text (${tableLikeRows.length} table-like rows detected) — document may be visual-only or use a non-tabular layout`
    };
  }

  return { confident: true };
}

// ---------------------------------------------------------------------------
// Text → tabular rows extractor (shared by PDF and PPTX parsers)
// Attempts to parse pipe-separated or whitespace-separated column rows.
// ---------------------------------------------------------------------------
function parseTextAsTable(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Prefer pipe-separated rows
  const pipeRows = lines.filter(l => (l.match(/\|/g) || []).length >= 2);
  if (pipeRows.length >= MIN_TABLE_ROWS) {
    const parsed = pipeRows
      .map(l => l.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0))
      .filter(row => row.length >= 2);
    if (parsed.length >= MIN_TABLE_ROWS) {
      const headers = parsed[0];
      const dataRows = parsed.slice(1).filter(row =>
        !row.every(cell => /^:?-{2,}:?$/.test(cell))  // skip markdown separator rows
      );
      if (dataRows.length > 0) {
        return parseTabularRows(headers, dataRows);
      }
    }
  }

  // Fall back to tab/multi-space separated rows
  const tabRows = lines
    .map(l => l.split(/\t|  {2,}/).map(cell => cell.trim()).filter(cell => cell.length > 0))
    .filter(row => row.length >= 2);

  if (tabRows.length >= MIN_TABLE_ROWS) {
    const headers = tabRows[0];
    const dataRows = tabRows.slice(1);
    return parseTabularRows(headers, dataRows);
  }

  return { events: [], params: {} };
}

// ---------------------------------------------------------------------------
// .pdf parser
// ---------------------------------------------------------------------------
function parsePdf(filePath, root) {
  const config = loadParserConfig();
  const pdfCfg = config.pdf || {};
  const pkg = pdfCfg.package || 'pdf-parse';
  const importPath = pdfCfg.import || 'pdf-parse';

  const pdfParse = ensurePackage(pkg, importPath, root);
  if (!pdfParse) {
    return { success: false, reason: 'pdf-parse installation failed — install it manually: npm install pdf-parse' };
  }

  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(filePath);
  } catch (e) {
    return { success: false, reason: `pdf read error: ${e.message}` };
  }

  // pdf-parse returns a Promise; we handle async via a sync-blocking pattern
  // by writing the parse result to a temp file and reading it back.
  // This avoids top-level await in a CommonJS module.
  let text = null;
  let parseError = null;

  try {
    // Attempt synchronous-style extraction via sync wrapper if available
    const result = pdfParse(fileBuffer);
    // If result is a Promise, it must be awaited — use a blocking mechanism
    if (result && typeof result.then === 'function') {
      // Cannot await in sync context; use child_process workaround
      const { execFileSync } = require('child_process');
      const helperScript = [
        `const pdfParse = require(${JSON.stringify(importPath)});`,
        `const fs = require('fs');`,
        `const buf = fs.readFileSync(${JSON.stringify(filePath)});`,
        `pdfParse(buf).then(d => { process.stdout.write(JSON.stringify({ text: d.text })); }).catch(e => { process.stdout.write(JSON.stringify({ error: e.message })); });`
      ].join('\n');
      const raw = execFileSync(process.execPath, ['-e', helperScript], { cwd: root, encoding: 'utf8', timeout: 30000 });
      const parsed = JSON.parse(raw);
      if (parsed.error) {
        parseError = parsed.error;
      } else {
        text = parsed.text || '';
      }
    } else if (result && result.text) {
      text = result.text;
    }
  } catch (e) {
    parseError = e.message;
  }

  if (parseError !== null) {
    return { success: false, reason: `pdf text extraction failed: ${parseError}` };
  }

  if (text === null) {
    return { success: false, reason: 'pdf text extraction returned no output' };
  }

  const confidence = scoreExtractionConfidence(text);
  if (!confidence.confident) {
    return {
      success: false,
      reason: `PDF parsing confidence is low — ${confidence.reason}. Please provide a structured PDF with text-based tables, or convert to .xlsx, .csv, or .json.`
    };
  }

  const { events, params } = parseTextAsTable(text);
  return { success: true, events, params };
}

// ---------------------------------------------------------------------------
// .pptx parser
// ---------------------------------------------------------------------------
function parsePptx(filePath, root) {
  const config = loadParserConfig();
  const pptxCfg = config.pptx || {};
  const pkg = pptxCfg.package || 'officeparser';
  const importPath = pptxCfg.import || 'officeparser';

  const officeParser = ensurePackage(pkg, importPath, root);
  if (!officeParser) {
    return { success: false, reason: 'officeparser installation failed — install it manually: npm install officeparser' };
  }

  let text = null;
  let parseError = null;

  try {
    // officeparser.parseOfficeAsync returns a Promise
    const { execFileSync } = require('child_process');
    const helperScript = [
      `const op = require(${JSON.stringify(importPath)});`,
      `op.parseOfficeAsync(${JSON.stringify(filePath)}).then(d => { process.stdout.write(JSON.stringify({ text: d })); }).catch(e => { process.stdout.write(JSON.stringify({ error: e.message })); });`
    ].join('\n');
    const raw = execFileSync(process.execPath, ['-e', helperScript], { cwd: root, encoding: 'utf8', timeout: 30000 });
    const parsed = JSON.parse(raw);
    if (parsed.error) {
      parseError = parsed.error;
    } else {
      text = typeof parsed.text === 'string' ? parsed.text : '';
    }
  } catch (e) {
    parseError = e.message;
  }

  if (parseError !== null) {
    return { success: false, reason: `pptx text extraction failed: ${parseError}` };
  }

  if (text === null) {
    return { success: false, reason: 'pptx text extraction returned no output' };
  }

  const confidence = scoreExtractionConfidence(text);
  if (!confidence.confident) {
    return {
      success: false,
      reason: `PPTX parsing confidence is low — ${confidence.reason}. Please provide a PPTX with structured table slides, or convert to .xlsx, .csv, or .json.`
    };
  }

  const { events, params } = parseTextAsTable(text);
  return { success: true, events, params };
}

// ---------------------------------------------------------------------------
// .ppt parser — not directly supported; requests conversion
// ---------------------------------------------------------------------------
function parsePpt() {
  return {
    success: false,
    reason: 'Legacy .ppt files are not deterministically supported. Please convert to .pptx, .pdf, .xlsx, .csv, or .json.'
  };
}

// ---------------------------------------------------------------------------
// .json parser
// ---------------------------------------------------------------------------
function parseJson(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    return { success: false, reason: `json parse error: ${e.message}` };
  }

  // Already normalized format: { events, params }
  if (data && data.params && typeof data.params === 'object') {
    return { success: true, events: data.events || [], params: data.params };
  }

  // Array of event objects
  if (Array.isArray(data)) {
    const events = [];
    const params = {};
    for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      if (item.name) events.push({ name: String(item.name), trigger: item.trigger || '' });
      for (const [k, v] of Object.entries(item)) {
        if (k === 'name' || k === 'trigger' || k === 'properties') continue;
        params[k] = buildParam(String(v));
      }
    }
    return { success: true, events, params };
  }

  // Flat key-value object
  const params = {};
  for (const [key, val] of Object.entries(data)) {
    const normKey = key.toLowerCase();
    if (IGNORED_KEYS.has(normKey)) continue;
    params[key] = buildParam(String(val));
  }
  return { success: true, events: [], params };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv);

  if (!args.filePath) {
    process.stdout.write(JSON.stringify({ success: false, reason: '--path <file> is required' }) + '\n');
    process.exit(1);
  }

  if (!fs.existsSync(args.filePath)) {
    process.stdout.write(JSON.stringify({ success: false, reason: `File not found: ${args.filePath}` }) + '\n');
    process.exit(1);
  }

  const ext = path.extname(args.filePath).toLowerCase();
  let result;

  try {
    if (ext === '.json') {
      const content = fs.readFileSync(args.filePath, 'utf8');
      result = parseJson(content);
    } else if (ext === '.md') {
      const content = fs.readFileSync(args.filePath, 'utf8');
      result = parseMd(content);
    } else if (ext === '.csv') {
      const content = fs.readFileSync(args.filePath, 'utf8');
      result = parseCsv(content, args.root);
    } else if (ext === '.xlsx') {
      result = parseXlsx(args.filePath, args.root);
    } else if (ext === '.pdf') {
      result = parsePdf(args.filePath, args.root);
    } else if (ext === '.pptx') {
      result = parsePptx(args.filePath, args.root);
    } else if (ext === '.ppt') {
      result = parsePpt();
    } else {
      result = { success: false, reason: `Unsupported file extension: ${ext}. Supported: .json .md .csv .xlsx .pdf .pptx` };
    }
  } catch (e) {
    result = { success: false, reason: `Unexpected error: ${e.message}` };
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.success ? 0 : 1);
}

main();
