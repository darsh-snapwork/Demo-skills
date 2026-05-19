# Execution Flow

## Ingestion Pipeline (Runs Before Validation)

> **Run this pipeline ONCE before any validation or comparison step.**
> If `temp/normalized-events.json` already exists and is up to date, skip to Step 6.

```
1. Detect clickstream definition file
   → Run: scripts/detect-clickstream-sheet.js
   → Searches configured folders for clickstream-events.json/.xlsx/.csv/.md
   → Output: { "found": true, "path": "...", "extension": "..." } or { "found": false }

2. Detect file format
   → Determined by "extension" field in detection output
   → Supported: .json | .xlsx | .csv | .md

3. Install parser dependency if missing
   → Handled automatically inside: scripts/parse-clickstream-sheet.js
   → Reads required packages from: assets/parser-config.json
   → Detects package manager: npm | yarn | pnpm

4. Parse clickstream definition
   → Run: scripts/parse-clickstream-sheet.js --path <detected-path>
   → Output: { "success": true, "events": [...], "params": { ... } }
   → On failure: { "success": false, "reason": "..." } — stop and report

5. Normalize events into deterministic JSON
   → Run: scripts/normalize-events.js --input <parse-output-file>
   → Writes: temp/normalized-events.json
   → Normalizes: lowercase names, underscores, deduplication, malformed row removal
```

> **If no clickstream definition file is found (step 1 returns `found: false`):**
> Stop and ask the user:
> *"No clickstream definition file was found in the configured locations. Please upload your clickstream sheet (supports .json, .xlsx, .csv, .md) or add its path to assets/clickstream-config.json."*

---

## Validation and Comparison Flow

> **STEP 0 IS THE FIRST MANDATORY CHECK FOR ALL PLATFORMS. DO NOT SKIP.**
> **STEPS 1–4 ARE UNIVERSAL MANDATORY PREREQS WHEN CLICKSTREAM IS NOT YET IMPLEMENTED. DO NOT WRITE ANY CODE BEFORE STEP 4 IS COMPLETE.**
> **STEP 5 IS A MANDATORY PLATFORM GATE FOR ALL PLATFORMS. DO NOT SKIP. Execute every gate defined in the loaded platform reference file before proceeding to step 6.**

> **SDK PRESENCE IS A HARD BLOCKING CONDITION.** No analytics implementation code may be written until an analytics SDK or wrapper is confirmed present in the project. Auto-generating analytics infrastructure (services, Router tracking, wrappers) when no SDK exists is strictly forbidden. Complete Step 4D PASS condition before touching any component file.

0. **Check existing implementation** — search all non-spec source files for existing analytics dispatch calls before doing anything else.
   - **YES (found)**: Record the SDK/service/method in use. Run the ingestion pipeline (steps 1–3 below), then execute step 3 (detect platform + load platform reference file) and step 5 (Platform Reference Enforcement Gate), then jump directly to step 7 (Discover gaps) → step 9 (Audit) → step 11 (Fix) → step 12 (Revalidate) → step 13 (Report). Skip step 4 only — analytics tool detection is not needed because the tool is already confirmed from existing code.
   - **NO (not found)**: **STOP immediately. Present the full SDK Selection Menu (from the Supported Analytics Tools section) to the user before doing anything else.** Use this exact prompt:

     > *"No analytics implementation was found in this project. Please choose which SDK you want to use for clickstream implementation:*
     >
     > | # | SDK | Best for |
     > |---|---|---|
     > | 1 | Google Analytics 4 (GA4) | Web apps with Firebase |
     > | 2 | CleverTap | Mobile push + analytics |
     > | 3 | Custom | Your own wrapper/service |
     >
     > *Reply with the number or name of your choice. If your tool is not listed, reply with the package name and dispatch method.*
     >
     > **Note:** SDK installation will be handled separately — see Step 4D."

     Wait for the user’s reply. Do NOT proceed to step 1 until the user has selected an SDK.

1. **Guard** — confirm clickstream sheet is provided and readable; if missing → prompt user and stop.

2. **Parse** clickstream sheet — extract all events, parameter keys, types, static values.

3. **Detect platform** — infer from source file extensions (`.ts` → angular, `.tsx/.jsx` → react/react-native, `.kt/.java` → android, `.swift` → ios, `.dart` → flutter, `.vue` → vue). Load the matching platform reference file and **read the entire file before proceeding**:
   - `.ts` → `references/angular-clickstream-reference.md`
   - `.tsx` / `.jsx` → **disambiguate React Native vs React Web before loading a reference** (see `assets/platform-detection.json`):
     - If `package.json` `"dependencies"` contains `"react-native"` **OR** any source file contains `from 'react-native'` → **React Native** → load `references/react-native-clickstream-reference.md`
     - Otherwise → **React Web** → load `references/react-clickstream-reference.md`
     - Never load both. State the detected platform explicitly in chat before proceeding.
   - `.kt` / `.java` → `references/android-clickstream-reference.md`
   - `.swift` / `.m` → `references/ios-clickstream-reference.md`
   - `.dart` → `references/flutter-clickstream-reference.md`

4. **ANALYTICS TOOL DETECTION GATE — ALL PLATFORMS. DO NOT SKIP.**

   **Step 4A — Scan for existing analytics tools:**
   - Check `package.json` `"dependencies"` and `"devDependencies"` for known analytics packages.
   - Search all source files (excluding `*.spec.*`) for known analytics dispatch call signatures.
   - Refer to the **Supported Analytics Tools** section below for detection signals.

   **Step 4B — ALWAYS present the SDK Selection Menu and wait for user choice:**

   > **The SDK Selection Menu must ALWAYS be shown when Step 0 returned NO (no existing implementation). Do NOT auto-select even if exactly one tool is detected in package.json. The user must explicitly confirm their choice.**

   Present this menu in chat:

   > *"Please confirm which SDK to use for clickstream implementation:*
   >
   > | # | SDK | Web package | RN package | Web dispatch | RN dispatch | Status |
   > |---|---|---|---|---|---|---|
   > | 1 | **Google Analytics 4 (GA4)** | `firebase` / `@firebase/analytics` | `@react-native-firebase/analytics` | `gtag('event', name, props)` | `analytics().logEvent(name, props)` | \<DETECTED / not found\> |
   > | 2 | **CleverTap** | `clevertap-web-sdk` | `clevertap-react-native` | `clevertap.event.push([name, props])` | `CleverTap.recordEvent(name, props)` | \<DETECTED / not found\> |
   > | 3 | **Custom** | *(user-provided)* | *(user-provided)* | *(user-provided)* | *(user-provided)* | — |
   >
   > *Fill in DETECTED or not found for each row based on Step 4A scan results. If one is DETECTED, recommend it but still wait for user to confirm.*
   > *Reply with the number or name. If Custom, provide package name and dispatch method.*"

   **Step 4C — Lock the analytics tool:**
   - Record the selected tool name and its dispatch method/pattern (from the Supported Analytics Tools section).
   - Use the dispatch pattern matching the detected platform (web vs React Native). State the locked tool explicitly in chat. For example:
     - CleverTap on **React Native**: *"Analytics tool locked: CleverTap — `CleverTap.recordEvent(eventName, props)`"*
     - CleverTap on **Web**: *"Analytics tool locked: CleverTap — `clevertap.event.push([eventName, props])`"*
     - GA4 on **React Native**: *"Analytics tool locked: GA4 — `analytics().logEvent(eventName, props)`"*
     - GA4 on **Web**: *"Analytics tool locked: GA4 — `gtag('event', eventName, props)`"*
   - All subsequent implementation must use only this locked dispatch method. Any other analytics call is out of scope.

   **PASS condition**: analytics tool is locked and recorded before any component code is touched.

   **Step 4D — SDK Installation Gate:**
   - Check if the selected SDK is already present in `package.json` `"dependencies"` or `"devDependencies"`.
   - **Already installed**: Proceed immediately to step 5 — no installation needed.
   - **Not installed**: Load `assets/sdk-installation-skills.json` and look up the selected SDK key.
     - **Installation skill available** (`installationSkill` entry exists for the SDK AND the named skill is present in `.github/skills/`):
       > State in chat: *"Delegating SDK installation to: `<installationSkill>`"*
       Trigger the named installation skill. Wait for it to confirm completion before proceeding to step 5. Do NOT install the SDK directly.
     - **Installation skill unavailable** (SDK key not in `sdk-installation-skills.json` or named skill not present in `.github/skills/`):
       > Ask the user:
       > *"The selected SDK (`<SDK name>`) is not installed and no dedicated installation skill is available for it. Please provide the installation/setup steps for `<SDK name>` so we can continue integration."*
       Wait for the user to provide setup steps. Follow only the steps the user provides. Do NOT implement or run installation logic directly.

   **PASS condition**: Selected SDK is confirmed present in `package.json` before any component code is touched.

   > **If this PASS condition is not met, do not proceed to step 5 or beyond.** Return to SDK selection and the installation gate. No clickstream implementation may begin until an SDK is confirmed present OR the user has provided setup instructions that result in SDK presence.

5. **PLATFORM REFERENCE ENFORCEMENT GATE — ALL PLATFORMS.** After loading the platform reference file in step 3, execute every mandatory gate defined within it — in order, without skipping — before proceeding to step 6. Each gate must be completed and its result stated explicitly in chat as proof of completion. DO NOT proceed to step 6 until all mandatory gates in the platform reference file are fully passed.

6. **Review existing implementation** — search entire project for existing dispatch calls; read and record the dispatch method, props structure, and null-safety pattern in use.

7. **Discover — EXHAUSTIVE FILE INVENTORY (DO NOT SKIP ANY FILE)**

   This step is a **hard gate**. No implementation may begin until all sub-steps below are complete and the coverage table is produced.

   **Step 7A — List EVERY source file in the project.**
   - Recursively list all `.ts` / `.tsx` / `.kt` / `.swift` / `.dart` / `.vue` files under the project source root (excluding `*.spec.*`, `*.d.ts`, `node_modules/`, and auto-generated files).
   - Group files by type using **platform-appropriate categories**:
     - **Angular**: Components | Services | Modules | Guards | Pipes | Other
     - **React Native / React**: Screens | Components | Hooks | Services | Utils | Other
     - **Flutter**: Screens/Pages | Widgets | Services | Utils | Other
     - **Android**: Activities | Fragments | ViewModels | Repositories | Other
     - **iOS**: ViewControllers | Views | ViewModels | Services | Other
   - Do NOT skip any file. Do NOT assume a file is irrelevant without reading it.

   **Step 7B — For each Component/Screen/Widget file, extract ALL interactive methods.**
   Open and read every component file. Build a method list. For each method, classify it:

   | Classification | Description | Needs clickstream? |
   |---|---|---|
   | **SELF-EXECUTING** | Method directly performs a user-visible action without delegating to a parent. **Angular**: calls `router.navigate()`, opens dialog, calls API, no `@Output()`. **React Native / React**: calls `navigation.navigate()`, `navigation.push()`, `Linking.openURL()`, makes API call, opens modal — without forwarding to a parent prop callback. | **YES — if it maps to a sheet event** |
   | **DELEGATING** | Method's sole purpose is to forward to a parent. **Angular**: `this.<output>.emit(...)` only. **React Native / React**: `props.onCallback()` / `props.onPress()` only — parent handles all side-effects and clickstream. | **NO — parent is responsible** |
   | **MIXED** | Handler delegates AND also performs a direct action itself. **Angular**: emits AND also navigates / opens dialog. **React Native / React**: calls prop callback AND also calls `navigation.navigate()` or an API. | **YES — fire clickstream before the direct action** |
   | **LIFECYCLE / UTIL** | **Angular**: `ngOnInit`, `ngOnDestroy`, pure helper/getter methods. **React Native / React**: `useEffect`, `useFocusEffect`, `AppState` listener setup, pure computations. | **NO** |

   > **Delegation Trap Warning**: A method that calls `this.someOutput.emit()` (Angular) or a prop callback `props.onPress()` (React Native / React) appears simple, but if it ALSO makes a direct call (dialog open, navigate, prompt, window.open, `navigation.navigate()`, API call, etc.) it is MIXED and MUST fire clickstream.
   >
   > **React Native navigation patterns** (treat as SELF-EXECUTING / MIXED triggers):
   > - `navigation.navigate('ScreenName')` / `useNavigation().navigate(...)`
   > - `Linking.openURL(...)` / `navigation.push(...)` / `navigation.replace(...)`
   > - `useFocusEffect` with analytics inside (LIFECYCLE — VIEW events only, not CLICK)

   **Step 7C — Build the Coverage Table.**
   Before writing any code, produce this table and state it explicitly in chat:

   ```
   | File | Method | Classification | Sheet Event | Status |
   |---|---|---|---|---|
   | component.ts | onSomeClick() | SELF-EXECUTING | EVENT_NAME | MISSING / DONE |
   | component.ts | onSomeEmit() | DELEGATING | (parent handles) | N/A |
   | component.ts | onMixedAction() | MIXED | EVENT_NAME | MISSING / DONE |
   ```

   Every file from Step 7A must appear in this table with at least one row (even if all rows are N/A). A file must never be silently skipped.

   **PASS condition**: Coverage Table is complete, every file from Step 7A has at least one entry, and all MISSING rows are identified before any code is written.

8. **Extract pattern** — from the most compliant existing call site; use as the implementation template for new/fixed events.

9. **Audit** — run `validate-clickstream.js` project-wide → `audit-result.json`.

10. **Compare** — run `compare-mappings.js`; cross-check every gap from step 7.

11. **Fix** *(fix mode only)* — apply every finding using the locked dispatch strategy from step 5; preserve all valid existing code; do not skip any gap.

12. **Revalidate** *(fix mode only)* — re-run step 9; all components must show `PASS` before task is complete.

13. **Report** — output comprehensive summary in chat.


---

## Quick Reference Commands

Run these in order from the project root. Use `--platform` matching your project type.

```bash
# Step 1 — Detect clickstream definition file
node .github/skills/clickstream-integration/scripts/detect-clickstream-sheet.js > detect-result.json

# Step 2 — Parse detected file (replace <path> with value from detect-result.json)
node .github/skills/clickstream-integration/scripts/parse-clickstream-sheet.js --path <path> > parse-result.json

# Step 3 — Normalize into deterministic JSON (auto-writes temp/normalized-events.json)
node .github/skills/clickstream-integration/scripts/normalize-events.js --input parse-result.json

# Step 4 — Audit all source files (replace react-native with your platform)
node .github/skills/clickstream-integration/scripts/validate-clickstream.js --dir <project-root> --platform react-native --dispatch <method> > audit-result.json

# Step 5 — Diff audit against normalized events
node .github/skills/clickstream-integration/scripts/compare-mappings.js --audit audit-result.json --output markdown
```

Exit codes: `0` = pass / no diffs  ·  `1` = violations/diffs found  ·  `2` = input error  ·  `3` = parse error
