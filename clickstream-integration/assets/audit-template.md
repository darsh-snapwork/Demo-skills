# Audit Report Template

**Usage**: Optional supplementary reference — defines the output format for audit reports. The skill outputs the Post-Execution Summary directly in chat. This template is available if a structured Markdown report file is also needed.
**Output by**: `validate-clickstream.js` (JSON) + `compare-mappings.js` (Markdown)

---

## Clickstream Audit Report

**Project**: `{{project_name}}`
**Feature / Journey**: `{{feature_name}}`
**Component / Screen**: `{{component_name}}`
**File**: `{{component_file}}`
**Audit Date**: `{{audit_date}}`
**Platform**: `{{platform}}`

---

## Event: `{{event_name}}`

**Compliance Status**: `{{PASS | FAIL | MANUAL_REVIEW}}`

### Missing Parameters

| Parameter | Expected Value | Auto-Fixable |
|---|---|---|
{{#each missing_parameters}}
| `{{this}}` | `{{expected_value}}` | `{{auto_fixable}}` |
{{/each}}

### Incorrect Values

| Parameter | Observed | Expected | Auto-Fixable |
|---|---|---|---|
{{#each incorrect_parameters}}
| `{{field}}` | `{{observed}}` | `{{expected}}` | Yes |
{{/each}}

### Null / Empty Parameters

| Parameter | Issue | Auto-Fixable |
|---|---|---|
{{#each null_empty_parameters}}
| `{{this}}` | `{{issue_type}}` | No |
{{/each}}

### Mapping Issues

| Field | Issue |
|---|---|
{{#each mapping_issues}}
| `{{field}}` | `{{issue}}` |
{{/each}}

---

## Recommended Fixes

{{#each recommended_fixes}}
- {{this}}

---

## Post-Execution Summary (Chat Output)

Output this summary in chat after every run — do NOT write to a file.

```
## Clickstream Integration — Summary

| # | Item | Detail |
|---|---|---|
| 1 | Platform | <platform> |
| 2 | Mode | audit / fix |
| 3 | Clickstream sheet | <file name> |
| 4 | Analytics tool | <tool> — <dispatch method> (auto-detected / user-selected) |
| 5 | Pre-existing implementation | Yes — <method> / No |
| 6 | Files scanned | <count> |
| 7 | Events in sheet | <count> |
| 8 | MISSING | <count> |
| 9 | NULL/EMPTY | <count> |
| 10 | INCORRECT_VALUE | <count> |
| 11 | MAPPING_ERROR | <count> |
| 12 | Changes applied | <count> auto-fixed / <count> manual |
| 13 | Still needs manual review | <item> / None |
| 14 | **Final Status** | **PASS / FAIL / MANUAL_REVIEW** |

### Coverage Table
<paste the Step 7C Coverage Table here — every file must appear>
```
{{/each}}

---

## Summary

| Metric | Value |
|---|---|
| Total components audited | `{{total_components}}` |
| Compliant | `{{compliant_count}}` |
| Violations found | `{{fail_count}}` |
| Manual review required | `{{manual_review_count}}` |
| Total findings | `{{total_findings}}` |

| Finding Category | Count |
|---|---|
| MISSING | `{{missing_count}}` |
| INCORRECT_VALUE | `{{incorrect_count}}` |
| NULL | `{{null_count}}` |
| EMPTY | `{{empty_count}}` |
| MAPPING_ERROR | `{{mapping_error_count}}` |
| UNKNOWN_EVENT | `{{unknown_event_count}}` |
