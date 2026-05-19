# Audit Example — Full Worked Scenario

> **Note**: This example uses the Gold Loan Angular PWA project as a reference.
> The same workflow (validate → compare → fix → revalidate) applies to any project and platform.
> Replace paths, event names, and field values with those from your project's reference sheet.

**Platform**: Angular
**Component**: `personal-details.component.ts` (Gold Loan example)
**Event**: `GL_HOMEPAGE_VIEWED`

---

## Step 1 — Audit (validate-clickstream.js)

**Command**:
```bash
node .github/skills/clickstream-integration/scripts/validate-clickstream.js \
  --file projects/remote-app-rgl/src/app/features/gold-loan-s4s2/etg/personal-details/personal-details.component.ts \
  --reference <your-reference-sheet>
```

**Audit JSON output (abbreviated)**:
```json
{
  "auditTimestamp": "2026-04-29T10:00:00.000Z",
  "platform": "angular",
  "results": [
    {
      "component": "PersonalDetailsComponent",
      "componentFile": "projects/remote-app-rgl/.../personal-details.component.ts",
      "eventName": "GL_HOMEPAGE_VIEWED",
      "finalComplianceStatus": "MANUAL_REVIEW",
      "missingParameters": [
        "EP_CUSTOMER_TYPE", "EP_LANG", "EP_SPRINT", "EP_CAMPAIGN",
        "EP_LOAD_TYPE", "EP_DATA_PRE_FILLED", "EP_CT_ID", "EP_DEVICE_ID",
        "EP_LEAD_ID", "EP_PINCODE", "EP_TRACKER", "EP_LOAD_TIME",
        "EP_NUDGE_VALUE", "EP_LAST_CLICK"
      ],
      "incorrectParameters": [
        { "field": "EP_PRODUCT_CATEGORY", "observed": "Loans", "expected": "loans" }
      ],
      "nullParameters": [],
      "emptyParameters": [],
      "mappingIssues": [],
      "recommendedFixes": [
        "Change EP_PRODUCT_CATEGORY from \"Loans\" to \"loans\" (case-sensitive match required).",
        "Add EP_CUSTOMER_TYPE to baseProps. Use nullHandling(value, \"NA\") for runtime value.",
        "Add EP_LANG to baseProps. Use nullHandling(value, \"NA\") for runtime value.",
        "..."
      ]
    }
  ],
  "summary": {
    "totalComponents": 1,
    "compliantCount": 0,
    "failCount": 0,
    "manualReviewCount": 1,
    "totalFindings": 15,
    "findingsByCategory": {
      "MISSING": 14,
      "NULL": 0,
      "EMPTY": 0,
      "INCORRECT_VALUE": 1,
      "MAPPING_ERROR": 0,
      "UNKNOWN_EVENT": 0
    }
  }
}
```

---

## Step 2 — Compare Mappings (compare-mappings.js)

**Command**:
```bash
node .github/skills/clickstream-integration/scripts/compare-mappings.js \
  --audit audit-result.json \
  --reference <your-reference-sheet> \
  --output markdown
```

**Diff report (abbreviated)**:

| Diff Type | Field | Observed | Expected | Auto-Fixable |
|---|---|---|---|---|
| INCORRECT_VALUE | `EP_PRODUCT_CATEGORY` | `"Loans"` | `"loans"` | Yes |
| MISSING | `EP_CUSTOMER_TYPE` | *(absent)* | *dynamic* | No |
| MISSING | `EP_LANG` | *(absent)* | *dynamic* | No |
| MISSING | `EP_SPRINT` | *(absent)* | *dynamic* | No |
| MISSING | `EP_CAMPAIGN` | *(absent)* | *dynamic* | No |
| MISSING | `EP_LOAD_TYPE` | *(absent)* | *dynamic* | No |
| MISSING | `EP_DATA_PRE_FILLED` | *(absent)* | *dynamic* | No |
| MISSING | `EP_CT_ID` | *(absent)* | *dynamic* | No |
| MISSING | `EP_DEVICE_ID` | *(absent)* | *dynamic* | No |
| MISSING | `EP_LEAD_ID` | *(absent)* | *dynamic* | No |
| MISSING | `EP_PINCODE` | *(absent)* | *dynamic* | No |
| MISSING | `EP_TRACKER` | *(absent)* | *dynamic* | No |

---

## Step 3 — Fix Recommendations

### Finding 1: INCORRECT_VALUE — EP_PRODUCT_CATEGORY

**Category**: INCORRECT_VALUE  
**Auto-Fixable**: Yes  
**Component**: `personal-details.component.ts`  
**Line**: Inside `sendClickstream()` → `const baseProps = { ... }`

## Recommendation

Change `EP_PRODUCT_CATEGORY` to use lowercase `"loans"` to match the client reference sheet exactly.

Reference: the user-provided reference sheet

## Code Suggestion

**Before:**
```typescript
const baseProps = {
  // ...
  EP_PRODUCT_CATEGORY: "Loans",
  // ...
};
```

**After:**
```typescript
const baseProps = {
  // ...
  EP_PRODUCT_CATEGORY: "loans",
  // ...
};
```

---

### Finding 2: MISSING — EP_CUSTOMER_TYPE

**Category**: MISSING  
**Auto-Fixable**: No (requires developer to identify data source)  
**Component**: `personal-details.component.ts`

## Recommendation

Add `EP_CUSTOMER_TYPE` to `baseProps`. This is a required field in the client reference sheet.
Determine whether the value is available from `rglStorage.customerDtls` or `parentStorage`.
Common values: `ETB` (existing to bank), `PTB` (pre-to-bank), `NTB` (new to bank).

Reference: the user-provided reference sheet

## Code Suggestion

```typescript
const baseProps = {
  // ... existing fields ...
  EP_CUSTOMER_TYPE: this.apiIntgServ.nullHandling(this.rglStorage?.customerType, 'NA'),
  // ...
};
```

---

### Finding 3: MISSING — EP_LANG

**Category**: MISSING  
**Auto-Fixable**: No  
**Component**: `personal-details.component.ts`

## Recommendation

Add `EP_LANG` to `baseProps`. Use the app's active language.
Reference: the user-provided reference sheet

## Code Suggestion

```typescript
const baseProps = {
  // ... existing fields ...
  EP_LANG: this.apiIntgServ.nullHandling(this.translate?.currentLang, 'NA'),
  // ...
};
```

---

## Step 4 — Revalidate

After applying fixes, re-run `validate-clickstream.js` to confirm 0 violations.

**Command**:
```bash
node .github/skills/clickstream-integration/scripts/validate-clickstream.js \
  --file projects/remote-app-rgl/src/app/features/gold-loan-s4s2/etg/personal-details/personal-details.component.ts \
  --reference <your-reference-sheet>
```

**Expected result**: `"finalComplianceStatus": "PASS"` and exit code `0`.
