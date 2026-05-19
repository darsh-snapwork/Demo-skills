# Platform Reference: Angular

**Load this reference only when**: Angular TypeScript component validation.
**Do NOT load** for Android, iOS, Flutter, or React Native tasks.

---

## When to Use

Load this reference when:
- Auditing Angular `.ts` component files for clickstream compliance
- Scanning analytics dispatch call sites in Angular components
- Implementing the `sendClickstream()` helper pattern in Angular components
- Understanding Angular-specific insertion points for analytics events

---

## MANDATORY GATES — DO NOT SKIP — MUST COMPLETE IN ORDER

These steps are **strictly sequential**. Each step is a hard gate.
**Do NOT write any implementation code until ALL gates are PASSED.**

---

### SDK ABSENCE — HARD BLOCKING CONDITION

If no analytics SDK or analytics wrapper exists in the Angular project:

- **DO NOT** generate a new `ClickstreamService`
- **DO NOT** generate a new analytics wrapper service
- **DO NOT** create Router-based screen tracking
- **DO NOT** create analytics infrastructure from scratch
- **DO NOT** assume or invent an analytics architecture

**Instead — follow the SDK orchestration flow (`assets/execution-flow.md`):**
1. Trigger SDK selection (Step 0 / Step 4 of execution-flow)
2. Check installation skill availability (`assets/sdk-installation-skills.json`)
3. Ask user for SDK installation/setup steps if no installation skill is available
4. Continue implementation **only after** SDK setup is confirmed

**No gate below may be executed until an analytics SDK or wrapper is confirmed present in the project.**

---

### Reuse-First Rule

Always reuse the existing analytics SDK, wrapper, dispatch pattern, and service architecture already present in the Angular project. Never replace, recreate, or wrap existing analytics infrastructure with new layers.

---

### GATE 1 — Detect Analytics Wrapper Type

Enterprise Angular projects use one of two patterns:

| Type | Indicator |
|---|---|
| **Enterprise wrapper** | Project has a centralized analytics service that wraps the underlying SDK. Components inject and call it directly. |
| **Standard Angular** | Project uses the analytics SDK directly with no intermediary wrapper service. |

Detection:
- Check `package.json` `"dependencies"` for any analytics service or wrapper package.
- Search all `.ts` source files (excluding `.spec.ts`) for analytics service class names or dispatch call signatures.

Record the classification explicitly in chat before proceeding.

PASS condition: analytics wrapper type is recorded.

---

### GATE 2 — Lock the Dispatch Strategy

> **Enterprise wrapper path and standard Angular path are completely separate. Never mix patterns between them.**

#### IF ENTERPRISE WRAPPER:

- **Inject the existing analytics wrapper service directly** into every component that fires an event.
- **DO NOT create any additional Angular service** on top of the existing analytics service.
- **DO NOT invent constant enums** for parameter values. All values must be **inline string literals** exactly as written in the clickstream sheet.
- Null-safety: use the wrapper's built-in null-safety helper or the project's established null-safe pattern.
- Platform-conditional dispatch: preserve the project's existing runtime environment check.

**Component pattern (enterprise wrapper):**
```typescript
constructor(private analyticsService: YourAnalyticsService, ...) {}

sendClickstream(eventName: string, additionalProps: any = {}): void {
  const baseProps = {
    EP_PAGE_NAME:  'EXACT_PAGE_NAME_FROM_SHEET',  // inline string literal
    EP_EVENT_TYPE: eventName.includes('VIEWED') ? 'view' : 'click',
    // ... all other shared EP_* fields from the clickstream sheet
  };
  this.analyticsService.dispatch({ eventName, props: { ...baseProps, ...additionalProps } });
}

onSomeClick(): void {
  this.sendClickstream('EVENT_NAME_FROM_SHEET', {
    EP_CLICK_TYPE: 'value_from_sheet',  // inline string literal
    EP_SECTION:    'value_from_sheet',  // inline string literal
  });
}
```

PASS condition: recorded as "Enterprise wrapper — direct injection — no additional wrapper service"

---

#### IF STANDARD ANGULAR:

- Use the analytics SDK locked in `assets/execution-flow.md` Step 4.
- Confirm the exact method name by scanning existing call sites first.
- A local `sendClickstream()` helper inside the component is the recommended pattern.
- Null-safety: `value ?? 'NA'` or `value || 'NA'`.

**Component pattern (standard Angular):**
```typescript
sendClickstream(eventName: string, additionalProps: any = {}): void {
  const baseProps = {
    EP_PAGE_NAME:  'SCREEN_NAME_FROM_SHEET',
    EP_EVENT_TYPE: eventName.includes('VIEWED') ? 'view' : 'click',
    // ... all other shared EP_* fields from the clickstream sheet
  };
  this.analyticsService.track(eventName, { ...baseProps, ...additionalProps });
}
```

PASS condition: recorded as "Standard Angular — `<confirmed dispatch method>`"

---

### GATE 3 — Exhaustive Component Inventory

This gate is a **hard gate**. No implementation code may be written until this gate is PASSED.

**Step 3A — List all component files**
- Recursively list all `.ts` files under the project source root.
- Exclude: `*.spec.ts`, `*.d.ts`, `node_modules/`, `*.module.ts`, `*.routing.ts`, `main.ts`, `polyfills.ts`.
- Every file in this list MUST be opened and read in Step 3B.

**Step 3B — Classify every method in each component file**

| Classification | Description | Needs clickstream? |
|---|---|---|
| **SELF-EXECUTING** | Directly calls `router.navigate()`, `window.open()`, `dialog.open()`, API calls, or any navigation/external action | **YES — if matched to a sheet event** |
| **DELEGATING** | Method body is ONLY `this.<output>.emit(...)` — parent handles all side-effects | **NO — parent is responsible** |
| **MIXED** | Emits AND performs a direct action in the same method body | **YES — fire clickstream before the direct action** |
| **LIFECYCLE / UTIL** | `ngOnInit`, `ngOnDestroy`, constructor, getters, pure helpers | **NO** |

> **Angular Delegation Trap**: `@Output()` emitter methods appear simple, but if they ALSO contain `dialog.open()`, `router.navigate()`, `window.open()`, or any direct navigation/external call — they are **MIXED** and MUST fire clickstream. Always inspect the full method body.

**Step 3C — Coverage Table (mandatory output in chat before any code is written)**

```
| File                        | Method             | Classification   | Sheet Event | Status  |
|-----------------------------|--------------------|------------------|-------------|---------|
| landing.component.ts        | onBannerClick()    | SELF-EXECUTING   | EVENT_NAME  | MISSING |
| nav.component.ts            | onNavItemClick()   | MIXED            | EVENT_NAME  | DONE    |
| footer.component.ts         | (no interactive)   | —                | —           | N/A     |
```

Every file from Step 3A must have at least one row. No file may be silently skipped.

PASS condition: Coverage Table is complete; every SELF-EXECUTING / MIXED row with a sheet event is identified.

---

### GATE 4 — Review Existing Implementation

- Search all non-spec `.ts` files for existing analytics dispatch calls.
- Record the dispatch method name, props structure, and null-safety pattern in use.
- Preserve all compliant existing call sites — do not overwrite them.

PASS condition: existing implementation reviewed and recorded.

---

### GATE 5 — Implement

- Only begin writing or modifying code after Gates 1–4 are PASSED.
- Work through the Coverage Table row by row. Implement every MISSING row.
- Use the locked strategy from Gate 2 for every dispatch call.
- Write all static parameter values as **inline string literals** — copied from the clickstream sheet.
- Wrap all dynamic fields with the project's null-safety pattern.
- Mark each row DONE in the Coverage Table after completing it.
- Do not move to the next file until the current file is complete.

---

## Angular-Specific Implementation Rules

### Service Injection
- Inject analytics service via Angular constructor DI — never via global scope or `window.*`.
- Use `OnDestroy` + `takeUntil` / `unsubscribe` if the analytics wrapper uses observables.

### Platform-Conditional Props
Some parameters apply only to specific runtime platforms. Handle conditionally using environment variables:

```typescript
const isApp = environment.PLATFORM_NAME !== 'WEB';
if (!isApp) {
  props['EP_UTM_SOURCE'] = nullSafe(utmSource);
  // ... other web-only EP_* fields from the clickstream sheet
}
```

### Null-Safety
All dynamic field values must be null-safe before dispatch. Use the project's established pattern:

```typescript
// enterprise wrapper helper
analyticsService.nullHandling(value, 'NA')
// standard JS fallback
value ?? 'NA'
```

### Static Field Values
- Copy exact strings from the clickstream sheet — case-sensitive.
- Do NOT create constant enums, maps, or abstraction layers for static parameter values.

### File Discovery
```bash
find <feature-dir> -name "*.ts" | grep -v "\.spec\.ts" | grep -v "\.d\.ts"
```

---

## Key Violations to Detect

| Violation | Rule |
|---|---|
| New wrapper service created on top of the existing analytics service | FORBIDDEN — inject the existing service directly |
| Constant enum used for clickstream parameter values | FORBIDDEN — use inline string literals |
| Dynamic field dispatched without null-safety | MUST be wrapped with null-safe pattern |
| Compliant existing call site overwritten | MUST be preserved |
| Clickstream fired inside a delegating-only method | WRONG COMPONENT — implement in parent instead |