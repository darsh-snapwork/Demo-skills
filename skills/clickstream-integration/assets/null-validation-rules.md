# Null Validation Rules

**Purpose**: Defines detection logic for NULL, EMPTY, and dynamic-field violations across all supported platforms.
**Usage**: Optional supplementary reference — the skill derives all validation rules from the user-provided reference sheet at runtime. Load this file only if you need to understand or debug the underlying detection patterns.

---

## Detection Rules

### NULL Rule
A field is NULL when its value in source code is a null literal.
The parameter key format is read from the clickstream sheet — do NOT assume any prefix.

```typescript
// TypeScript / JavaScript / Dart
<PARAM_KEY>: null       // → NULL violation
<PARAM_KEY>: undefined  // → NULL violation (JS/TS only)
```
```kotlin
// Kotlin
eventProps["<PARAM_KEY>"] = null  // → NULL violation
```
```swift
// Swift
eventProps["<PARAM_KEY>"] = nil   // → NULL violation
```

Detection pattern (covers all platforms — substitute `<PARAM_KEY_PATTERN>` with the actual key format from the clickstream sheet):
```
/<PARAM_KEY_PATTERN>["']?\s*(:|to|=)\s*(null|undefined|nil)\b/g
```

---

### EMPTY Rule
A field is EMPTY when its value is an empty string literal or whitespace-only.
The parameter key format is read from the clickstream sheet — do NOT assume any prefix.

```
<PARAM_KEY>: ""    // → EMPTY violation
<PARAM_KEY>: ''    // → EMPTY violation
<PARAM_KEY>: "  "  // → EMPTY violation (whitespace only)
```

Detection pattern (substitute `<PARAM_KEY_PATTERN>` with the actual key format from the clickstream sheet):
```
/<PARAM_KEY_PATTERN>["']?\s*(:|to|=)\s*['"]\s*['"]/g
```

---

### Dynamic Field Rule
Dynamic fields (any field marked `dynamic` in the reference sheet):
- Validated for **structural presence** only (key must exist in the props object)
- Value resolved at runtime — cannot be statically evaluated
- Do NOT assert runtime value content for dynamic fields
- Flag as MISSING if the key is absent from the props object

Examples of valid dynamic-field patterns (platform-specific, `<PARAM_KEY>` from your sheet):
```typescript
// TypeScript / JavaScript
<PARAM_KEY>: runtimeValue ?? 'NA'
<PARAM_KEY>: nullHandling(runtimeValue, 'NA')
```
```kotlin
// Kotlin
eventProps["<PARAM_KEY>"] = runtimeValue ?: "NA"
```
```swift
// Swift
eventProps["<PARAM_KEY>"] = runtimeValue ?? "NA"
```
```dart
// Dart
'<PARAM_KEY>': runtimeValue ?? 'NA',
```
→ All are structurally present. Not a NULL/EMPTY violation.

---

### Static Field Rule
Static fields must exactly match their expected value (case-sensitive).
All expected values are read from the clickstream sheet at runtime — never hardcoded here.

```typescript
// Values below are placeholders — always use your sheet's values
<PARAM_KEY>: "<expected_value>"   // PASS: exact match
<PARAM_KEY>: "<wrong_casing>"     // FAIL: INCORRECT_VALUE (auto-fixable)
<PARAM_KEY>: ""                   // FAIL: EMPTY violation
<PARAM_KEY>: null                 // FAIL: NULL violation
```

Detection: compare extracted literal value against the clickstream sheet value using case-sensitive string equality.

---

### False Positive Avoidance

Do NOT flag the following as violations:

| Pattern | Reason |
|---|---|
| `value ?? "NA"` | Null-safe — structurally present |
| `value \|\| "NA"` | Null-safe — structurally present |
| `value ?: "NA"` (Kotlin) | Null-safe — structurally present |
| `nullHandling(value, "NA")` | Project null-safety utility — structurally present |
| `"NA"` as a literal fallback | Valid non-empty fallback — not an EMPTY violation |
| Extra fields not in reference sheet | Out of scope — do NOT flag |
| Platform-conditional field absent in non-matching context | Expected — do NOT flag |
