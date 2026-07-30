# Compact Review Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the independence-review screen as a compact white workspace where files are attached on the left and every candidate is visible in one always-expanded row on the right.

**Architecture:** Keep all parsing, matching, analysis, filtering, and export behavior unchanged. Add one pure presentation helper for stable reason colors, then reshape `app/page.tsx` into a compact two-column workspace and replace the legacy stylesheet with a restrained responsive ledger layout.

**Tech Stack:** React 19, TypeScript, Vite/Vinext, Vitest, CSS with OKLCH colors, GitHub Pages

## Global Constraints

- PDF, XLS, XLSX, and CSV files continue to be processed only in the browser.
- Existing independence analysis, filtering, and Excel export behavior must not change.
- Every candidate exposes all existing 13 values without click, expansion, or navigation.
- Same review reasons use the same very light pastel row color.
- Desktop minimizes page scrolling; long result sets scroll inside the white result region.
- Mobile preserves every field and function.

---

### Task 1: Stable reason-tone classification

**Files:**
- Create: `lib/presentation.ts`
- Create: `tests/presentation.test.ts`

**Interfaces:**
- Consumes: `ReviewCandidate["serviceClass"]` and `ReviewCandidate["issue"]`
- Produces: `getReasonTone(candidate: Pick<ReviewCandidate, "serviceClass" | "issue">): "accounting" | "bookkeeping" | "valuation" | "consulting" | "neutral"`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { getReasonTone } from "../lib/presentation";

describe("getReasonTone", () => {
  it.each([
    ["재무제표 작성지원", "수정분개 제시", "accounting"],
    ["기장", "기업진단과 기장 동시수행", "bookkeeping"],
    ["가치평가", "주요 자산 양수도", "valuation"],
    ["재무영향 컨설팅", "추가 확인", "consulting"],
  ] as const)("%s uses %s tone", (serviceClass, issue, expected) => {
    expect(getReasonTone({ serviceClass, issue })).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- tests/presentation.test.ts`
Expected: FAIL because `lib/presentation.ts` does not exist.

- [ ] **Step 3: Implement the pure classifier**

```ts
import type { ReviewCandidate } from "./domain";

export type ReasonTone = "accounting" | "bookkeeping" | "valuation" | "consulting" | "neutral";

export function getReasonTone(
  candidate: Pick<ReviewCandidate, "serviceClass" | "issue">,
): ReasonTone {
  const value = `${candidate.serviceClass} ${candidate.issue}`;
  if (/재무제표|회계자문|수정분개|기장대행|작성지원/.test(value)) return "accounting";
  if (/기장|기업진단/.test(value)) return "bookkeeping";
  if (/가치평가|valuation|양수도/i.test(value)) return "valuation";
  if (/컨설팅|자문|용역/.test(value)) return "consulting";
  return "neutral";
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- tests/presentation.test.ts`
Expected: all presentation tests pass.

Run: `npm test`
Expected: all existing and new tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/presentation.ts tests/presentation.test.ts
git commit -m "add stable review reason tones"
```

---

### Task 2: Compact single-screen workspace

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: existing `QueueItem`, `AnalysisResult`, `ReviewCandidate`, `processFiles`, filtering, and export functions
- Produces: compact `FileDropzone`, `Summary`, and `ReviewTable` presentation using `getReasonTone`

- [ ] **Step 1: Replace the masthead and workflow sections**

Build a `compact-header` with only the title and local-processing note. Place both file dropzones and the run button in a single `input-panel`; place the analysis empty state or results in a sibling `result-panel`.

- [ ] **Step 2: Compact file controls**

Use the labels `기준자료` and `구성원 매출장`, the helper `PDF · Excel · CSV`, and the action `파일 선택`. Keep drag-and-drop, multi-file selection, status, count, removal, and warning behavior unchanged.

- [ ] **Step 3: Replace the 13-column table with five grouped columns**

For each `ReviewCandidate`, render exactly one `<tr>` with:

```tsx
<tr className={`reason-${getReasonTone(row)}`}>
  <td>{/* risk, targetKind, matchedCompany */}</td>
  <td>{/* year, date, accountant, sourceLocation */}</td>
  <td>{/* memo, amount, serviceClass */}</td>
  <td>{/* issue, matchBasis */}</td>
  <td>{/* note */}</td>
</tr>
```

Do not add accordions, disclosure buttons, modals, or detail routes.

- [ ] **Step 4: Keep filters and export compact**

Show the five summary counts as inline pills, then year, risk, and text filters on one toolbar. Keep `매출 확인.xlsx` export on the same row as the result title.

- [ ] **Step 5: Run verification**

Run: `npm test`
Expected: all tests pass.

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "build compact review workspace"
```

---

### Task 3: White ledger styling and public deployment

**Files:**
- Modify: `app/globals.css`
- Modify: `.impeccable.md`

**Interfaces:**
- Consumes: class names introduced in `app/page.tsx`
- Produces: white responsive two-column workspace and restrained reason-tone rows

- [ ] **Step 1: Replace the legacy visual system**

Use a near-white page, thin blue-gray dividers, 56px compact header, 300–340px input panel, and a flexible result panel. Remove the decorative mark, rule strip, large intro copy, gradients, shadows, and dark table header.

- [ ] **Step 2: Add pastel reason rows**

```css
.reason-accounting td { background: oklch(0.96 0.025 235); }
.reason-bookkeeping td { background: oklch(0.975 0.006 248); }
.reason-valuation td { background: oklch(0.965 0.025 165); }
.reason-consulting td { background: oklch(0.97 0.025 70); }
.reason-neutral td { background: var(--surface); }
```

Keep risk labels textual and compact; do not use strong full-row red or yellow.

- [ ] **Step 3: Constrain scrolling**

Use `min-height: 0` through the workspace/result hierarchy, `overflow: auto` only on the table shell, and a light scrollbar. On narrow screens, stack panels and preserve horizontal table access only inside the result region.

- [ ] **Step 4: Update design context**

Record the compact white workspace, grouped ledger rows, no progressive disclosure, and reason-based pastel mapping in `.impeccable.md`.

- [ ] **Step 5: Run all checks**

Run: `npm test`
Expected: all tests pass.

Run: `npm run lint`
Expected: zero errors.

Run: `npm run build:pages`
Expected: `pages-dist/index.html` and bundled assets are generated successfully.

- [ ] **Step 6: Commit and publish**

```bash
git add app/globals.css .impeccable.md
git commit -m "polish compact review ledger"
git push -u origin agent/compact-review-ledger
```

Open and merge a pull request into `main`, wait for the `Deploy GitHub Pages` workflow, then verify:

```bash
curl.exe -I -L https://tojidi-debug.github.io/issue/
```

Expected: `HTTP/1.1 200 OK` with no authentication redirect.
