# Fix Rules

**Purpose**: Defines how auto-fixable and manual corrections must be applied to bring dispatch call sites to 100% compliance.
**Usage**: Referenced by SKILL.md Fix Rules section. Apply these rules during fix mode after audit results are available.

---

## Rule 1 — Read Before Modify

Always read and understand the current implementation before modifying anything. Never overwrite a compliant dispatch call. Preserve all valid existing implementations.

## Rule 2 — Auto-Fixable Issues (apply immediately)

| Issue | Action |
|---|---|
| MAPPING_ERROR (key casing) | Rename the key to match the sheet's exact casing. |
| INCORRECT_VALUE (static field) | Replace the observed value with `expectedValue` from the audit result — case-sensitive. |

These are applied directly without asking for user confirmation.

## Rule 3 — MISSING Static Field

Add the missing key with the exact static value from the clickstream sheet. Do not approximate or derive the value — copy it verbatim.

## Rule 4 — MISSING Dynamic Field

Source the value from the relevant service, store, or context (e.g. `UserService`, `AppState`, route params).
Wrap with the null-safety pattern already used in the project (e.g. `value ?? 'NA'`, `nullHandling(value, 'NA')`).

## Rule 5 — No Dispatch Call (not implemented at all)

Implement the full event from scratch by mirroring the pattern extracted in Step 6 (Review existing implementation).
Use the locked dispatch method. Include all parameters from the clickstream sheet.

## Rule 6 — Compliant Calls

MUST NOT be touched or overwritten. If a call site already has `"finalComplianceStatus": "PASS"`, skip it entirely.

## Rule 7 — Partial Implementations

MUST be completed — never leave an incomplete parameter set. If a call is partially compliant, add the missing fields while preserving all existing correct fields.

## Rule 8 — Scope

Every component, screen, and widget mapped in the clickstream sheet must be covered.
No file may be skipped without an explicit N/A entry in the Coverage Table.
Do not mark the task complete until every in-scope component shows `"finalComplianceStatus": "PASS"`.
