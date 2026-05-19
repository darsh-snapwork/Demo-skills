# Event Mapping Rules

**Purpose**: Defines how events must map to parameters, and how event names determine event type values.
**Usage**: Optional supplementary reference — the skill derives all rules from the user-provided clickstream sheet at runtime. Load this file only if you need to understand or debug event type derivation.
**Project-configurable**: Event name prefixes, parameter key names, and naming conventions vary by project. The clickstream sheet is the authoritative source.

---

## Rule 1 — Event Name to Event Type Mapping

The event type value is derived from the event name suffix **or** an explicit column in the clickstream sheet.
**The sheet is the authoritative source — never assume which suffix maps to which value.**

How to derive the mapping at runtime:
1. Read all event names from the sheet
2. Identify the distinct suffixes (the segment after the last separator)
3. Read the corresponding event type value for each suffix from the sheet's event type column
4. Build the suffix → value map from the sheet; apply it to every dispatch call site

Implementation pattern (substitute `<VIEW_SUFFIX>`, `<view_value>`, `<click_value>` from your sheet):
```
eventType = eventName.contains("<VIEW_SUFFIX>") ? "<view_value>" : "<click_value>"
```

---

## Rule 2 — Event Name Format

Event names follow a project-specific pattern defined in the clickstream sheet.
**Do NOT assume any fixed prefix, suffix, casing, or separator convention.**

Derive the full event name format — including structure, casing, and separators — by inspecting the event name column in the clickstream sheet.

---

## Rule 3 — Static Field Invariants

Certain parameters have fixed values that never change per event — they describe the product or property context.
These are project-specific and always defined in the clickstream sheet under `Type = static`.

**Always derive expected static values from the clickstream sheet. Never hardcode values from another project.**

---

## Rule 4 — Platform-Conditional Fields

Some fields only appear in specific platform contexts (web, app, etc.).
Absence of these fields in the non-matching platform context is NOT a violation.
The clickstream sheet should document which fields are platform-conditional.

---

## Rule 5 — Props Merge / Override

When a call site passes extra props, they override base props for the same key.
The merged set of keys is what is validated, not the base props alone.
