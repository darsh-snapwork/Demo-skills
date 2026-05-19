#!/usr/bin/env node
'use strict';

/**
 * compare-mappings.js
 * Compares a validate-clickstream.js audit JSON against the project reference sheet
 * and produces a structured diff report with recommended fixes.
 * Works with any project and any platform — static field values are derived
 * from the reference sheet, not hardcoded.
 *
 * Usage: node compare-mappings.js --audit <path> --reference <path> [--output json|markdown]
 *
 * Exit codes:
 *   0  No diffs — implementation matches reference sheet
 *   1  Diffs found
 *   2  Input error (missing required argument, file not found)
 *   3  Audit JSON or reference parse error
 */

const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------
const HELP_TEXT = `
Usage: node compare-mappings.js [options]

Options:
  --audit <path>        Path to audit JSON from validate-clickstream.js (required)
  --normalized <path>   Path to normalized-events.json (default: temp/normalized-events.json)
  --output <format>     Output format: json (default) | markdown
  --help                Show this help message

Exit codes:
  0  No diffs — implementation matches reference sheet
  1  Diffs found
  2  Input error (missing required argument, file not found)
  3  Audit JSON or normalized events parse error

Examples:
  node compare-mappings.js --audit audit.json
  node compare-mappings.js --audit audit.json --normalized path/to/normalized-events.json --output markdown
`.trim();

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { audit: null, normalized: null, output: 'json', help: false };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--help': args.help = true; break;
      case '--audit': args.audit = argv[++i]; break;
      case '--normalized': args.normalized = argv[++i]; break;
      case '--reference': args.normalized = argv[++i]; break; // legacy alias
      case '--output': args.output = argv[++i]; break;
      default:
        process.stderr.write(`Warning: Unknown argument "${argv[i]}" — ignored.\n`);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Normalized events loader
// Reads temp/normalized-events.json produced by normalize-events.js.
// Returns the params map: { KEY: { rawValue, isDynamic, expectedValue } }
// ---------------------------------------------------------------------------
function loadNormalizedEvents(normalizedPath) {
  let content;
  try {
    content = fs.readFileSync(normalizedPath, 'utf8');
  } catch (e) {
    process.stderr.write(`Error reading normalized events file: ${e.message}\n`);
    process.exit(3);
  }

  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    process.stderr.write(`Error parsing normalized events JSON: ${e.message}\n`);
    process.exit(3);
  }

  // Support both { params: {...} } and flat { KEY: { rawValue, ... } }
  const params = (data && typeof data.params === 'object') ? data.params : data;

  if (!params || Object.keys(params).length === 0) {
    process.stderr.write(`Error: No params found in normalized events file: ${normalizedPath}\n`);
    process.stderr.write('Run detect-clickstream-sheet.js → parse-clickstream-sheet.js → normalize-events.js first.\n');
    process.exit(3);
  }
  return params;
}

/**
 * Derive static field map from the parsed reference sheet.
 * Avoids all hardcoded project-specific values.
 */
function deriveStaticFields(refParams) {
  const staticFields = {};
  for (const [key, meta] of Object.entries(refParams)) {
    if (key !== 'EVENT_NAME' && !meta.isDynamic && meta.expectedValue) {
      staticFields[key] = meta.expectedValue;
    }
  }
  return staticFields;
}

// ---------------------------------------------------------------------------
// Load and validate audit JSON
// ---------------------------------------------------------------------------
function loadAuditJson(auditPath) {
  let content;
  try {
    content = fs.readFileSync(auditPath, 'utf8');
  } catch (e) {
    process.stderr.write(`Error reading audit file: ${e.message}\n`);
    process.exit(2);
  }
  try {
    const parsed = JSON.parse(content);
    if (!parsed.results || !Array.isArray(parsed.results)) {
      process.stderr.write('Error: Audit JSON must have a "results" array. Run validate-clickstream.js first.\n');
      process.exit(3);
    }
    return parsed;
  } catch (e) {
    process.stderr.write(`Error parsing audit JSON: ${e.message}\n`);
    process.exit(3);
  }
}

// ---------------------------------------------------------------------------
// Diff generation
// ---------------------------------------------------------------------------
function isAutoFixable(diffType, field, staticFields) {
  if (diffType === 'INCORRECT_VALUE' && staticFields[field] !== undefined) return true;
  if (diffType === 'MAPPING_ERROR') return true;
  if (diffType === 'MISSING' && staticFields[field] !== undefined) return true;
  return false;
}

function generateDiffs(auditData, refParams, staticFields) {
  const diffs = [];

  for (const result of auditData.results || []) {
    const component = result.component || 'Unknown';
    const componentFile = result.componentFile || '';
    const eventName = result.eventName || 'Unknown';
    const fileName = path.basename(componentFile);

    // --- MISSING parameters ---
    for (const param of result.missingParameters || []) {
      const staticExp = staticFields[param];
      const refEntry = refParams[param];
      const expected = staticExp || (refEntry ? 'dynamic value per reference sheet' : 'see reference sheet');
      diffs.push({
        component,
        componentFile,
        eventName,
        field: param,
        diffType: 'MISSING',
        observed: null,
        expected,
        recommendedFix: staticExp
          ? `Add ${param}: "${staticExp}" to event props in ${fileName}. Value is static — must match exactly.`
          : `Add ${param} to event props in ${fileName}. Use a null-safe fallback (e.g. value ?? "NA") for runtime value.`,
        autoFixable: staticExp !== undefined,
        referenceSource: 'client-clickstream-sheet.md',
      });
    }

    // --- INCORRECT_VALUE parameters ---
    for (const inc of result.incorrectParameters || []) {
      diffs.push({
        component,
        componentFile,
        eventName,
        field: inc.field,
        diffType: 'INCORRECT_VALUE',
        observed: inc.observed,
        expected: inc.expected,
        recommendedFix: `Change ${inc.field} from "${inc.observed}" to "${inc.expected}" in ${fileName}. Value is case-sensitive static — must match reference sheet exactly.`,
        autoFixable: true,
        referenceSource: 'client-clickstream-sheet.md',
      });
    }

    // --- NULL parameters ---
    for (const param of result.nullParameters || []) {
      const staticExp = staticFields[param];
      const expected = staticExp || 'non-null non-empty dynamic value';
      diffs.push({
        component,
        componentFile,
        eventName,
        field: param,
        diffType: 'NULL',
        observed: null,
        expected,
        recommendedFix: staticExp
          ? `Set ${param} to "${staticExp}" — it must not be null.`
          : `Replace null value with a null-safe fallback (e.g. value ?? "NA") in ${fileName}.`,
        autoFixable: staticExp !== undefined,
        referenceSource: 'client-clickstream-sheet.md',
      });
    }

    // --- EMPTY parameters ---
    for (const param of result.emptyParameters || []) {
      const staticExp = staticFields[param];
      const expected = staticExp || 'non-null non-empty dynamic value';
      diffs.push({
        component,
        componentFile,
        eventName,
        field: param,
        diffType: 'EMPTY',
        observed: '',
        expected,
        recommendedFix: staticExp
          ? `Set ${param} to "${staticExp}" — it must not be empty.`
          : `Replace empty string with a non-empty value in ${fileName}. Use a null-safe fallback (e.g. value ?? "NA").`,
        autoFixable: staticExp !== undefined,
        referenceSource: 'client-clickstream-sheet.md',
      });
    }

    // --- MAPPING issues ---
    for (const issue of result.mappingIssues || []) {
      const isUnknownEvent = issue.issue && issue.issue.includes('valid event name');
      diffs.push({
        component,
        componentFile,
        eventName,
        field: issue.field,
        diffType: isUnknownEvent ? 'UNKNOWN_EVENT' : 'MAPPING_ERROR',
        observed: issue.field,
        expected: isUnknownEvent ? '<PROJECT>_<SCREEN>_VIEWED or <PROJECT>_<SCREEN>_CLICKED' : (issue.field || '').toUpperCase(),
        recommendedFix: issue.issue,
        autoFixable: !isUnknownEvent,
        referenceSource: 'client-clickstream-sheet.md',
      });
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Markdown output formatter
// ---------------------------------------------------------------------------
function formatMarkdown(diffs, refPath) {
  const lines = [];

  lines.push('# Clickstream Mapping Diff Report');
  lines.push('');
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push(`**Total Diffs**: ${diffs.length}`);
  lines.push(`**Auto-Fixable**: ${diffs.filter(d => d.autoFixable).length}`);
  lines.push(`**Manual Review Required**: ${diffs.filter(d => !d.autoFixable).length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Group by component
  const byComponent = {};
  for (const d of diffs) {
    const key = d.component || 'Unknown';
    if (!byComponent[key]) byComponent[key] = [];
    byComponent[key].push(d);
  }

  for (const [comp, compDiffs] of Object.entries(byComponent)) {
    lines.push(`## ${comp}`);
    lines.push('');
    lines.push('| Diff Type | Field | Observed | Expected | Auto-Fixable |');
    lines.push('|---|---|---|---|---|');
    for (const d of compDiffs) {
      const observed = d.observed === null ? '*(absent)*' : d.observed === '' ? '*(empty)*' : `\`${d.observed}\``;
      const expected = d.expected ? `\`${d.expected}\`` : '*(see reference)*';
      lines.push(`| ${d.diffType} | \`${d.field}\` | ${observed} | ${expected} | ${d.autoFixable ? 'Yes' : 'No'} |`);
    }
    lines.push('');

    lines.push('### Recommended Fixes');
    lines.push('');
    for (const d of compDiffs) {
      lines.push(`- **[${d.diffType}]** \`${d.field}\`: ${d.recommendedFix}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Summary table
  const autoFixable = diffs.filter(d => d.autoFixable).length;
  const manualReview = diffs.filter(d => !d.autoFixable).length;
  const byType = {};
  for (const d of diffs) {
    byType[d.diffType] = (byType[d.diffType] || 0) + 1;
  }

  lines.push('## Compliance Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Total Diffs | ${diffs.length} |`);
  lines.push(`| Auto-Fixable | ${autoFixable} |`);
  lines.push(`| Manual Review Required | ${manualReview} |`);
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|---|---|');
  for (const [type, count] of Object.entries(byType)) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push(`*Reference: \`${refPath}\`*`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    process.stdout.write(HELP_TEXT + '\n');
    process.exit(0);
  }

  if (!args.audit) {
    process.stderr.write('Error: --audit <path> is required.\n\n' + HELP_TEXT + '\n');
    process.exit(2);
  }

  if (!fs.existsSync(args.audit)) {
    process.stderr.write(`Error: Audit file not found: ${args.audit}\n`);
    process.exit(2);
  }

  // Resolve normalized events path — defaults to temp/normalized-events.json
  const normalizedPath = args.normalized
    ? path.resolve(args.normalized)
    : path.join(SKILL_DIR, 'temp', 'normalized-events.json');

  if (!fs.existsSync(normalizedPath)) {
    process.stderr.write(`Error: Normalized events file not found: ${normalizedPath}\n`);
    process.stderr.write('Run the ingestion pipeline first:\n');
    process.stderr.write('  node scripts/detect-clickstream-sheet.js > detect.json\n');
    process.stderr.write('  node scripts/parse-clickstream-sheet.js --path <sheet> > parse.json\n');
    process.stderr.write('  node scripts/normalize-events.js --input parse.json\n');
    process.exit(2);
  }

  if (args.output !== 'json' && args.output !== 'markdown') {
    process.stderr.write(`Error: --output must be "json" or "markdown". Got: "${args.output}"\n`);
    process.exit(2);
  }

  const auditData = loadAuditJson(args.audit);
  const refParams = loadNormalizedEvents(normalizedPath);
  const staticFields = deriveStaticFields(refParams);
  const diffs = generateDiffs(auditData, refParams, staticFields);

  const autoFixableCount = diffs.filter(d => d.autoFixable).length;
  const manualReviewCount = diffs.filter(d => !d.autoFixable).length;

  if (args.output === 'markdown') {
    process.stdout.write(formatMarkdown(diffs, normalizedPath) + '\n');
  } else {
    const output = {
      diffTimestamp: new Date().toISOString(),
      normalizedEventsFile: normalizedPath,
      auditFile: path.resolve(args.audit),
      totalDiffs: diffs.length,
      autoFixableCount,
      manualReviewCount,
      diffs,
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  }

  process.exit(diffs.length > 0 ? 1 : 0);
}

main();
