# Platform Reference: React Native

**Load this reference only when**: React Native TypeScript or JavaScript screen/component validation.
**Do NOT load** for Angular, React web, Android, iOS, Flutter, or Vue tasks.

---

## Platform Detection — React Native vs React Web

Both React Native and React Web use `.tsx` / `.jsx` extensions. Confirm React Native before loading this file:

1. Check `package.json` `"dependencies"` for `"react-native"` key → **React Native confirmed**
2. OR search any source file for `from 'react-native'` import → **React Native confirmed**
3. If neither signal is found → load `react-clickstream-reference.md` instead

State the detected platform explicitly in chat before proceeding.

---

## When to Use

Load this reference when:
- Auditing React Native `.tsx` or `.ts` screen/component files for clickstream compliance
- Scanning analytics dispatch call sites in React Native screens, hooks, or navigation listeners
- Implementing the `sendClickstream()` helper pattern in React Native screens
- Understanding React Native-specific insertion points for analytics events

---

## MANDATORY GATES — DO NOT SKIP — MUST COMPLETE IN ORDER

These steps are **strictly sequential**. Each step is a hard gate.
**Do NOT write any implementation code until ALL gates are PASSED.**

---

### SDK ABSENCE — HARD BLOCKING CONDITION

If no analytics SDK or analytics wrapper exists in the React Native project:

- **DO NOT** generate a new analytics service or hook
- **DO NOT** generate a new analytics wrapper
- **DO NOT** create navigation-listener-based screen tracking
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

Always reuse the existing analytics SDK, wrapper, dispatch pattern, and hook architecture already present in the React Native project. Never replace, recreate, or wrap existing analytics infrastructure with new layers.

---

### GATE 1 — Detect Analytics Wrapper Type

React Native projects use one of two patterns:

| Type | Indicator |
|---|---|
| **Enterprise wrapper** | Project has a custom `useAnalytics()` hook, a shared analytics service module, or a navigation listener wrapper that screens import. |
| **Standard React Native** | Screens call the analytics SDK directly with no intermediary hook or wrapper. |

Detection:
- Check `package.json` `"dependencies"` for any analytics package.
- Search all `.ts`/`.tsx` source files (excluding `.spec.`, `.test.`) for analytics hook names or dispatch call signatures.

Record the classification explicitly before proceeding.

PASS condition: analytics wrapper type is recorded.

---

### GATE 2 — Lock the Dispatch Strategy

> **Enterprise wrapper path and standard React Native path are completely separate. Never mix patterns.**

#### IF ENTERPRISE WRAPPER:

- **Import and call the existing analytics hook or service directly** in every screen that fires an event.
- **DO NOT create any additional hook or service** on top of the existing analytics layer.
- **DO NOT invent constant objects or enums** for parameter values. All values must be **inline string literals** exactly as written in the clickstream sheet.
- Null-safety: use the wrapper's built-in null-safety helper or the project's established null-safe pattern.

**Screen pattern (enterprise wrapper):**
```typescript
const MyScreen: React.FC = () => {
  const { sendClickstream } = useAnalytics();

  useFocusEffect(
    useCallback(() => {
      sendClickstream('SCREEN_VIEWED', {
        EP_PAGE_NAME: 'EXACT_PAGE_NAME_FROM_SHEET',
        EP_EVENT_TYPE: 'view',
        EP_PLATFORM: Platform.OS,
        // ... all other shared EP_* fields from the clickstream sheet
      });
    }, [])
  );

  const handleButtonPress = () => {
    sendClickstream('SCREEN_CLICKED', {
      EP_CLICK_TYPE: 'button_click',  // inline string literal
      EP_SECTION:    'value_from_sheet',
    });
    // ... action
  };
};
```

PASS condition: recorded as "Enterprise wrapper — hook/service import — no additional wrapper created"

---

#### IF STANDARD REACT NATIVE:

- Use the analytics SDK confirmed in Step 4 of `execution-flow.md`.
- Confirm the exact method name by scanning existing call sites first.
- A local `sendClickstream()` helper inside the screen is the recommended pattern.
- Null-safety: `value ?? 'NA'`.

**Screen pattern (standard React Native):**
```typescript
const sendClickstream = (eventName: string, additionalProps: Record<string, any> = {}) => {
  const baseProps = {
    EP_PAGE_NAME: 'SCREEN_NAME_FROM_SHEET',
    EP_EVENT_TYPE: eventName.includes('VIEWED') ? 'view' : 'click',
    EP_PLATFORM: Platform.OS,
    // ... all other shared EP_* fields from the clickstream sheet
  };
  analyticsSDK.track(eventName, { ...baseProps, ...additionalProps });
};
```

PASS condition: recorded as "Standard React Native — `<confirmed dispatch method>`"

---

### GATE 3 — Exhaustive Component Inventory

This gate is a **hard gate**. No implementation code may be written until this gate is PASSED.

**Step 3A — List all screen and component files**
- Recursively list all `.ts` and `.tsx` files under the project source root.
- Exclude: `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `node_modules/`, generated files.
- Every file in this list MUST be opened and read in Step 3B.

**Step 3B — Classify every handler in each file**

| Classification | Description | Needs clickstream? |
|---|---|---|
| **SELF-EXECUTING** | Directly calls `navigation.navigate()`, `navigation.push()`, `Linking.openURL()`, API calls, or any navigation/external action | **YES — if matched to a sheet event** |
| **DELEGATING** | Handler body is ONLY `props.onCallback(...)` or `setState(...)` with no side-effects | **NO — parent is responsible** |
| **MIXED** | Calls a parent callback AND also navigates or calls an API in the same handler | **YES — fire clickstream before the direct action** |
| **LIFECYCLE / UTIL** | `useFocusEffect`, `useEffect`, `AppState` listeners, pure computations | **NO** |

> **React Native Delegation Trap**: A handler received via props may also call `navigation.navigate()` directly — inspect the full function body. If it does, it is **MIXED** and MUST fire clickstream.

**Step 3C — Coverage Table (mandatory output before any code is written)**

```
| File              | Handler             | Classification  | Sheet Event | Status  |
|-------------------|---------------------|-----------------|-------------|---------|
| HomeScreen.tsx    | handleCTAPress      | SELF-EXECUTING  | EVENT_NAME  | MISSING |
| TabBar.tsx        | handleTabPress      | MIXED           | EVENT_NAME  | DONE    |
| Loader.tsx        | (no interactive)    | —               | —           | N/A     |
```

Every file from Step 3A must have at least one row. No file may be silently skipped.

PASS condition: Coverage Table is complete; every SELF-EXECUTING / MIXED row with a sheet event is identified.

---

### GATE 4 — Review Existing Implementation

- Search all non-test `.ts`/`.tsx` files for existing analytics dispatch calls.
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

---

## React Native-Specific Implementation Rules

### VIEW Events — Preferred Pattern
Use `useFocusEffect` with `useCallback` for VIEW events. This fires on every screen focus (including tab switches and back-navigation), unlike `useEffect` which only fires on mount:
```typescript
import { useFocusEffect } from '@react-navigation/native';

useFocusEffect(
  useCallback(() => {
    sendClickstream('SCREEN_VIEWED', {});
  }, [])
);
```

### VIEW Events — Mount-Only Alternative
Use `useEffect` with empty deps only when the screen is never re-focused (e.g., modals, bottom sheets):
```typescript
useEffect(() => {
  sendClickstream('SCREEN_VIEWED', {});
}, []);
```

### Platform-Conditional Props
Use `Platform.OS` for platform detection — never hardcode `'ios'` or `'android'` as a fixed string:
```typescript
EP_PLATFORM: Platform.OS
```

> `Platform.OS` always returns `'ios'` or `'android'` in React Native — it is never null or undefined. Do NOT add `?? 'NA'`.

### AppState Listener
If the project tracks foreground/background state, preserve the existing `AppState` listener pattern — do not add a parallel listener.

### AsyncStorage / Session Values
When analytics props come from AsyncStorage, read them via the established project pattern:
```typescript
const customerId = await AsyncStorage.getItem('customerId');
// EP_CUSTOMER_ID: customerId ?? 'NA'
```

### Null-Safety
All dynamic field values must be null-safe before dispatch:
```typescript
EP_CUSTOMER_ID: customerId ?? 'NA'
```

> **`Platform.OS` exception**: `Platform.OS` always returns `'ios'` or `'android'` in React Native — it is never null or undefined. Use `Platform.OS` directly. Do NOT add `?? 'NA'` to it; doing so is misleading and must not be used as a pattern example.

### Static Field Values
- Copy exact strings from the clickstream sheet — case-sensitive.
- Do NOT create constant objects or enums for static parameter values.

### File Discovery

Scan all `.ts` and `.tsx` files. Exclude test files (`.test.ts`, `.spec.ts`, `.test.tsx`, `.spec.tsx`, `*.d.ts`, `node_modules/`).

**PowerShell (Windows):**
```powershell
Get-ChildItem -Path <feature-dir> -Recurse -Include "*.ts","*.tsx" |
  Where-Object { $_.Name -notmatch '\.(test|spec)\.' }
```

**Bash (macOS/Linux):**
```bash
find <feature-dir> \( -name "*.ts" -o -name "*.tsx" \) | grep -vE "\.(test|spec)\."
```

> Use the appropriate command for the operating system. On Windows, the `find` command is not available in PowerShell by default.

### Scan Regex

Covers all documented React Native dispatch methods:
```
/(sendAnalyticsEvent|trackEvent|AnalyticsService\.track|CleverTap\.recordEvent|analytics\(\)\.logEvent|recordEvent|logEvent)\s*\(\s*['"\`]([^'"\`]+)['"\`]/g
```

> `AnalyticsService.track` and `CleverTap.recordEvent` must be matched as full qualified names to avoid false positives from other `track` or `recordEvent` methods in the codebase.

---

## Key Violations to Detect

| Violation | Rule |
|---|---|
| New analytics hook or service created on top of existing | FORBIDDEN — import and use the existing analytics layer directly |
| Constant object or enum used for clickstream parameter values | FORBIDDEN — use inline string literals |
| Dynamic field dispatched without null-safety | MUST be wrapped with `?? 'NA'` |
| Compliant existing call site overwritten | MUST be preserved |
| Clickstream fired inside a delegating-only handler | WRONG COMPONENT — implement in parent instead |
| VIEW event placed in `useEffect` when `useFocusEffect` is available | INCORRECT for screens with React Navigation — use `useFocusEffect` |