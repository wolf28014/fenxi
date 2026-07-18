# Table Column Visibility Design

## Scope

Add independent column visibility controls to the daily sales, monthly sales summary, and cost detail tables in `DetailView`.

## Interaction

- Place a `列设置` button at the right side of each table toolbar, visually above the `操作` column.
- Open a compact popover containing checkbox controls for optional columns.
- Provide `全选` and `恢复默认` actions.
- Close the popover when clicking outside or pressing Escape.
- Keep the row identifier, batch checkbox, and operation columns visible at all times.

## Column Groups

- Daily sales: basic metrics, current-period calculated metrics, and cumulative metrics.
- Monthly summary: basic metrics, current-month calculated metrics, and cumulative metrics.
- Cost details: individual cost fields and total.

## State

- Each table owns an independent visibility set.
- Persist settings in localStorage using versioned keys:
  - `ecom-columns-daily-v1`
  - `ecom-columns-monthly-v1`
  - `ecom-columns-cost-v1`
- Invalid or obsolete saved keys fall back to defaults.
- Default views preserve the current visible columns.

## Implementation Shape

- Add a reusable `ColumnVisibilityMenu` component for the popover UI.
- Add a small `useColumnVisibility` hook for validation, persistence, select-all, and reset behavior.
- Define each table's columns as metadata and render headers, body cells, and summary cells from the same filtered array.
- Keep existing formatting, warning colors, sorting, editing, deletion, and batch selection behavior unchanged.

## Responsive Behavior

- The menu is right-aligned to the toolbar button.
- It uses a bounded height with internal scrolling and a one- or two-column checkbox grid depending on available width.
- Hiding columns reduces horizontal scrolling without resizing visible columns unpredictably.

## Verification

- Every optional column can be toggled independently in all three tables.
- Headers, body cells, and summary cells remain aligned.
- Refreshing the page preserves each table's settings independently.
- Reset restores the original column set.
- Batch mode and row actions continue to work.
- Type checking, unit tests, and production build pass.
