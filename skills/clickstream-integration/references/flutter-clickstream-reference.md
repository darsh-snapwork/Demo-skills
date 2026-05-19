# Platform Reference: Flutter (Dart)

**Load this reference only when**: Flutter Dart widget, BLoC, Cubit, or Provider validation.
**Do NOT load** for Angular, React, Android, iOS, or React Native tasks.

---

## When to Use

Load this reference when:
- Auditing Flutter `.dart` files for clickstream compliance
- Scanning analytics dispatch call sites in Widgets, BLoCs, Cubits, or Providers
- Implementing the `sendClickstream()` helper pattern in Flutter StatefulWidgets or services
- Understanding Flutter-specific insertion points for analytics events

---

## MANDATORY GATES — DO NOT SKIP — MUST COMPLETE IN ORDER

These steps are **strictly sequential**. Each step is a hard gate.
**Do NOT write any implementation code until ALL gates are PASSED.**

---

### SDK ABSENCE — HARD BLOCKING CONDITION

If no analytics SDK or analytics wrapper exists in the Flutter project:

- **DO NOT** generate a new analytics service or singleton
- **DO NOT** generate a new analytics wrapper
- **DO NOT** create Navigator observer-based screen tracking
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

Always reuse the existing analytics SDK, wrapper, dispatch pattern, and service architecture already present in the Flutter project. Never replace, recreate, or wrap existing analytics infrastructure with new layers.

---

### GATE 1 — Detect Analytics Wrapper Type

Flutter projects use one of two patterns:

| Type | Indicator |
|---|---|
| **Enterprise wrapper** | Project has a singleton `AnalyticsService`, a BLoC/Cubit event, a Provider, or a Riverpod notifier that widgets call for analytics. |
| **Standard Flutter** | Widgets call the analytics SDK plugin directly with no intermediary service. |

Detection:
- Check `pubspec.yaml` `dependencies:` for any analytics package.
- Search all `.dart` source files (excluding `*_test.dart`) for analytics service class names or dispatch call signatures.

Record the classification explicitly before proceeding.

PASS condition: analytics wrapper type is recorded.

---

### GATE 2 — Lock the Dispatch Strategy

> **Enterprise wrapper path and standard Flutter path are completely separate. Never mix patterns.**

#### IF ENTERPRISE WRAPPER:

- **Inject the existing analytics service** into every widget that fires an event.
- **DO NOT create any additional service or singleton** on top of the existing analytics layer.
- **DO NOT invent constant maps or enums** for parameter values. All values must be **inline string literals** exactly as written in the clickstream sheet.
- Null-safety: use the wrapper's built-in null-safety helper or Dart's `??` operator.

**StatefulWidget pattern (enterprise wrapper):**
```dart
class MyScreen extends StatefulWidget { /* ... */ }

class _MyScreenState extends State<MyScreen> {
  final AnalyticsService _analytics = AnalyticsService.instance;

  @override
  void initState() {
    super.initState();
    _sendClickstream('SCREEN_VIEWED', {});
  }

  void _sendClickstream(String eventName, Map<String, dynamic> additionalProps) {
    final baseProps = <String, dynamic>{
      'EP_PAGE_NAME':  'EXACT_PAGE_NAME_FROM_SHEET',
      'EP_EVENT_TYPE': eventName.contains('VIEWED') ? 'view' : 'click',
      // ... all other shared EP_* fields from the clickstream sheet
    };
    _analytics.track(eventName, {...baseProps, ...additionalProps});
  }

  void _handleButtonTap() {
    _sendClickstream('SCREEN_CLICKED', {
      'EP_CLICK_TYPE': 'button_click',
      'EP_SECTION':    'value_from_sheet',
    });
    // ... action
  }
}
```

PASS condition: recorded as "Enterprise wrapper — singleton injection — no additional wrapper created"

---

#### IF STANDARD FLUTTER:

- Use the analytics SDK plugin confirmed in Step 4 of `execution-flow.md`.
- Confirm the exact method name by scanning existing call sites first.
- A local `_sendClickstream()` method inside the State class is the recommended pattern.
- Null-safety: `value ?? 'NA'`.

**State pattern (standard Flutter):**
```dart
void _sendClickstream(String eventName, [Map<String, dynamic> additionalProps = const {}]) {
  final baseProps = <String, dynamic>{
    'EP_PAGE_NAME':  'SCREEN_NAME_FROM_SHEET',
    'EP_EVENT_TYPE': eventName.contains('VIEWED') ? 'view' : 'click',
    // ... all other shared EP_* fields from the clickstream sheet
  };
  analyticsPlugin.track(eventName, {...baseProps, ...additionalProps});
}
```

PASS condition: recorded as "Standard Flutter — `<confirmed dispatch method>`"

---

### GATE 3 — Exhaustive Widget Inventory

This gate is a **hard gate**. No implementation code may be written until this gate is PASSED.

**Step 3A — List all widget and service files**
- Recursively list all `.dart` files under `lib/`.
- Exclude: `*_test.dart`, generated files (`*.g.dart`, `*.freezed.dart`).
- Every file in this list MUST be opened and read in Step 3B.

**Step 3B — Classify every callback in each file**

| Classification | Description | Needs clickstream? |
|---|---|---|
| **SELF-EXECUTING** | Directly calls `Navigator.push/pop()`, `launch(url)`, API calls, or any navigation/external action | **YES — if matched to a sheet event** |
| **DELEGATING** | Callback body is ONLY `widget.onCallback()` or BLoC event with no direct side-effects | **NO — parent is responsible** |
| **MIXED** | Calls a parent callback AND also navigates or calls an API in the same body | **YES — fire clickstream before the direct action** |
| **LIFECYCLE / UTIL** | `initState`, `dispose`, `didUpdateWidget`, `build`, pure getters | **NO** |

> **Flutter Delegation Trap**: A GestureDetector `onTap` callback that calls `widget.onTap()` appears delegating, but if it ALSO calls `Navigator.push(...)` — it is **MIXED** and MUST fire clickstream.

**Step 3C — Coverage Table (mandatory output before any code is written)**

```
| File               | Callback           | Classification  | Sheet Event | Status  |
|--------------------|--------------------|-----------------|-------------|---------|
| home_screen.dart   | _handleCTATap      | SELF-EXECUTING  | EVENT_NAME  | MISSING |
| nav_widget.dart    | _handleNavTap      | MIXED           | EVENT_NAME  | DONE    |
| loader_widget.dart | (no interactive)   | —               | —           | N/A     |
```

Every file from Step 3A must have at least one row. No file may be silently skipped.

PASS condition: Coverage Table is complete; every SELF-EXECUTING / MIXED row with a sheet event is identified.

---

### GATE 4 — Review Existing Implementation

- Search all non-test `.dart` files for existing analytics dispatch calls.
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

## Flutter-Specific Implementation Rules

### VIEW Events — StatefulWidget
Fire VIEW events inside `initState` after `super.initState()`:
```dart
@override
void initState() {
  super.initState();
  WidgetsBinding.instance.addPostFrameCallback((_) {
    _sendClickstream('SCREEN_VIEWED', {});
  });
}
```

### VIEW Events — BLoC / Cubit
Dispatch the VIEW BLoC event inside `initState` or from the BLoC's constructor when the screen is created:
```dart
@override
void initState() {
  super.initState();
  context.read<ScreenCubit>().trackView();
}
```

### Navigator Observers
Do NOT add a new `NavigatorObserver` to track analytics. Reuse the existing observer pattern already configured in `MaterialApp` / `GoRouter`.

### GestureDetector / Button Handlers
Fire CLICK events inside `onTap`, `onPressed`, or equivalent callbacks — before the navigation or API call:
```dart
GestureDetector(
  onTap: () {
    _sendClickstream('SCREEN_CLICKED', {'EP_CLICK_TYPE': 'button_click'});
    Navigator.push(context, /* route */);
  },
)
```

### Provider / Riverpod
When analytics props come from a Provider or Riverpod notifier, read them via `ref.read(...)` or `context.read(...)` — do not create new providers solely for analytics:
```dart
final customerId = ref.read(userProvider).customerId;
// 'EP_CUSTOMER_ID': customerId ?? 'NA'
```

### Null-Safety
All dynamic field values must be null-safe before dispatch:
```dart
'EP_CUSTOMER_ID': customerId ?? 'NA',
'EP_PLATFORM':    Platform.isAndroid ? 'android' : 'ios',
```

### Static Field Values
- Copy exact strings from the clickstream sheet — case-sensitive.
- Do NOT create const maps or enums for static parameter values.

### File Discovery
```
lib/**/*.dart
Exclude: *_test.dart, *.g.dart, *.freezed.dart
```

---

## Key Violations to Detect

| Violation | Rule |
|---|---|
| New analytics service or singleton created on top of existing | FORBIDDEN — inject and use the existing analytics layer directly |
| Const map or enum used for clickstream parameter values | FORBIDDEN — use inline string literals |
| Dynamic field dispatched without null-safety | MUST be wrapped with `?? 'NA'` |
| Compliant existing call site overwritten | MUST be preserved |
| Clickstream fired inside a delegating-only callback | WRONG WIDGET — implement in parent instead |
| New NavigatorObserver created for analytics | FORBIDDEN — reuse the existing observer |