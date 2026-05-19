# Platform Reference: React (Web)

**Load this reference only when**: React web TypeScript or JavaScript component validation.
**Do NOT load** for Angular, Vue, Android, iOS, Flutter, or React Native tasks.

---

## When to Use

Load this reference when:
- Auditing React `.tsx` or `.jsx` component files for clickstream compliance
- Scanning analytics dispatch call sites in React components or custom hooks
- Implementing the `sendClickstream()` helper pattern in React functional or class components
- Understanding React-specific insertion points for analytics events

---

## MANDATORY GATES — DO NOT SKIP — MUST COMPLETE IN ORDER

These steps are **strictly sequential**. Each step is a hard gate.
**Do NOT write any implementation code until ALL gates are PASSED.**

---

### SDK ABSENCE — HARD BLOCKING CONDITION

If no analytics SDK or analytics wrapper exists in the React project:

- **DO NOT** generate a new analytics service or hook
- **DO NOT** generate a new analytics wrapper
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

Always reuse the existing analytics SDK, wrapper, dispatch pattern, and hook architecture already present in the React project. Never replace, recreate, or wrap existing analytics infrastructure with new layers.

---

### GATE 1 — Detect Analytics Wrapper Type

React projects use one of two patterns:

| Type | Indicator |
|---|---|
| **Enterprise wrapper** | Project has a custom `useAnalytics()` hook, analytics Context provider, or a shared analytics service module that components import. |
| **Standard React** | Components call the analytics SDK directly with no intermediary hook or wrapper. |

Detection:
- Check `package.json` `"dependencies"` for any analytics package.
- Search all `.ts`/`.tsx` source files (excluding `.spec.`, `.test.`, `.stories.`) for analytics hook names or dispatch call signatures.

Record the classification explicitly before proceeding.

PASS condition: analytics wrapper type is recorded.

---

### GATE 2 — Lock the Dispatch Strategy

> **Enterprise wrapper path and standard React path are completely separate. Never mix patterns.**

#### IF ENTERPRISE WRAPPER:

- **Import and call the existing analytics hook or service directly** in every component that fires an event.
- **DO NOT create any additional hook or service** on top of the existing analytics layer.
- **DO NOT invent constant objects or enums** for parameter values. All values must be **inline string literals** exactly as written in the clickstream sheet.
- Null-safety: use the wrapper's built-in null-safety helper or the project's established null-safe pattern.

**Functional component pattern (enterprise wrapper):**
```typescript
const MyComponent: React.FC = () => {
  const { sendClickstream } = useAnalytics();

  useEffect(() => {
    sendClickstream('PAGE_VIEWED', {
      EP_PAGE_NAME: 'EXACT_PAGE_NAME_FROM_SHEET',
      EP_EVENT_TYPE: 'view',
      // ... all other shared EP_* fields from the clickstream sheet
    });
  }, []);

  const handleButtonClick = () => {
    sendClickstream('PAGE_CLICKED', {
      EP_CLICK_TYPE: 'button_click',  // inline string literal
      EP_SECTION:    'value_from_sheet',
    });
    // ... action
  };
};
```

PASS condition: recorded as "Enterprise wrapper — hook/service import — no additional wrapper created"

---

#### IF STANDARD REACT:

- Use the analytics SDK confirmed in Step 4 of `execution-flow.md`.
- Confirm the exact method name by scanning existing call sites first.
- A local `sendClickstream()` helper inside the component is the recommended pattern.
- Null-safety: `value ?? 'NA'`.

**Functional component pattern (standard React):**
```typescript
const sendClickstream = (eventName: string, additionalProps: Record<string, any> = {}) => {
  const baseProps = {
    EP_PAGE_NAME: 'SCREEN_NAME_FROM_SHEET',
    EP_EVENT_TYPE: eventName.includes('VIEWED') ? 'view' : 'click',
    // ... all other shared EP_* fields from the clickstream sheet
  };
  analyticsSDK.track(eventName, { ...baseProps, ...additionalProps });
};
```

**Class component pattern (standard React):**
```typescript
class MyComponent extends React.Component {
  sendClickstream(eventName: string, additionalProps: Record<string, any> = {}) {
    const baseProps = { /* ... */ };
    analyticsSDK.track(eventName, { ...baseProps, ...additionalProps });
  }

  componentDidMount() {
    this.sendClickstream('PAGE_VIEWED', {});
  }
}
```

PASS condition: recorded as "Standard React — `<confirmed dispatch method>`"

---

### GATE 3 — Exhaustive Component Inventory

This gate is a **hard gate**. No implementation code may be written until this gate is PASSED.

**Step 3A — List all component files**
- Recursively list all `.ts`, `.tsx`, `.js`, `.jsx` files under the project source root.
- Exclude: `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.stories.tsx`, `node_modules/`, generated files.
- Every file in this list MUST be opened and read in Step 3B.

**Step 3B — Classify every handler in each component file**

| Classification | Description | Needs clickstream? |
|---|---|---|
| **SELF-EXECUTING** | Directly calls `navigate()`, `window.open()`, `router.push()`, API calls, or any navigation/external action | **YES — if matched to a sheet event** |
| **DELEGATING** | Handler body is ONLY `props.onCallback(...)` or `setState(...)` with no side-effects | **NO — parent is responsible** |
| **MIXED** | Calls a parent callback AND also navigates or calls an API in the same handler | **YES — fire clickstream before the direct action** |
| **LIFECYCLE / UTIL** | `useEffect`, `componentDidMount`, render helpers, pure computations | **NO** |

> **React Delegation Trap**: A handler passed down via `onClick={props.onSubmit}` may look delegating, but if the handler body also calls `navigate()` or an API — it is **MIXED** and MUST fire clickstream.

**Step 3C — Coverage Table (mandatory output before any code is written)**

```
| File                  | Handler           | Classification  | Sheet Event | Status  |
|-----------------------|-------------------|-----------------|-------------|---------|
| LandingPage.tsx       | handleBannerClick | SELF-EXECUTING  | EVENT_NAME  | MISSING |
| NavBar.tsx            | handleNavClick    | MIXED           | EVENT_NAME  | DONE    |
| Footer.tsx            | (no interactive)  | —               | —           | N/A     |
```

Every file from Step 3A must have at least one row. No file may be silently skipped.

PASS condition: Coverage Table is complete; every SELF-EXECUTING / MIXED row with a sheet event is identified.

---

### GATE 4 — Review Existing Implementation

- Search all non-test `.ts`/`.tsx`/`.js`/`.jsx` files for existing analytics dispatch calls.
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

## React-Specific Implementation Rules

### VIEW Events — Functional Components
Fire VIEW events inside `useEffect` with an empty dependency array:
```typescript
useEffect(() => {
  sendClickstream('PAGE_VIEWED', {});
}, []);
```

### VIEW Events — Class Components
Fire VIEW events inside `componentDidMount`:
```typescript
componentDidMount() {
  this.sendClickstream('PAGE_VIEWED', {});
}
```

### Hook Cleanup
If the analytics wrapper uses subscriptions or timers, clean up in the `useEffect` return:
```typescript
useEffect(() => {
  sendClickstream('PAGE_VIEWED', {});
  return () => { /* cleanup if needed */ };
}, []);
```

### React Router Integration
Obtain the current route via `useLocation()` for `EP_PAGE_URL`:
```typescript
const location = useLocation();
// EP_PAGE_URL: location.pathname
```
Do NOT use `window.location.href` when React Router is available.

### Redux / Context Props
When analytics props come from Redux state or Context, read them inside the component — do not create new selectors solely for analytics purposes:
```typescript
const customerId = useSelector(state => state.user.customerId);
// EP_CUSTOMER_ID: customerId ?? 'NA'
```

### Null-Safety
All dynamic field values must be null-safe before dispatch:
```typescript
EP_CUSTOMER_ID: customerId ?? 'NA'
EP_PLATFORM:    platform ?? 'web'
```

### Static Field Values
- Copy exact strings from the clickstream sheet — case-sensitive.
- Do NOT create constant objects or enums for static parameter values.

### File Discovery
```
<feature-dir>/**/*.{ts,tsx,js,jsx}
Exclude: *.test.*, *.spec.*, *.stories.*, node_modules/
```

---

## Key Violations to Detect

| Violation | Rule |
|---|---|
| New analytics hook or service created on top of existing | FORBIDDEN — import and use the existing analytics layer directly |
| Constant object or enum used for clickstream parameter values | FORBIDDEN — use inline string literals |
| Dynamic field dispatched without null-safety | MUST be wrapped with `?? 'NA'` |
| Compliant existing call site overwritten | MUST be preserved |
| Clickstream fired inside a delegating-only handler | WRONG COMPONENT — implement in parent instead |
| VIEW event placed outside `useEffect` / `componentDidMount` | INCORRECT — must fire in lifecycle, not on render |