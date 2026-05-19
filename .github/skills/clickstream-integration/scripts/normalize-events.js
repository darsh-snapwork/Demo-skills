#!/usr/bin/env node
'use strict';

/**
 * normalize-events.js
 * Normalizes parsed clickstream event data into deterministic JSON.
 *
 * Input:  parsed JSON from parse-clickstream-sheet.js  (via --input <file>)
 *         Accepts output from all supported formats: .json, .md, .csv, .xlsx, .pdf, .pptx
 *         All formats produce the same upstream shape: { success, events[], params{} }
 * Output: normalized JSON to stdout + writes temp/normalized-events.json
 *
 * Normalization rules:
 *   - lowercase event names
 *   - replace spaces with underscores
 *   - remove duplicates
 *   - normalize missing arrays
 *   - clean malformed rows
 *
 * Does NOT: validate implementation, compare mappings, modify source code.
 * Does NOT: accept upstream success:false — normalizes only successfully parsed output.
 */

const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const TEMP_DIR = path.join(SKILL_DIR, 'temp');
const OUTPUT_PATH = path.join(TEMP_DIR, 'normalized-events.json');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { input: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--input' || argv[i] === '--file') {
      args.input = argv[++i];
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------
function isValidEvent(event) {
  if (!event || typeof event !== 'object') return false;
  const name = event.name;
  if (!name || typeof name !== 'string' || name.trim() === '') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Core normalization
// ---------------------------------------------------------------------------
function normalizeData(parsed) {
  const { events = [], params = {} } = parsed;

  // Normalize and deduplicate events
  const seenEvents = new Set();
  const normalizedEvents = [];

  for (const event of events) {
    if (!isValidEvent(event)) continue;
    const normalized = normalizeName(event.name);
    if (!normalized || seenEvents.has(normalized)) continue;
    seenEvents.add(normalized);

    const entry = { name: normalized };
    if (event.trigger && typeof event.trigger === 'string') {
      entry.trigger = event.trigger.trim();
    }
    if (Array.isArray(event.properties) && event.properties.length > 0) {
      entry.properties = event.properties.filter(p => p && typeof p === 'string');
    }
    normalizedEvents.push(entry);
  }

  // Normalize params: clean malformed entries, ensure required fields
  const normalizedParams = {};

  for (const [key, meta] of Object.entries(params)) {
    if (!key || typeof key !== 'string' || key.trim() === '') continue;
    if (!meta || typeof meta !== 'object') continue;

    const rawValue = typeof meta.rawValue === 'string' ? meta.rawValue : String(meta.rawValue || '');
    const isDynamic = typeof meta.isDynamic === 'boolean' ? meta.isDynamic : true;
    const expectedValue = (meta.expectedValue !== undefined && meta.expectedValue !== null)
      ? meta.expectedValue
      : null;

    normalizedParams[key.trim()] = { rawValue, isDynamic, expectedValue };
  }

  return { events: normalizedEvents, params: normalizedParams };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv);

  if (!args.input) {
    const err = JSON.stringify({ success: false, reason: '--input <parsed-json-file> is required' });
    process.stderr.write(err + '\n');
    process.exit(1);
  }

  if (!fs.existsSync(args.input)) {
    const err = JSON.stringify({ success: false, reason: `Input file not found: ${args.input}` });
    process.stderr.write(err + '\n');
    process.exit(1);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  } catch (e) {
    const err = JSON.stringify({ success: false, reason: `JSON parse error: ${e.message}` });
    process.stderr.write(err + '\n');
    process.exit(1);
  }

  // Handle parse-clickstream-sheet.js output format: { success, events, params }
  if (raw.success === false) {
    const err = JSON.stringify({ success: false, reason: `Upstream parse failed: ${raw.reason}` });
    process.stderr.write(err + '\n');
    process.exit(1);
  }

  const normalized = normalizeData(raw);

  // Ensure temp directory exists
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const output = JSON.stringify(normalized, null, 2);
  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');

  process.stdout.write(output + '\n');
  process.exit(0);
}

main();
