# Platform Reference: Vue

**Load this reference only when**: Vue TypeScript or JavaScript component validation (`.vue`, `.ts`, `.js`).
**Do NOT load** for Angular, React, Android, iOS, Flutter, or React Native tasks.

---

## When to Use

Load this reference when:
- Auditing Vue `.vue` SFC, `.ts`, or `.js` files for clickstream compliance
- Scanning analytics dispatch call sites in Composition API or Options API components
- Implementing the `sendClickstream()` helper pattern in Vue screens
- Understanding Vue-specific insertion points for analytics events

---

## MANDATORY GATES — DO NOT SKIP — MUST COMPLETE IN ORDER

These steps are **strictly sequential**. Each step is a hard gate.
**Do NOT write any implementation code until ALL gates are PASSED.**

---

### SDK ABSENCE — HARD BLOCKING CONDITION

If no analytics SDK, composable, or plugin exists in the Vue project:

- **DO NOT** generate a new `useAnalytics` composable
- **DO NOT** generate a new analytics plugin or Pinia plugin
- **DO NOT** create Vue Router navigation guard-based screen tracking
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

Always reuse the existing analytics SDK, composable, plugin, or dispatch pattern already present in the Vue project. Never replace, recreate, or wrap existing analytics infrastructure with new layers.

---

### GATE 1 — Detect Analytics Wrapper Type

Vue projects use one of four patterns:

| Type | Indicator |
|---|---|
| **Composable** | Project has a `useAnalytics()`, `useClickstream()`, or similar composable that components import and call. |
| **Pinia plugin** | Analytics is dispatched via a Pinia store action or plugin. |
| **Global property** | Analytics is available on the Vue instance as `$analytics`, `$ct`, etc. |
| **Direct SDK** | Components import and call the analytics SDK directly with no wrapper. |

Detection:
- Check `package.json` `dependencies` / `devDependencies` for any analytics SDK.
- Search all `.vue` / `.ts` / `.js` source files (excluding `.test.`, `.spec.`, `node_modules/`) for composable imports or `$analytics` usage patterns.

Record the classification explicitly before proceeding.

PASS condition: analytics wrapper type is recorded.

---

### GATE 2 — Lock the Dispatch Strategy

> **Each wrapper path is completely separate. Never mix patterns.**

#### IF COMPOSABLE (`useAnalytics` / `useClickstream`):

- **Import and call the existing composable** inside each component that fires an event.
- **DO NOT create any additional composable** on top of the existing analytics layer.
- **DO NOT invent reactive refs or computed properties** for static parameter values. All values must be **inline string literals** exactly as written in the clickstream sheet.
- Null-safety: `value ?? 'NA'`.

**Composition API pattern (composable — TypeScript):**
```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useAnalytics } from '@/composables/useAnalytics'

const { dispatch } = useAnalytics()

onMounted(() => {
  sendClickstream('SCREEN_VIEWED')
})

function sendClickstream(eventName: string, additionalProps: Record<string, unknown> = {}): void {
  const baseProps = {
    EP_PAGE_NAME:  'EXACT_PAGE_NAME_FROM_SHEET',
    EP_EVENT_TYPE: eventName.includes('VIEWED') ? 'view' : 'click',
    // ... all other shared EP_* fields from the clickstream sheet
  }
  dispatch(eventName, { ...baseProps, ...additionalProps })
}

function handleButtonClick(): void {
  sendClickstream('SCREEN_CLICKED', {
    EP_CLICK_TYPE: 'button_click',
    EP_SECTION:    'value_from_sheet',
  })
  // ... action
}
</script>
```

PASS condition: recorded as "Composable — `useAnalytics` imported — no additional wrapper created"

---

#### IF GLOBAL PROPERTY (`$analytics` / `$ct`):

- **Access the global property via `getCurrentInstance()?.proxy`** or `inject` — do not re-register the plugin.
- Null-safety: `value ?? 'NA'`.

**Options API pattern (global property — TypeScript):**
```vue
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  mounted() {
    this.sendClickstream('SCREEN_VIEWED')
  },
  methods: {
    sendClickstream(eventName: string, additionalProps: Record<string, unknown> = {}): void {
      const baseProps = {
        EP_PAGE_NAME:  'SCREEN_NAME_FROM_SHEET',
        EP_EVENT_TYPE: eventName.includes('VIEWED') ? 'view' : 'click',
        // ...
      }
      ;(this as any).$analytics.track(eventName, { ...baseProps, ...additionalProps })
    },
    handleButtonClick(): void {
      this.sendClickstream('SCREEN_CLICKED', { EP_CLICK_TYPE: 'button_click' })
      this.$router.push('/next')
    },
  },
})
</script>
```

PASS condition: recorded as "Global property — `$<property_name>` — no re-registration"

---

#### IF PINIA STORE:

- **Call the existing Pinia store action** — do not create a new analytics store.
- Read all analytics prop values from the correct store using `storeToRefs()` or direct store access.
- Null-safety: `value ?? 'NA'`.

**Composition API pattern (Pinia — TypeScript):**
```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useAnalyticsStore } from '@/stores/analyticsStore'

const analyticsStore = useAnalyticsStore()

onMounted(() => {
  analyticsStore.dispatch('SCREEN_VIEWED', { EP_PAGE_NAME: 'SCREEN_NAME_FROM_SHEET' })
})
</script>
```

PASS condition: recorded as "Pinia store — `<store_name>.dispatch` — no additional store created"

---

#### IF DIRECT SDK:

- Confirm the exact method name by scanning existing call sites first.
- A `sendClickstream()` helper inside the component `<script setup>` block is the recommended pattern.
- Null-safety: `value ?? 'NA'`.

PASS condition: recorded as "Direct SDK — `<confirmed dispatch method>`"

---

### GATE 3 — Exhaustive Component Inventory

This gate is a **hard gate**. No implementation code may be written until this gate is PASSED.

**Step 3A — List all component files**
- Recursively list all `.vue` files, and `.ts` / `.js` files that contain Vue component definitions.
- Exclude: `*.test.ts`, `*.spec.ts`, `*.test.js`, `*.spec.js`, files under `node_modules/`, generated files.
- Every file in this list MUST be opened and read in Step 3B.

**Step 3B — Classify every handler in each file**

| Classification | Description | Needs clickstream? |
|---|---|---|
| **SELF-EXECUTING** | Directly calls `router.push()`, `router.replace()`, `window.open()`, `window.location`, API calls (fetch/axios), or any navigation/external action | **YES — if matched to a sheet event** |
| **DELEGATING** | Handler only calls `$emit()` with no direct navigation or API call | **NO — parent component is responsible** |
| **MIXED** | Emits AND also directly navigates or calls an API in the same handler | **YES — fire clickstream before the direct action** |
| **LIFECYCLE / UTIL** | `onMounted`, `mounted()`, `onBeforeMount`, `watch`, `computed`, pure data transformations | **NO** |

> **Vue Delegation Trap**: A button handler that calls `emit('submit')` appears delegating, but if it ALSO calls `router.push('/success')` — it is **MIXED** and MUST fire clickstream.

**Step 3C — Coverage Table (mandatory output before any code is written)**

```
| File              | Handler             | Classification  | Sheet Event | Status  |
|-------------------|---------------------|-----------------|-------------|---------|
| HomeView.vue      | handleCTAClick      | SELF-EXECUTING  | EVENT_NAME  | MISSING |
| NavBar.vue        | handleNavClick      | MIXED           | EVENT_NAME  | DONE    |
| LoaderView.vue    | (no interactive)    | —               | —           | N/A     |
```

Every file from Step 3A must have at least one row. No file may be silently skipped.

PASS condition: Coverage Table is complete; every SELF-EXECUTING / MIXED row with a sheet event is identified.

---

### GATE 4 — Review Existing Implementation

- Search all non-test `.vue` / `.ts` / `.js` files for existing analytics dispatch calls.
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

## Vue-Specific Implementation Rules

### VIEW Events — Composition API
Use `onMounted()` for VIEW events (fires after the component is mounted to the DOM):
```vue
<script setup lang="ts">
import { onMounted } from 'vue'
onMounted(() => {
  sendClickstream('SCREEN_VIEWED')
})
</script>
```

### VIEW Events — Options API
Use the `mounted()` lifecycle hook:
```vue
<script lang="ts">
export default defineComponent({
  mounted() {
    this.sendClickstream('SCREEN_VIEWED')
  }
})
</script>
```

### Vue Router Context
Read route params, query, or path for analytics props:
```ts
import { useRoute } from 'vue-router'
const route = useRoute()
// EP_PAGE_URL: route.path ?? 'NA'
```

### Pinia / Vuex Store Values
Read store values for analytics props inside the component, not inside the dispatch call:
```ts
import { useUserStore } from '@/stores/userStore'
const userStore = useUserStore()
// EP_CUSTOMER_ID: userStore.customerId ?? 'NA'
```

### Template Event Bindings
CLICK events in the template (`@click`, `@submit`, etc.) must map 1:1 to a classified handler method. The `sendClickstream()` call must be inside the handler — never in the template expression:
```vue
<!-- CORRECT -->
<button @click="handleSubmit">Submit</button>

<!-- WRONG — no inline clickstream in template expressions -->
<button @click="() => { sendClickstream('X'); handleSubmit() }">Submit</button>
```

### Null-Safety
All dynamic field values must be null-safe before dispatch:
```ts
EP_CUSTOMER_ID: customerId ?? 'NA'
EP_PLATFORM:    'web'
```

### Static Field Values
- Copy exact strings from the clickstream sheet — case-sensitive.
- Do NOT create reactive refs, computed properties, or const maps for static parameter values.

### File Discovery
```
src/**/*.{vue,ts,js}
Exclude: *.test.ts, *.spec.ts, *.test.js, *.spec.js, node_modules/**
```

---

## Key Violations to Detect

| Violation | Rule |
|---|---|
| New composable or plugin created on top of existing | FORBIDDEN — import and use the existing analytics layer directly |
| Reactive ref or computed used for static clickstream parameter values | FORBIDDEN — use inline string literals |
| Dynamic field dispatched without null-safety | MUST be wrapped with `?? 'NA'` |
| Compliant existing call site overwritten | MUST be preserved |
| Clickstream fired inside a delegating-only handler (`$emit` only) | WRONG COMPONENT — implement in the correct owner |
| VIEW event placed in `@click` handler instead of `onMounted`/`mounted()` | INCORRECT — VIEW must fire in lifecycle, not on interaction |
| `sendClickstream()` call inlined inside template expression | INCORRECT — must be inside a handler method |