# Naming Conventions

**Purpose**: Parameter naming and casing rules enforced by this skill.
**Usage**: Optional supplementary reference — the skill applies these rules automatically at runtime. Load this file only if you need to understand or debug naming violation detection.

> **Key distinction**: Two layers of naming exist in every analytics implementation.
> This skill validates **Layer 1 only** (payload key strings). Layer 2 is out of scope.
>
> | Layer | What it is | Who controls it | Validated? |
> |---|---|---|---|
> | **Layer 1 — Payload key strings** | String keys sent in the event payload (e.g. `"EP_PAGE_NAME"`, `"event_page_name"`) | The clickstream sheet | **Yes** |
> | **Layer 2 — Code variable names** | Variable/property names in surrounding code | Platform language convention | **No** |

---

## Rule 1 — Payload Key Strings Follow the Reference Sheet Format

Payload key strings must match the reference sheet exactly — character-for-character and case-for-case. The sheet is the authority; no format is assumed.

```
OK:   "EP_PRODUCT_NAME"   (matches sheet)
OK:   "EP_PAGE_LOAD"      (matches sheet)
FAIL: "ep_product_name"   (lowercase — does not match)
FAIL: "epProductName"     (camelCase — does not match)
FAIL: "Ep_Product_Name"   (mixed case — does not match)
```

Detection: Key doesn't match sheet format → `MAPPING_ERROR` (auto-fixable).

---

## Rule 2 — Static Field Values Are Case-Sensitive

Static field values must match the reference sheet exactly. No trimming or normalization.

```
Reference sheet says: "Gold Loan"
Code has:             "gold-loan"  ← INCORRECT_VALUE, auto-fixable

EP_EVENT_TYPE expected "view"  → "View" / "VIEW" all FAIL
EP_EVENT_TYPE expected "click" → "Click" / "CLICK" all FAIL
```

---

## Rule 3 — Event Name Format

Event names must follow the pattern in the reference sheet. Derive casing, separators, and prefix by inspecting the sheet's event name column.

- Event names are `UPPER_SNAKE_CASE` — lowercase is always a violation
- Project-specific prefix (e.g. `GL_`, `PL_`) — read from sheet, do NOT assume
- Action suffixes (`_VIEWED`, `_CLICKED`) determine the event type value

```
OK:   GL_HOMEPAGE_VIEWED    OK:   GL_HOMEPAGE_CLICKED
FAIL: gl_homepage_viewed    FAIL: GL_HOMEPAGE_VIEW  (missing D)
```

---

## Rule 4 — Event Type Derivation

Derive from event name suffix (or explicit column in sheet). Default mapping:

| Event name contains | Event type |
|---|---|
| `VIEWED` or `LOADED` | `"view"` |
| `CLICKED` or `SUBMITTED` | `"click"` |
| Other | Use sheet value or flag for manual review |

Platform patterns (substitute key name from your sheet):

```typescript
// Angular / React / React Native / Vue
EP_EVENT_TYPE: eventName.includes("VIEWED") ? "view" : "click"
```
```kotlin
// Android
eventProps["EP_EVENT_TYPE"] = if (eventName.contains("VIEWED")) "view" else "click"
```
```swift
// iOS
eventProps["EP_EVENT_TYPE"] = eventName.contains("VIEWED") ? "view" : "click"
```
```dart
// Flutter
'EP_EVENT_TYPE': eventName.contains('VIEWED') ? 'view' : 'click'
```

---

## Platform Code Variable Naming (Layer 2 — NOT validated)

| Platform | Language | Variable style | Example |
|---|---|---|---|
| Angular / React / Vue | TypeScript / JS | UPPER_SNAKE_CASE | `const EP_PAGE_NAME = pageName;` |
| Android | Kotlin / Java | camelCase | `val epPageName = pageName` |
| iOS | Swift / ObjC | camelCase | `let epPageName = pageName` |
| Flutter | Dart | camelCase | `final epPageName = pageName;` |
| React Native | TypeScript | either | — |

The **payload key string** always matters — it must match the sheet regardless of variable naming.

---

## Violation Reference

| Category | Auto-Fixable | Description |
|---|---|---|
| `MAPPING_ERROR` | Yes | Payload key casing/spelling doesn't match sheet |
| `INCORRECT_VALUE` | Yes | Static field value doesn't match sheet |
| `MISSING` | No | Required field key absent from code |
| `NULL` | No | Field set to `null` / `undefined` / `nil` |
| `EMPTY` | No | Field set to `""` |
| `UNKNOWN_EVENT` | No | Event name not found in reference sheet |

