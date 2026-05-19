#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');

const HELP = `
Usage: node validate-clickstream.js [options]
  --file <path>       Single source file to audit
  --dir <path>        Directory to scan recursively
  --normalized <path> Normalized events JSON (default: temp/normalized-events.json)
  --platform <name>   angular|react|react-native|vue|android|ios|flutter (default: angular)
  --dispatch <name>   Override dispatch method name
  --help              Show this help

Exit codes: 0=PASS  1=violations  2=input error  3=parse error`.trim();

const PLATFORM_CFG = {
  angular:        { exts: ['.ts'],                        excludeSuffixes: ['.spec.ts', '.d.ts'],                    dispatch: 'sendClickstream' },
  react:          { exts: ['.ts', '.tsx', '.js', '.jsx'], excludeSuffixes: ['.test.ts', '.spec.ts', '.stories.tsx'], dispatch: 'trackEvent' },
  // react-native: no single universal dispatch — always pass --dispatch explicitly.
  // Common values: 'sendAnalyticsEvent' (custom service), 'CleverTap.recordEvent' (clevertap-react-native),
  //                'analytics().logEvent' (@react-native-firebase/analytics)
  'react-native': { exts: ['.ts', '.tsx', '.js', '.jsx'], excludeSuffixes: ['.test.ts', '.spec.ts'],                 dispatch: 'sendAnalyticsEvent' },
  vue:            { exts: ['.ts', '.vue', '.js'],         excludeSuffixes: ['.spec.ts', '.test.ts'],                 dispatch: 'trackEvent' },
  android:        { exts: ['.kt', '.java'],               excludeSuffixes: ['Test.kt', 'Test.java'],                 dispatch: 'pushEvent' },
  ios:            { exts: ['.swift', '.m'],               excludeSuffixes: ['Tests.swift', 'Spec.swift'],            dispatch: 'recordEvent' },
  flutter:        { exts: ['.dart'],                      excludeSuffixes: ['_test.dart'],                           dispatch: 'recordEvent' },
};

function loadSdkConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'assets', 'sdk-detection.json'), 'utf8')); }
  catch { return {}; }
}

function extractMethodName(pat) {
  const m = String(pat || '').match(/^([\w.]+)\s*\(/);
  return m ? m[1] : null;
}

function detectDispatchMethod(projectDir, sdkCfg, platform) {
  let dir = path.resolve(projectDir);
  for (let i = 0; i < 5; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const { dependencies = {}, devDependencies = {} } = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const all = { ...dependencies, ...devDependencies };
        const isRN = platform === 'react-native';
        for (const sdk of Object.values(sdkCfg)) {
          // For React Native: prefer rnPackages + rnDispatchPattern
          if (isRN && sdk.rnPackages && sdk.rnPackages.length) {
            if (sdk.rnPackages.some(p => all[p])) return extractMethodName(sdk.rnDispatchPattern || sdk.dispatchPattern);
          }
          // For other platforms (or RN fallback): use web packages + dispatchPattern
          if ((sdk.packages || []).some(p => all[p])) return extractMethodName(sdk.dispatchPattern);
        }
      } catch { /* ignore */ }
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function parseArgs(argv) {
  const a = { file: null, dir: null, normalized: null, platform: 'angular', dispatch: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    if      (argv[i] === '--help')                                    a.help = true;
    else if (argv[i] === '--file')                                    a.file = argv[++i];
    else if (argv[i] === '--dir')                                     a.dir = argv[++i];
    else if (argv[i] === '--normalized' || argv[i] === '--reference') a.normalized = argv[++i];
    else if (argv[i] === '--platform')                                a.platform = argv[++i];
    else if (argv[i] === '--dispatch')                                a.dispatch = argv[++i];
    else process.stderr.write(`Warning: Unknown argument "${argv[i]}" — ignored.\n`);
  }
  return a;
}

function loadNormalizedEvents(filePath) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch (e) { process.stderr.write(`Error reading normalized events file: ${e.message}\n`); process.exit(3); }
  let data;
  try { data = JSON.parse(content); }
  catch (e) { process.stderr.write(`Error parsing normalized events JSON: ${e.message}\n`); process.exit(3); }
  const params = (data && typeof data.params === 'object') ? data.params : data;
  if (!params || !Object.keys(params).length) {
    process.stderr.write(`Error: No params found in ${filePath}\nRun the ingestion pipeline first.\n`);
    process.exit(3);
  }
  return params;
}

function deriveStaticFields(refParams) {
  const s = {};
  for (const [k, v] of Object.entries(refParams))
    if (k !== 'EVENT_NAME' && !v.isDynamic && v.expectedValue) s[k] = v.expectedValue;
  return s;
}

function extractPropsFromBlock(block, keyLookup) {
  const result = { keys: new Set(), staticValues: {}, nullFields: new Set(), emptyFields: new Set(), mappingIssues: [] };
  const seen = new Set();
  const resolve = k => keyLookup.get(k) || keyLookup.get(k.toLowerCase());
  const record = k => {
    const rk = resolve(k);
    if (!rk) return null;
    result.keys.add(rk);
    if (k !== rk && k.toLowerCase() === rk.toLowerCase()) {
      const id = `${k}->${rk}`;
      if (!seen.has(id)) { seen.add(id); result.mappingIssues.push({ observed: k, expected: rk }); }
    }
    return rk;
  };
  const RE = {
    key:   /['"]?([A-Za-z][A-Za-z0-9_]*)['"]?\s*(?::|to\s|=>)/g,
    val:   /['"]?([A-Za-z][A-Za-z0-9_]*)['"]?\s*(?::|to\s|=>)\s*['"]([^'"]*)['"]/g,
    null_: /['"]?([A-Za-z][A-Za-z0-9_]*)['"]?\s*(?::|to\s|=>)\s*(null|undefined|nil)\b/g,
    empty: /['"]?([A-Za-z][A-Za-z0-9_]*)['"]?\s*(?::|to\s|=>)\s*(['"])\2/g,
  };
  let m;
  while ((m = RE.key.exec(block))   !== null) record(m[1]);
  while ((m = RE.val.exec(block))   !== null) { const rk = record(m[1]); if (rk) result.staticValues[rk] = m[2]; }
  while ((m = RE.null_.exec(block)) !== null) { const rk = record(m[1]); if (rk) result.nullFields.add(rk); }
  while ((m = RE.empty.exec(block)) !== null) { const rk = record(m[1]); if (rk) result.emptyFields.add(rk); }
  return result;
}

function extractBaseProps(source, keyLookup) {
  const am = source.match(/const\s+baseProps\s*=\s*\{([\s\S]*?)\};/);
  if (am) return extractPropsFromBlock(am[1], keyLookup);
  const gm = source.match(/(?:const|val|var|let)\s+\w*(?:[Pp]rops|[Pp]arams|[Ee]ventProps|[Pp]roperties|[Pp]ayload)\s*[=:]\s*[\[{]([\s\S]*?)[\]}]/i);
  return extractPropsFromBlock(gm ? gm[1] : source, keyLookup);
}

function extractCallSites(source, dispatchMethod, keyLookup) {
  const calls = [];
  const esc = dispatchMethod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${esc}\\s*\\(\\s*(?:\\w+:\\s*)?['"` + '`' + `]([^'"` + '`' + `]+)['"` + '`' + `]`, 'g');
  let m;
  while ((m = re.exec(source)) !== null) {
    const lineNum = source.substring(0, m.index).split('\n').length;
    const pm = source.substring(m.index, m.index + 400).match(/\{([^}]*)\}/);
    const ap = pm ? extractPropsFromBlock(pm[1], keyLookup)
                  : { keys: new Set(), staticValues: {}, nullFields: new Set(), emptyFields: new Set(), mappingIssues: [] };
    calls.push({ eventName: m[1], addKeys: ap.keys, addStaticValues: ap.staticValues,
                 addNullFields: ap.nullFields, addEmptyFields: ap.emptyFields,
                 mappingIssues: ap.mappingIssues, lineNum });
  }
  return calls;
}

function validateComponent(filePath, refParams, staticFields, dispatchMethod) {
  let source;
  try { source = fs.readFileSync(filePath, 'utf8'); } catch { return null; }

  const allRefKeys = Object.keys(refParams).filter(k => k !== 'EVENT_NAME');
  const keyLookup = new Map();
  for (const k of allRefKeys) { keyLookup.set(k, k); keyLookup.set(k.toLowerCase(), k); }
  if (!allRefKeys.some(k => source.includes(k) || source.includes(k.toLowerCase())) && !source.includes(dispatchMethod)) return null;

  const baseProps = extractBaseProps(source, keyLookup);
  const callSites = extractCallSites(source, dispatchMethod, keyLookup);
  if (!callSites.length) return null;

  const componentName = deriveComponentName(filePath);
  const eventTypeKey = allRefKeys.find(k => /event_type$/i.test(k));
  const results = [];

  for (const call of callSites) {
    const findings = [];
    const allKeys   = new Set([...baseProps.keys,        ...call.addKeys]);
    const allStatic = { ...baseProps.staticValues,       ...call.addStaticValues };
    const allNull   = new Set([...baseProps.nullFields,  ...call.addNullFields]);
    const allEmpty  = new Set([...baseProps.emptyFields, ...call.addEmptyFields]);

    // MISSING
    for (const rk of allRefKeys) {
      if (allKeys.has(rk)) continue;
      const exp = staticFields[rk];
      findings.push({ cat: 'MISSING', id: rk, obs: null,
        exp: exp || 'non-null non-empty dynamic value',
        fix: `Add ${rk} to event props.${exp ? ` Set value to "${exp}".` : ' Use a null-safe fallback (e.g. value ?? "NA") for dynamic runtime value.'} Reference: reference sheet.`,
        auto: exp !== undefined });
    }

    // NULL + EMPTY (unified)
    for (const [fields, cat, obs, verb] of [
      [allNull,  'NULL',  null, 'is set to null/undefined/nil'],
      [allEmpty, 'EMPTY', '',   'is an empty string'],
    ]) {
      for (const f of fields) {
        if (!allRefKeys.includes(f)) continue;
        const exp = staticFields[f];
        findings.push({ cat, id: f, obs,
          exp: exp || 'non-null non-empty dynamic value',
          fix: `${f} ${verb}. ${exp ? `Set to "${exp}".` : 'Use a null-safe fallback (e.g. value ?? "NA") pattern.'} Reference: reference sheet.`,
          auto: exp !== undefined });
      }
    }

    // INCORRECT_VALUE (static fields)
    for (const [field, ev] of Object.entries(staticFields)) {
      if (allStatic[field] !== undefined && allStatic[field] !== ev)
        findings.push({ cat: 'INCORRECT_VALUE', id: field, obs: allStatic[field], exp: ev,
          fix: `Change ${field} from "${allStatic[field]}" to "${ev}" (case-sensitive match required). Reference: reference sheet.`,
          auto: true });
    }

    // INCORRECT_VALUE (event type)
    if (eventTypeKey && allStatic[eventTypeKey] !== undefined) {
      const ev = (call.eventName.includes('VIEWED') || call.eventName.includes('LOADED')) ? 'view' : 'click';
      if (allStatic[eventTypeKey] !== ev)
        findings.push({ cat: 'INCORRECT_VALUE', id: eventTypeKey, obs: allStatic[eventTypeKey], exp: ev,
          fix: `Change ${eventTypeKey} to "${ev}" for event "${call.eventName}". Reference: reference sheet.`,
          auto: true });
    }

    // MAPPING_ERROR
    for (const mi of [...baseProps.mappingIssues, ...call.mappingIssues]) {
      if (mi.observed === mi.expected) continue;
      findings.push({ cat: 'MAPPING_ERROR', id: mi.observed, obs: mi.observed, exp: mi.expected,
        fix: `Rename "${mi.observed}" to "${mi.expected}" — payload key casing must match the reference sheet exactly. Reference: naming-conventions.md`,
        auto: true });
    }

    const hasFail = findings.length > 0;
    const finalStatus = hasFail ? (findings.every(f => f.auto) ? 'FAIL' : 'MANUAL_REVIEW') : 'PASS';
    results.push({
      component: componentName, componentFile: filePath,
      eventName: call.eventName, callLine: call.lineNum,
      validationStatus: finalStatus,
      missingParameters:   findings.filter(f => f.cat === 'MISSING').map(f => f.id),
      incorrectParameters: findings.filter(f => f.cat === 'INCORRECT_VALUE').map(f => ({ field: f.id, observed: f.obs, expected: f.exp })),
      nullParameters:      findings.filter(f => f.cat === 'NULL').map(f => f.id),
      emptyParameters:     findings.filter(f => f.cat === 'EMPTY').map(f => f.id),
      mappingIssues:       findings.filter(f => f.cat === 'MAPPING_ERROR' || f.cat === 'UNKNOWN_EVENT').map(f => ({ field: f.id, issue: f.fix })),
      recommendedFixes:    findings.map(f => f.fix),
      finalComplianceStatus: finalStatus,
    });
  }
  return results;
}

function deriveComponentName(filePath) {
  return path.basename(filePath, path.extname(filePath))
    .replace(/\.(component|screen|page|view|widget|fragment|activity)$/, '')
    .split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function collectSourceFiles(dir, cfg) {
  const files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...collectSourceFiles(fp, cfg));
    else if (e.isFile() && cfg.exts.some(x => e.name.endsWith(x)) && !cfg.excludeSuffixes.some(s => e.name.includes(s)))
      files.push(fp);
  }
  return files;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { process.stdout.write(HELP + '\n'); process.exit(0); }
  if (!args.file && !args.dir) { process.stderr.write(`Error: --file or --dir is required.\n\n${HELP}\n`); process.exit(2); }

  const normalizedPath = args.normalized
    ? path.resolve(args.normalized)
    : path.join(SKILL_DIR, 'temp', 'normalized-events.json');

  if (!fs.existsSync(normalizedPath)) {
    process.stderr.write(`Error: Normalized events file not found: ${normalizedPath}\nRun: detect-clickstream-sheet.js -> parse-clickstream-sheet.js -> normalize-events.js\n`);
    process.exit(2);
  }

  const platformCfg = PLATFORM_CFG[args.platform] || PLATFORM_CFG.angular;
  const sdkCfg = loadSdkConfig();
  const targetDir = args.dir ? path.resolve(args.dir) : path.dirname(path.resolve(args.file));
  const dispatchMethod = args.dispatch || detectDispatchMethod(targetDir, sdkCfg, args.platform) || platformCfg.dispatch;

  let filesToAudit;
  if (args.file) {
    if (!fs.existsSync(args.file)) { process.stderr.write(`Error: File not found: ${args.file}\n`); process.exit(2); }
    filesToAudit = [path.resolve(args.file)];
  } else {
    if (!fs.existsSync(args.dir)) { process.stderr.write(`Error: Directory not found: ${args.dir}\n`); process.exit(2); }
    filesToAudit = collectSourceFiles(path.resolve(args.dir), platformCfg);
  }

  const refParams = loadNormalizedEvents(normalizedPath);
  const staticFields = deriveStaticFields(refParams);
  const allResults = [];
  for (const fp of filesToAudit) {
    const r = validateComponent(fp, refParams, staticFields, dispatchMethod);
    if (r && r.length) allResults.push(...r);
  }

  const cats = { MISSING: 0, NULL: 0, EMPTY: 0, INCORRECT_VALUE: 0, MAPPING_ERROR: 0, UNKNOWN_EVENT: 0 };
  const summary = {
    totalComponents:   new Set(allResults.map(r => r.componentFile)).size,
    compliantCount:    allResults.filter(r => r.finalComplianceStatus === 'PASS').length,
    failCount:         allResults.filter(r => r.finalComplianceStatus === 'FAIL').length,
    manualReviewCount: allResults.filter(r => r.finalComplianceStatus === 'MANUAL_REVIEW').length,
    totalFindings: 0,
    findingsByCategory: cats,
  };
  for (const r of allResults) {
    summary.totalFindings += r.missingParameters.length + r.incorrectParameters.length + r.nullParameters.length + r.emptyParameters.length + r.mappingIssues.length;
    cats.MISSING         += r.missingParameters.length;
    cats.INCORRECT_VALUE += r.incorrectParameters.length;
    cats.NULL            += r.nullParameters.length;
    cats.EMPTY           += r.emptyParameters.length;
    cats.MAPPING_ERROR   += r.mappingIssues.length;
  }

  process.stdout.write(JSON.stringify({
    auditTimestamp: new Date().toISOString(),
    platform: args.platform, dispatchMethod,
    normalizedEventsFile: normalizedPath,
    results: allResults, summary,
  }, null, 2) + '\n');
  process.exit((summary.failCount > 0 || summary.manualReviewCount > 0) ? 1 : 0);
}

main();