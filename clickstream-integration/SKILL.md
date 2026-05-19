---
name: clickstream-integration
description:
  Validates and implements clickstream/analytics events across any platform.
  Auto-detects clickstream definition files (.json, .xlsx, .csv, .md, .pdf, .pptx, .ppt) from the project,
  normalizes them, then audits or fixes every dispatch call site to 100% compliance.
  Only asks for manual upload if no definition file is found.
version: 2.0.0
user-invocable: true
---

# Purpose

Auto-detect the project's clickstream definition file, normalize it into deterministic JSON, then scan the project and audit or fix every analytics dispatch call site to 100% compliance. Parameter key naming is always read from the definition file — never assumed.

---

# When to Trigger

* analytics events need implementing, validating, or fixing
* client has provided a requirement sheet with event names and analytics parameters (e.g. `EP_*`, `event_*`, `analytics_*`)
* sprint-end analytics compliance review is required
* QA has reported clickstream tracking defects

---

# Inputs

| Input | Required | Description |
|---|---|---|
| Mode | yes | `audit` (detect only) \| `fix` (detect + correct) |
| Project root | optional | Defaults to workspace root |
| Platform | optional | Auto-detected from file extensions if omitted |
| Dispatch method | optional | Override if project uses a custom analytics function name (e.g. `trackEvent`, `logEvent`) |

> **Clickstream sheet**: Auto-detected from the project using `detect-clickstream-sheet.js`. Only ask the user to upload manually if auto-detection fails (no configured file found).

---

# Clickstream Definition Detection

Load:
- assets/clickstream-config.json
- assets/parser-config.json

Use:
- scripts/detect-clickstream-sheet.js
- scripts/parse-clickstream-sheet.js
- scripts/normalize-events.js

Rules:
- auto-detect clickstream definition files from configured search locations
- support json/xlsx/csv/md/pdf/pptx formats; ppt triggers conversion request
- normalize all formats into deterministic JSON at temp/normalized-events.json
- ask user to upload sheet ONLY if no configured file exists
- install parser dependencies automatically if missing (xlsx, csv-parse, pdf-parse, officeparser)
- detection uses priority order from assets/clickstream-config.json

**Supported clickstream definition formats:**
- `.json`
- `.xlsx`
- `.csv`
- `.md`
- `.pdf` (text-based PDFs only; structured tables required)
- `.pptx` (structured table slides only)
- `.ppt` (fallback: conversion required — not parsed directly)

**PDF / PPTX parsing safety rules:**
If PDF or PPTX parsing confidence is low (extracted text too short, or no structured table patterns found):
- stop the ingestion pipeline immediately
- do NOT continue to validation, comparison, fix, or reporting steps
- output the low-confidence reason to the user
- request that the user provide a structured format (.xlsx, .csv, .json) before proceeding

**PPT fallback rule:**
Legacy `.ppt` files are not directly supported.
When a `.ppt` file is detected, immediately output:
> "Legacy .ppt files are not deterministically supported. Please convert to .pptx, .pdf, .xlsx, .csv, or .json."
Do not attempt to parse, validate, or fix until the user provides a supported format.

---

# How It Works

0. **Check existing implementation** — before anything else, search all non-spec source files for existing analytics dispatch calls.
   - **Already implemented (YES)**: Note which SDK/service/method is in use. Run the ingestion pipeline (steps 1–3 below), then execute step 4 (detect platform + load platform reference file) and the Platform Reference Enforcement Gate (all mandatory gates in the loaded platform reference file — in order), then jump directly to step 7 (Audit). Skip step 5 only — analytics tool detection is not needed because the tool is already confirmed from the existing code.
   - **Not implemented (NO)**: **STOP. Present the SDK Selection Menu (see Supported Analytics Tools section) to the user before proceeding.** Ask the user to choose which SDK they want to use. Wait for their explicit choice.

1. **Detect** — run `detect-clickstream-sheet.js` to find the definition file in the project.
   - Found: proceed to step 2.
   - Not found: ask user to upload their clickstream sheet. Do NOT proceed without it.
2. **Parse** — run `parse-clickstream-sheet.js --path <detected-file>` to extract events and params.
3. **Normalize** — run `normalize-events.js --input <parse-output>` to write `temp/normalized-events.json`.
4. **Detect platform** — detect using `assets/platform-detection.json`. Load the matching platform reference file and read it fully.
5. **Detect analytics tool** — scan `package.json` and source files using `assets/sdk-detection.json`. Always present the SDK Selection Menu and wait for explicit user choice before writing any code.
6. **Review existing implementation** — search the entire project for existing dispatch calls before making any changes. Preserve all valid existing implementations.
7. **Audit** — run `validate-clickstream.js` against `temp/normalized-events.json`.
8. **Fix** (fix mode only) — apply only the changes required; do not overwrite compliant code.
9. **Report** — output comprehensive summary in chat.

---

# Scripts

Pipeline commands, script signatures, and exit codes are in `assets/execution-flow.md`.

Run the ingestion pipeline (detect → parse → normalize) **before** every audit or fix step.

---

# Execution Flow

Follow the step-by-step flow defined in `assets/execution-flow.md` — every step and gate is mandatory. Do not skip or reorder steps. Always run the ingestion pipeline before validation. Always present the SDK Selection Menu if no existing implementation is found, and wait for the user’s explicit choice before proceeding.

---

# Analytics SDK Detection

Load:
- assets/sdk-detection.json
- assets/sdk-installation-skills.json

Rules:
- detect installed SDKs using configured package names
- detect dispatch patterns using configured source signals
- SDK dispatch method is auto-detected from package.json via sdk-detection.json; platform default is fallback
- always ask the user to confirm the SDK before implementation
- lock the selected dispatch method before modifying code
> **If the user's tool is not in this list**, ask for the package name and dispatch method before proceeding. Record both and use them as the locked pattern.

---

# SDK Installation Delegation

Load:
- assets/sdk-installation-skills.json

Rules:
- this skill must NOT install SDKs directly
- when a selected SDK is not yet installed, look up its key in `assets/sdk-installation-skills.json`
- if a matching `installationSkill` entry exists and that skill is present in `.github/skills/`: delegate to it and wait for completion
- if no installation skill is available: ask the user to provide the installation/setup steps; use only the steps they provide before continuing integration
- preserve all existing validation, comparison, normalization, and fixing flows unchanged

---

# SDK Presence Enforcement

Analytics SDK absence is a **hard blocking condition**.

If no analytics SDK or analytics wrapper exists in the project:
- do NOT generate a new analytics service
- do NOT generate a new clickstream wrapper
- do NOT create Router-based screen tracking
- do NOT create analytics infrastructure from scratch

Instead:
1. require explicit SDK selection from the user
2. check `assets/sdk-installation-skills.json` for a matching installation skill
3. delegate to the installation skill if available
4. ask the user for SDK installation/setup steps if no installation skill exists
5. continue implementation only after SDK setup is confirmed

---

# Parsing Rules (Derived from Clickstream Sheet)

When reading the user-provided clickstream sheet, extract:

| What to extract | Rule |
|---|---|
| Parameter key names | Read exactly as written in the sheet — do NOT assume any prefix (e.g. `EP_`, `event_`) |
| Static fields | `Type = static` → value must match exactly (case-sensitive) |
| Required dynamic fields | `Type = dynamic`, no optional marker → must be present and non-null/non-empty |
| Optional dynamic fields | Marked optional → if present, must be non-null/non-empty |
| Event type mapping | Derive from event name suffix or explicit column in the sheet (e.g. `_VIEWED` → `"view"`, `_CLICKED` → `"click"`) unless the sheet overrides |
| Parameter key casing | Whatever casing the sheet uses is the expected format — deviations are MAPPING_ERROR (auto-fixable) |
| Null-safety wrappers | `nullHandling(value, "NA")`, `value ?? "NA"`, `value \|\| "NA"`, `"NA"` — count as present; do NOT flag |

---

# Fix Rules

Full fix rules: `assets/fix-rules.md`. Key constraints:
- **Read before modify** — understand current implementation before changing anything.
- **Auto-fixable** (casing, key format): apply `recommendedFix` immediately.
- **MISSING static**: add with exact sheet value. **MISSING dynamic**: source from service/store; wrap with project's null-safety pattern.
- **No dispatch call**: implement full event from scratch using the extracted pattern from step 6.
- **Compliant calls** must NOT be touched. **Partial implementations** must be completed.
- Every component/screen in the sheet must be covered; none may be skipped.

---

# Rules

1. The user-provided clickstream sheet is the **single source of truth** — never deviate from it.
2. If the clickstream sheet is missing, **stop and ask** — do not proceed or guess.
3. **Auto-detect platform** at the start of every execution; load the matching platform reference file and **read it fully** before any scanning or fixing.
4. **After platform detection, execute the Analytics Tool Detection Gate (step 4).** Always present the full SDK Selection Menu to the user and wait for their explicit choice before writing any code. If a tool is detected in `package.json`, mark it as DETECTED in the menu but still require the user to confirm.
5. **After analytics tool selection, execute every mandatory gate in the loaded platform reference file — in order — before touching any component file.** This is not optional. Each gate result must be stated in chat as proof of completion.
6. **The locked analytics tool from step 4 defines the only permitted dispatch method for the entire implementation.** Any other analytics call is out of scope.
7. Scan the **entire project scope** — list EVERY source file via the Step 7 Exhaustive File Inventory. Every component, screen, module, widget, service, and view must be inventoried. A file must never be skipped without an explicit N/A entry in the Coverage Table.
8. **Read existing implementation before modifying** — never overwrite a compliant dispatch call.
9. Parameter key names and casing are defined by the clickstream sheet — do NOT assume any fixed prefix or format.
10. Every event in the sheet must have a dispatch call; every dispatch call must have every parameter in the sheet.
11. Static values are case-sensitive — exact match required.
12. Dynamic fields: validate structural presence only — runtime content is not evaluated.
13. Extra fields not in the clickstream sheet are out of scope — do NOT flag them.
14. Do not mark the task complete until every component in scope has `"finalComplianceStatus": "PASS"`.

---

# Post-Execution Summary

Output in chat after every run — do NOT write to a file. Full template: `assets/audit-template.md`.

Must include: platform, mode, sheet name, analytics tool, dispatch method, files scanned, events in sheet, finding counts by category (MISSING / NULL / EMPTY / INCORRECT_VALUE / MAPPING_ERROR), changes applied, manual review items, final status, and a full Coverage Table with every in-scope file.

---

# Key Principle
No pre-existing files required. Give the skill your clickstream sheet and it does the rest — input validation, platform detection, existing implementation review, full-coverage gap analysis, audit, fix, and revalidation — all derived from what you provide. Parameter naming, key format, and event conventions are always read from your sheet, never assumed.