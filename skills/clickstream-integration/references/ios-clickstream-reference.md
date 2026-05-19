# Platform Reference: iOS (Swift / Objective-C)

**Load this reference only when**: iOS Swift or Objective-C UIViewController, SwiftUI View, or UIKit screen validation.
**Do NOT load** for Angular, React, Android, Flutter, or React Native tasks.

---

## When to Use

Load this reference when:
- Auditing iOS `.swift` or `.m` files for clickstream compliance
- Scanning analytics dispatch call sites in ViewControllers, SwiftUI Views, or ViewModels
- Implementing the `sendClickstream()` helper pattern in iOS screens
- Understanding iOS-specific insertion points for analytics events

---

## MANDATORY GATES — DO NOT SKIP — MUST COMPLETE IN ORDER

These steps are **strictly sequential**. Each step is a hard gate.
**Do NOT write any implementation code until ALL gates are PASSED.**

---

### SDK ABSENCE — HARD BLOCKING CONDITION

If no analytics SDK or analytics wrapper exists in the iOS project:

- **DO NOT** generate a new AnalyticsManager or analytics helper
- **DO NOT** generate a new analytics wrapper
- **DO NOT** create UINavigationController delegate-based screen tracking
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

Always reuse the existing analytics SDK, manager, dispatch pattern, and ViewModel/Coordinator architecture already present in the iOS project. Never replace, recreate, or wrap existing analytics infrastructure with new layers.

---

### GATE 1 — Detect Analytics Wrapper Type

iOS projects use one of two patterns:

| Type | Indicator |
|---|---|
| **Enterprise wrapper** | Project has a centralized `AnalyticsManager`, `AnalyticsService`, or a shared module that ViewControllers/Views call for analytics. |
| **Standard iOS** | ViewControllers/Views call the analytics SDK directly with no intermediary manager. |

Detection:
- Check `Podfile` / `Package.swift` for any analytics SDK dependency.
- Search all `.swift`/`.m` source files (excluding `*Tests.swift`, `*Spec.swift`) for analytics manager class names or dispatch call signatures.

Record the classification explicitly before proceeding.

PASS condition: analytics wrapper type is recorded.

---

### GATE 2 — Lock the Dispatch Strategy

> **Enterprise wrapper path and standard iOS path are completely separate. Never mix patterns.**

#### IF ENTERPRISE WRAPPER:

- **Inject the existing analytics manager** into every ViewController/View that fires an event.
- **DO NOT create any additional manager or helper** on top of the existing analytics layer.
- **DO NOT invent constant dictionaries or enums** for parameter values. All values must be **inline string literals** exactly as written in the clickstream sheet.
- Null-safety: use the wrapper's built-in null-safety helper or Swift's `??` operator.

**UIViewController pattern (enterprise wrapper — Swift):**
```swift
class MyViewController: UIViewController {
  private let analyticsManager = AnalyticsManager.shared

  override func viewDidLoad() {
    super.viewDidLoad()
    sendClickstream(eventName: "SCREEN_VIEWED")
  }

  private func sendClickstream(eventName: String, additionalProps: [String: Any] = [:]) {
    var baseProps: [String: Any] = [
      "EP_PAGE_NAME":  "EXACT_PAGE_NAME_FROM_SHEET",
      "EP_EVENT_TYPE": eventName.contains("VIEWED") ? "view" : "click",
      // ... all other shared EP_* fields from the clickstream sheet
    ]
    baseProps.merge(additionalProps) { _, new in new }
    analyticsManager.dispatch(eventName, props: baseProps)
  }

  @IBAction func handleButtonTap(_ sender: UIButton) {
    sendClickstream(eventName: "SCREEN_CLICKED", additionalProps: [
      "EP_CLICK_TYPE": "button_click",
      "EP_SECTION":    "value_from_sheet"
    ])
    // ... action
  }
}
```

PASS condition: recorded as "Enterprise wrapper — shared manager — no additional wrapper created"

---

#### IF STANDARD iOS:

- Use the analytics SDK confirmed in Step 4 of `execution-flow.md`.
- Confirm the exact method name by scanning existing call sites first.
- A private `sendClickstream()` helper inside the ViewController is the recommended pattern.
- Null-safety: `value ?? "NA"`.

**UIViewController pattern (standard iOS — Swift):**
```swift
private func sendClickstream(eventName: String, additionalProps: [String: Any] = [:]) {
  var baseProps: [String: Any] = [
    "EP_PAGE_NAME":  "SCREEN_NAME_FROM_SHEET",
    "EP_EVENT_TYPE": eventName.contains("VIEWED") ? "view" : "click",
    // ... all other shared EP_* fields from the clickstream sheet
  ]
  baseProps.merge(additionalProps) { _, new in new }
  analyticsSDK.track(eventName, parameters: baseProps)
}
```

**SwiftUI View pattern:**
```swift
struct MyView: View {
  var body: some View {
    VStack { /* ... */ }
      .onAppear {
        sendClickstream(eventName: "SCREEN_VIEWED")
      }
  }

  private func sendClickstream(eventName: String, additionalProps: [String: Any] = [:]) {
    // ... same baseProps + SDK call
  }
}
```

PASS condition: recorded as "Standard iOS — `<confirmed dispatch method>`"

---

### GATE 3 — Exhaustive Screen Inventory

This gate is a **hard gate**. No implementation code may be written until this gate is PASSED.

**Step 3A — List all screen and view files**
- Recursively list all `.swift` and `.m` files under the project source root.
- Exclude: `*Tests.swift`, `*Spec.swift`, `*Mock.swift`, generated files.
- Every file in this list MUST be opened and read in Step 3B.

**Step 3B — Classify every handler in each file**

| Classification | Description | Needs clickstream? |
|---|---|---|
| **SELF-EXECUTING** | Directly calls `navigationController?.push...`, `present(...)`, `coordinator.navigate(...)`, URL opening, API calls, or any navigation/external action | **YES — if matched to a sheet event** |
| **DELEGATING** | Handler only calls a delegate method or Combine subject with no direct navigation | **NO — delegate owner is responsible** |
| **MIXED** | Calls a delegate AND also navigates or calls an API in the same handler | **YES — fire clickstream before the direct action** |
| **LIFECYCLE / UTIL** | `viewDidLoad`, `viewWillAppear`, `onAppear`, pure data transformations | **NO** |

> **iOS Delegation Trap**: A `@IBAction` that calls `delegate?.didTapButton()` appears delegating, but if it ALSO calls `navigationController?.pushViewController(...)` — it is **MIXED** and MUST fire clickstream.

**Step 3C — Coverage Table (mandatory output before any code is written)**

```
| File                  | Handler              | Classification  | Sheet Event | Status  |
|-----------------------|----------------------|-----------------|-------------|---------|
| HomeViewController.swift | handleCTATap      | SELF-EXECUTING  | EVENT_NAME  | MISSING |
| TabBarController.swift   | handleTabTap      | MIXED           | EVENT_NAME  | DONE    |
| LoaderView.swift         | (no interactive)  | —               | —           | N/A     |
```

Every file from Step 3A must have at least one row. No file may be silently skipped.

PASS condition: Coverage Table is complete; every SELF-EXECUTING / MIXED row with a sheet event is identified.

---

### GATE 4 — Review Existing Implementation

- Search all non-test `.swift`/`.m` files for existing analytics dispatch calls.
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

## iOS-Specific Implementation Rules

### VIEW Events — UIViewController (UIKit)
Fire VIEW events in `viewDidLoad` for first-mount, or `viewWillAppear` / `viewDidAppear` when re-entry tracking is required:
```swift
override func viewDidLoad() {
  super.viewDidLoad()
  sendClickstream(eventName: "SCREEN_VIEWED")
}
```

### VIEW Events — SwiftUI View
Use `.onAppear` modifier on the root container:
```swift
.onAppear {
  sendClickstream(eventName: "SCREEN_VIEWED")
}
```

### Combine Integration
If analytics props are published via Combine, subscribe and dispatch once the value arrives — do not dispatch with uninitialized state:
```swift
viewModel.$userData
  .first(where: { $0 != nil })
  .sink { [weak self] data in
    self?.sendClickstream(eventName: "SCREEN_VIEWED", additionalProps: [
      "EP_CUSTOMER_ID": data?.customerId ?? "NA"
    ])
  }
  .store(in: &cancellables)
```

### Gesture Recognizers
Fire CLICK events inside gesture recognizer actions or button targets — before the navigation or API call:
```swift
@IBAction func handleButtonTap(_ sender: UIButton) {
  sendClickstream(eventName: "SCREEN_CLICKED", additionalProps: ["EP_CLICK_TYPE": "button_click"])
  navigationController?.pushViewController(nextVC, animated: true)
}
```

### Null-Safety
All dynamic field values must be null-safe before dispatch:
```swift
"EP_CUSTOMER_ID": customerId ?? "NA"
"EP_PLATFORM":    "app"
```

### Static Field Values
- Copy exact strings from the clickstream sheet — case-sensitive.
- Do NOT create constant dictionaries, enums, or structs for static parameter values.

### File Discovery
```
<module>/**/*.{swift,m}
Exclude: *Tests.swift, *Spec.swift, *Mock.swift, generated/
```

---

## Key Violations to Detect

| Violation | Rule |
|---|---|
| New analytics manager or helper created on top of existing | FORBIDDEN — inject and use the existing analytics layer directly |
| Constant dictionary, enum, or struct used for clickstream parameter values | FORBIDDEN — use inline string literals |
| Dynamic field dispatched without null-safety | MUST be wrapped with `?? "NA"` |
| Compliant existing call site overwritten | MUST be preserved |
| Clickstream fired inside a delegating-only handler | WRONG SCREEN — implement in the correct owner |
| VIEW event placed in `@IBAction` instead of `viewDidLoad`/`viewWillAppear`/`.onAppear` | INCORRECT — VIEW must fire in lifecycle, not on interaction |