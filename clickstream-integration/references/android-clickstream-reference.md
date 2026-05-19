# Platform Reference: Android

**Load this reference only when**: Android Kotlin or Java Activity, Fragment, or ViewModel validation.
**Do NOT load** for Angular, iOS, Flutter, React, or React Native tasks.

---

## When to Use

Load this reference when:
- Auditing Android `.kt` or `.java` files for clickstream compliance
- Scanning analytics dispatch call sites in Activities, Fragments, ViewModels, or Compose screens
- Implementing the `sendClickstream()` helper pattern in Android components
- Understanding Android-specific insertion points for analytics events

---

## MANDATORY GATES — DO NOT SKIP — MUST COMPLETE IN ORDER

These steps are **strictly sequential**. Each step is a hard gate.
**Do NOT write any implementation code until ALL gates are PASSED.**

---

### SDK ABSENCE — HARD BLOCKING CONDITION

If no analytics SDK or analytics wrapper exists in the Android project:

- **DO NOT** generate a new AnalyticsManager or analytics helper
- **DO NOT** generate a new analytics wrapper
- **DO NOT** create Activity lifecycle-based screen tracking from scratch
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

Always reuse the existing analytics SDK, manager, dispatch pattern, and ViewModel architecture already present in the Android project. Never replace, recreate, or wrap existing analytics infrastructure with new layers.

---

### GATE 1 — Detect Analytics Wrapper Type

Android projects use one of two patterns:

| Type | Indicator |
|---|---|
| **Enterprise wrapper** | Project has a centralized `AnalyticsManager`, `AnalyticsHelper`, or a ViewModel function that dispatches analytics. Fragments/Activities call it directly. |
| **Standard Android** | Fragments/Activities call the analytics SDK directly with no intermediary manager or ViewModel function. |

Detection:
- Check `build.gradle` / `build.gradle.kts` `dependencies {}` for any analytics SDK.
- Search all `.kt`/`.java` source files (excluding `*Test.kt`, `*Test.java`) for analytics manager class names or dispatch call signatures.

Record the classification explicitly before proceeding.

PASS condition: analytics wrapper type is recorded.

---

### GATE 2 — Lock the Dispatch Strategy

> **Enterprise wrapper path and standard Android path are completely separate. Never mix patterns.**

#### IF ENTERPRISE WRAPPER:

- **Inject the existing analytics manager** into every Fragment/Activity that fires an event.
- **DO NOT create any additional manager or helper** on top of the existing analytics layer.
- **DO NOT invent constant maps or enums** for parameter values. All values must be **inline string literals** exactly as written in the clickstream sheet.
- Null-safety: use the wrapper's built-in null-safety helper or Kotlin's `?:` operator.

**Fragment pattern (enterprise wrapper — Kotlin):**
```kotlin
class MyFragment : Fragment() {
  private lateinit var analyticsManager: AnalyticsManager

  override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
    super.onViewCreated(view, savedInstanceState)
    analyticsManager = AnalyticsManager.getInstance(requireContext())
    sendClickstream("SCREEN_VIEWED", emptyMap())
  }

  private fun sendClickstream(eventName: String, additionalProps: Map<String, Any> = emptyMap()) {
    val baseProps = hashMapOf<String, Any>(
      "EP_PAGE_NAME"  to "EXACT_PAGE_NAME_FROM_SHEET",
      "EP_EVENT_TYPE" to if (eventName.contains("VIEWED")) "view" else "click",
      // ... all other shared EP_* fields from the clickstream sheet
    )
    analyticsManager.dispatch(eventName, baseProps + additionalProps)
  }

  private fun handleButtonClick() {
    sendClickstream("SCREEN_CLICKED", mapOf(
      "EP_CLICK_TYPE" to "button_click",
      "EP_SECTION"    to "value_from_sheet"
    ))
    // ... action
  }
}
```

PASS condition: recorded as "Enterprise wrapper — manager injection — no additional wrapper created"

---

#### IF STANDARD ANDROID:

- Use the analytics SDK confirmed in Step 4 of `execution-flow.md`.
- Confirm the exact method name by scanning existing call sites first.
- A local `sendClickstream()` helper inside the Fragment/Activity is the recommended pattern.
- Null-safety: `value ?: "NA"`.

**Fragment pattern (standard Android — Kotlin):**
```kotlin
private fun sendClickstream(eventName: String, additionalProps: Map<String, Any> = emptyMap()) {
  val baseProps = hashMapOf<String, Any>(
    "EP_PAGE_NAME"  to "SCREEN_NAME_FROM_SHEET",
    "EP_EVENT_TYPE" to if (eventName.contains("VIEWED")) "view" else "click",
    // ... all other shared EP_* fields from the clickstream sheet
  )
  analyticsSDK.track(eventName, baseProps + additionalProps)
}
```

**Compose screen pattern:**
```kotlin
@Composable
fun MyScreen(viewModel: MyViewModel) {
  LaunchedEffect(Unit) {
    viewModel.sendClickstream("SCREEN_VIEWED", emptyMap())
  }
  Button(onClick = {
    viewModel.sendClickstream("SCREEN_CLICKED", mapOf("EP_CLICK_TYPE" to "button_click"))
    // ... action
  }) { /* ... */ }
}
```

PASS condition: recorded as "Standard Android — `<confirmed dispatch method>`"

---

### GATE 3 — Exhaustive Component Inventory

This gate is a **hard gate**. No implementation code may be written until this gate is PASSED.

**Step 3A — List all component files**
- Recursively list all `.kt` and `.java` files under the project source root.
- Exclude: `*Test.kt`, `*Test.java`, `*Spec.kt`, generated files.
- Every file in this list MUST be opened and read in Step 3B.

**Step 3B — Classify every handler in each file**

| Classification | Description | Needs clickstream? |
|---|---|---|
| **SELF-EXECUTING** | Directly calls `findNavController().navigate()`, `startActivity()`, API calls, or any navigation/external action | **YES — if matched to a sheet event** |
| **DELEGATING** | Handler only triggers a ViewModel call with no direct navigation in the Fragment/Activity | **NO — ViewModel may dispatch** |
| **MIXED** | Calls ViewModel AND also directly navigates or calls an API in the same handler | **YES — fire clickstream before the direct action** |
| **LIFECYCLE / UTIL** | `onViewCreated`, `onCreate`, `onResume`, `LaunchedEffect`, pure data transformations | **NO** |

> **Android Delegation Trap**: A button click listener that calls `viewModel.submit()` appears delegating, but if the Fragment also calls `findNavController().navigate(...)` in the same listener — it is **MIXED** and MUST fire clickstream.

**Step 3C — Coverage Table (mandatory output before any code is written)**

```
| File               | Handler             | Classification  | Sheet Event | Status  |
|--------------------|---------------------|-----------------|-------------|---------|
| HomeFragment.kt    | handleCTAClick      | SELF-EXECUTING  | EVENT_NAME  | MISSING |
| NavFragment.kt     | handleNavClick      | MIXED           | EVENT_NAME  | DONE    |
| LoaderFragment.kt  | (no interactive)    | —               | —           | N/A     |
```

Every file from Step 3A must have at least one row. No file may be silently skipped.

PASS condition: Coverage Table is complete; every SELF-EXECUTING / MIXED row with a sheet event is identified.

---

### GATE 4 — Review Existing Implementation

- Search all non-test `.kt`/`.java` files for existing analytics dispatch calls.
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

## Android-Specific Implementation Rules

### VIEW Events — Fragment (XML layout)
Fire VIEW events inside `onViewCreated` after the view is ready:
```kotlin
override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
  super.onViewCreated(view, savedInstanceState)
  sendClickstream("SCREEN_VIEWED", emptyMap())
}
```

### VIEW Events — Activity
Fire VIEW events inside `onResume` for accuracy across back-stack returns, or `onCreate` for first-mount only:
```kotlin
override fun onResume() {
  super.onResume()
  sendClickstream("SCREEN_VIEWED", emptyMap())
}
```

### VIEW Events — Jetpack Compose
Use `LaunchedEffect(Unit)` to fire once on composition:
```kotlin
LaunchedEffect(Unit) {
  sendClickstream("SCREEN_VIEWED", emptyMap())
}
```

### ViewModel Awareness
Analytics props read from LiveData or StateFlow must be observed before dispatch. Do not dispatch with uninitialized state:
```kotlin
viewModel.userData.observe(viewLifecycleOwner) { data ->
  sendClickstream("SCREEN_VIEWED", mapOf("EP_CUSTOMER_ID" to (data.customerId ?: "NA")))
}
```

### Null-Safety
All dynamic field values must be null-safe before dispatch:
```kotlin
"EP_CUSTOMER_ID" to (customerId ?: "NA")
"EP_PLATFORM"    to "app"
```

### Static Field Values
- Copy exact strings from the clickstream sheet — case-sensitive.
- Do NOT create constant maps, sealed classes, or enums for static parameter values.

### File Discovery
```
<module>/src/main/**/*.{kt,java}
Exclude: *Test.kt, *Test.java, *Spec.kt, generated/
```

---

## Key Violations to Detect

| Violation | Rule |
|---|---|
| New analytics manager or helper created on top of existing | FORBIDDEN — inject and use the existing analytics layer directly |
| Constant map, sealed class, or enum used for clickstream parameter values | FORBIDDEN — use inline string literals |
| Dynamic field dispatched without null-safety | MUST be wrapped with `?: "NA"` |
| Compliant existing call site overwritten | MUST be preserved |
| Clickstream fired inside a delegating-only listener | WRONG COMPONENT — implement in the correct owner |
| VIEW event placed in `onClick` instead of `onViewCreated`/`onResume` | INCORRECT — VIEW must fire in lifecycle, not on interaction |