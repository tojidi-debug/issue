# Action Bar and Export Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the page header, add a one-line capsule action bar, and export every populated review cell with 10pt Hamchorom Dotum styling.

**Architecture:** Keep analysis and export data unchanged. Add explicit state-reset handlers in the page, update only the action-bar CSS and font stack, and apply a shared workbook cell style during sheet creation.

**Tech Stack:** React 19, TypeScript, SheetJS, Vitest, CSS, GitHub Pages

## Global Constraints

- Remove the audit-team-specific subtitle.
- Keep `대사 실행`, `Clear`, and `새로고침` on one line.
- Clear resets files, results, warnings, progress, and filters.
- Every populated exported cell uses 10pt `함초롬돋움`.
- Preserve both sheets, all columns, filters, freeze panes, and filename.

---

### Task 1: Workbook default cell style

**Files:**
- Modify: `tests/export-xlsx.test.ts`
- Modify: `lib/export-xlsx.ts`

**Interfaces:**
- Consumes: worksheet range and populated cells created by `json_to_sheet`
- Produces: `applyDefaultCellStyle(sheet: XLSX.WorkSheet): void`

- [ ] Add a failing test that reads with `cellStyles: true` and expects `A1` and `T2` to expose font name `함초롬돋움` and size `10`.
- [ ] Run `npm test -- tests/export-xlsx.test.ts` and confirm the new assertion fails.
- [ ] Iterate every populated cell in `sheet["!ref"]` and assign the shared 10pt font style.
- [ ] Run the focused test and full suite.
- [ ] Commit `lib/export-xlsx.ts` and `tests/export-xlsx.test.ts`.

### Task 2: General action bar and deployment

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `clearWorkspace(): void`
- Produces: `refreshWorkspace(): void`

- [ ] Remove the `서석감사반 수임실적 대사` subtitle.
- [ ] Add `clearWorkspace` to reset queue, progress, processing, analysis, warnings, year, risk, and query.
- [ ] Add a one-line action bar containing `대사 실행`, `Clear`, and `새로고침`.
- [ ] Apply a compact navy capsule style and the requested Korean font stack.
- [ ] Run tests, lint, Pages build, and visual browser verification.
- [ ] Commit, push, merge, wait for Pages deployment, and verify HTTP 200.
