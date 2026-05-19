# Clickstream Integration Skill

> **Version:** 2.0.0 | **Platforms:** Angular · React · Vue · Android · iOS · Flutter · React Native

Validates and implements clickstream/analytics events across any platform. Reads the project's clickstream definition sheet, normalizes it to deterministic JSON, then audits or fixes every analytics dispatch call site to 100% compliance.

---

## Folder Structure

```
clickstream-integration/
├── SKILL.md                             # Orchestration only — workflow entry point
├── assets/
│   ├── clickstream-config.json          # Definition file search paths and priority
│   ├── parser-config.json               # Parser dependency config per sheet format
│   ├── sdk-detection.json               # Analytics SDK package/signal detection rules
│   ├── sdk-installation-skills.json     # Maps SDKs to dedicated installation skills
│   ├── platform-detection.json          # Platform detection by file extension
│   ├── execution-flow.md                # Mandatory step-by-step gate sequence
│   ├── audit-template.md                # Post-execution summary output format
│   ├── fix-rules.md                     # Fix mode behavior rules
│   ├── event-mapping-rules.md           # Event name → event type derivation rules
│   ├── naming-conventions.md            # Parameter key casing and format rules
│   └── null-validation-rules.md         # NULL/EMPTY detection rules per platform
├── scripts/
│   ├── detect-clickstream-sheet.js      # Finds definition file in configured locations
│   ├── parse-clickstream-sheet.js       # Extracts events and params from sheet
│   ├── normalize-events.js              # Writes temp/normalized-events.json
│   ├── validate-clickstream.js          # Audits source files against normalized events
│   └── compare-mappings.js              # Diffs audit output against normalized events
├── references/
│   ├── angular-clickstream-reference.md
│   ├── react-clickstream-reference.md
│   ├── react-native-clickstream-reference.md
│   ├── android-clickstream-reference.md
│   ├── ios-clickstream-reference.md
│   └── flutter-clickstream-reference.md
└── temp/                                # Runtime artifacts (gitignored)
    └── normalized-events.json
```

---

## High-Level Execution Flow

```
Check existing implementation
        ↓
Load definition sheet → Parse → Normalize → temp/normalized-events.json
        ↓
Detect platform → load platform reference file
        ↓
Detect / confirm analytics SDK
        ↓
SDK installed? ──YES──▶ continue
               ──NO───▶ check sdk-installation-skills.json
                              │ skill available → delegate to installation skill
                              │ no skill        → ask user for setup steps
        ↓
Exhaustive component inventory → Coverage Table
        ↓
Audit: validate-clickstream.js → audit-result.json
        ↓ (fix mode only)
Fix non-compliant call sites → Revalidate
        ↓
Report in chat
```

Full gate sequence: `assets/execution-flow.md`

---

## How To Use This Skill

This skill is designed to automatically validate and implement clickstream/analytics events in any supported project.

### Step 1 — Add Your Clickstream Definition File
Place your clickstream event sheet anywhere in the project using the standard naming convention:

Supported formats:
- `clickstream-events.md`
- `clickstream-events.xlsx`
- `clickstream-events.csv`
- `clickstream-events.json`
- `clickstream-events.pdf`
- `clickstream-events.pptx`
- `clickstream-events.ppt` (conversion required — not parsed directly)

Recommended locations:
- `clickstream/`
- `analytics/`
- `src/assets/clickstream/`
- `docs/clickstream/`

---

### Step 2 — Run the Skill
Attach the project or trigger the skill normally.

The skill will automatically:

1. Search for the clickstream definition file
2. Parse the file
3. Normalize all events
4. Detect project platform
5. Detect existing analytics SDK
6. Validate current implementation
7. Compare existing mappings
8. Fix missing or invalid events (Fix Mode)
9. Generate final audit report

---

### Step 3 — If SDK Already Exists
If your project already contains:
- CleverTap
- GA4
- Existing analytics wrapper

Then the skill will reuse it safely.

---

### Step 4 — If SDK Does NOT Exist
The skill will:

1. Ask you to select an analytics SDK
2. Check for dedicated SDK installation skill
3. If installation skill exists:
   - Trigger installation skill automatically
4. If installation skill does NOT exist:
   - Ask you to provide SDK setup/install steps

---

### Step 5 — Review Final Output
You will receive:
- Coverage table
- Missing event report
- Validation summary
- Mapping comparison
- Fix summary
- Compliance percentage

---

## Important Rules

- Do NOT manually upload event sheet if it already exists in project
- Do NOT create new analytics architecture manually
- Existing SDKs are always reused
- SDK absence blocks implementation until setup is completed
- The event sheet is always the source of truth

---

## Best Practice

For best results:
- Use `.xlsx` or `.json` format
- Keep event definitions structured
- Maintain consistent event naming
- Ensure SDK installation before fix mode

---

## Format Guidance

### PDF
- Text-based PDFs only — scanned or image-only PDFs are not supported.
- Structured tables with clearly separated columns are required.
- If parsing confidence is low, the skill stops and requests a structured format.
- Recommended: export your event sheet to `.xlsx`, `.csv`, or `.json` for maximum reliability.

### PPTX
- Structured table slides only — visual-only or screenshot decks are not supported.
- Event tables with header rows and data rows are required.
- If parsing confidence is low, the skill stops and requests a structured format.
- Recommended: copy event table data into `.xlsx` or `.csv` for maximum reliability.

### PPT
- Legacy `.ppt` files are not directly supported.
- Convert to `.pptx`, `.pdf`, `.xlsx`, `.csv`, or `.json` before use.
- The skill will output a conversion request and stop if a `.ppt` file is detected.

---

## Asset Responsibilities

| Asset | Responsibility |
|---|---|
| `clickstream-config.json` | Search paths and file-type priority for definition sheet auto-detection |
| `parser-config.json` | Dependencies required per sheet format (xlsx, csv-parse) |
| `sdk-detection.json` | Package names and source signals for detecting installed analytics SDKs |
| `sdk-installation-skills.json` | Maps SDK keys to dedicated installation skill names |
| `platform-detection.json` | Maps file extensions to platform identifiers |
| `execution-flow.md` | Mandatory workflow gate sequence — single source of truth for execution order |
| `audit-template.md` | Post-execution chat summary and Coverage Table output format |
| `fix-rules.md` | What may and may not be modified in fix mode |
| `event-mapping-rules.md` | How event name suffixes derive event type values |
| `naming-conventions.md` | Expected parameter key casing and format rules |
| `null-validation-rules.md` | NULL and EMPTY detection patterns per platform |

---

## Script Responsibilities

| Script | Input | Output | Exit codes |
|---|---|---|---|
| `detect-clickstream-sheet.js` | Project root | `{ found, path, extension }` | — |
| `parse-clickstream-sheet.js` | Sheet path (`.json` `.md` `.csv` `.xlsx` `.pdf` `.pptx`) | `{ events[], params{} }` or `{ success: false, reason }` | 0=ok · 1=fail |
| `normalize-events.js` | Parse output | `temp/normalized-events.json` | — |
| `validate-clickstream.js` | Source dir + normalized events | Audit JSON | 0=PASS · 1=violations · 2=input error · 3=parse error |
| `compare-mappings.js` | Audit JSON + normalized events | Diff report | 0=no diffs · 1=diffs found |

---

## Reference Responsibilities

Each file under `references/` contains **platform-specific implementation guidance only**:
- Loaded when the detected platform matches the file.
- Defines mandatory implementation gates for that platform: component classification, service injection, null-safety, and dispatch patterns.
- Does **not** contain orchestration logic (`execution-flow.md`), SDK detection rules (`sdk-detection.json`), or sheet parsing logic.

---

## temp/ Runtime Artifacts

`temp/normalized-events.json` is generated by `normalize-events.js` during the ingestion pipeline. It is the canonical parameter map consumed by `validate-clickstream.js` and `compare-mappings.js`. Re-run the pipeline whenever the definition sheet changes.

---

## Architecture Principles

1. **SKILL.md is orchestration only** — references assets and delegates; never implements directly.
2. **Single responsibility** — each asset, script, and reference file has exactly one job.
3. **Platform isolation** — reference files contain only platform-specific rules; cross-platform logic lives in assets.
4. **Config-driven** — SDK names, paths, and detection rules live in JSON assets, never hardcoded in SKILL.md.
5. **SDK installation delegation** — this skill never installs SDKs directly; delegates to named installation skills or asks the user.
6. **Non-destructive** — compliant existing implementations are never overwritten.
7. **Sheet is source of truth** — parameter keys, casing, static values, and event names are always read from the definition sheet at runtime.