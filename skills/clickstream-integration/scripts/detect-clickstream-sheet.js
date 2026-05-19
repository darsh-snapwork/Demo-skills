#!/usr/bin/env node
'use strict';

/**
 * detect-clickstream-sheet.js
 * Detects clickstream definition files from the project.
 *
 * Reads:  assets/clickstream-config.json
 * Searches configured folders recursively for supported files.
 * Respects configured priority order.
 *
 * Output (stdout — machine-readable JSON):
 *   { "found": true, "path": "analytics/clickstream-events.xlsx", "extension": ".xlsx" }
 *   { "found": false }
 *
 * Does NOT: parse files, validate events, normalize data, or modify source code.
 */

const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(SKILL_DIR, 'assets', 'clickstream-config.json');

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    process.stderr.write(`Error reading clickstream-config.json: ${e.message}\n`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Recursive directory search
// ---------------------------------------------------------------------------
function searchRecursively(dir, filename) {
  if (!fs.existsSync(dir)) return null;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = searchRecursively(fullPath, filename);
      if (found) return found;
    } else if (entry.isFile() && entry.name === filename) {
      return fullPath;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const config = loadConfig();
  const { searchLocations = [], supportedFiles = [], priorityOrder = [] } = config;
  const workspaceRoot = process.cwd();

  // Iterate priority order: try each extension, each location
  for (const ext of priorityOrder) {
    const targets = supportedFiles.filter(f => path.extname(f) === ext);
    for (const filename of targets) {
      // Check workspace root itself first
      const rootCandidate = path.join(workspaceRoot, filename);
      if (fs.existsSync(rootCandidate)) {
        process.stdout.write(JSON.stringify({
          found: true,
          path: filename,
          extension: ext
        }, null, 2) + '\n');
        process.exit(0);
      }
      // Search configured locations
      for (const location of searchLocations) {
        const searchDir = path.join(workspaceRoot, location);
        const found = searchRecursively(searchDir, filename);
        if (found) {
          const rel = path.relative(workspaceRoot, found).replace(/\\/g, '/');
          process.stdout.write(JSON.stringify({
            found: true,
            path: rel,
            extension: ext
          }, null, 2) + '\n');
          process.exit(0);
        }
      }
    }
  }

  process.stdout.write(JSON.stringify({ found: false }) + '\n');
  process.exit(0);
}

main();
