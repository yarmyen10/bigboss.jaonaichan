# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Admin dashboard for WooCommerce order management, built on the **TailAdmin** React template. The backend is a WordPress site at `jaonaichan.com` exposed via WP-REST + custom JWT auth — this app is a pure frontend SPA that talks to that REST API.

## Commands

```bash
npm run dev         # Vite dev server
npm run build       # tsc -b || true && vite build  — TS errors do NOT fail the build
npm run type-check  # tsc --noEmit  — use THIS to verify types before committing
npm run lint        # eslint .
npm run preview     # preview production build
```

There is no test runner configured.

## Environment variables

Vite is configured (`vite.config.ts`) with `envPrefix: ['VITE_', 'JAONAICHAN_']`, so env vars prefixed `JAONAICHAN_` are exposed to client code via `import.meta.env`. Required in `.env`:

```
JAONAICHAN_API_URL=https://jaonaichan.com/wp-json
JAONAICHAN_PREFIX=bigboss                # localStorage key prefix
```

`.env` is gitignored; the values above are the current dev defaults.

## Architecture

### Request layer: `src/api/` → `src/services/` → pages

- `src/api/auth.ts` — JWT sign-in against `/jwt-auth/v1/token`; stores token under `${PREFIX}Token` and a `BigBossUser` JSON under `${PREFIX}User` in localStorage.
- `src/api/client.ts` — single `apiRequest<T>()` fetch wrapper. Injects `Authorization: Bearer <token>`, and on **403** calls `signOut()` and hard-redirects to `/signin`. All network calls must go through this.
- `src/services/jaonaichan.ts` — typed endpoint functions (`getOrders`, `getProductsBulk`). Pages consume these; they must not call `fetch` directly.

Domain types live in `src/interfaces/order.jaonaichan.ts` (primary) and `order-second.jaonaichan.ts` (alt schema). Follow the `*.jaonaichan.ts` suffix when adding domain types.

### Auth gating

Routes in `App.tsx` are wrapped individually in `<ProtectedRoute>` (`src/components/auth/ProtectedRoute.tsx`), which checks `isLoggedIn()` against localStorage and redirects to `/signin` if missing. Public routes (`/signin`, `/signup`, `/signout`) sit outside the `<AppLayout>` route element. There is no route-level guard — every protected route must be wrapped manually.

### Layout shell

`src/layout/AppLayout.tsx` composes `AppSidebar` + `AppHeader` + `<Outlet />` under a `SidebarProvider`. The sidebar's collapsed/expanded/mobile state lives in `SidebarContext`; theme (light/dark, class-based on `<html>`) lives in `ThemeContext` and is persisted to localStorage. These are the only two contexts — all other state is page-local `useState`.

### `DataTableOne` — the generic table

`src/components/tables/DataTable/DataTableOne.tsx` is the shared table used by every list page (orders, customers, products, etc.). Before building a new table UI, extend this one. Key capabilities:

- Column defs via `ColumnDef<T>[]` with dot-notation keys, `sortable`, `render(value, row)`, `noExport`, `width`, `align`, `classNameTableCell`.
- Either `data` (client-side) **or** `fetchFn` (server-side) — mutually exclusive.
- Toolbar features: `searchable`, `exportable` (CSV), `tabs`, `filters`, `bulkActions`, `selectable` checkboxes.
- Row interactions: `onRowClick`, `onRowLongPress`, `selectedRowKey`, `scrollable` (swaps pagination for a scroll container), `fillHeight`, `stickyFirstColumn`.

See `src/pages/Jaonaichan/Order.tsx` for a worked example using tabs, bulk actions, per-row portal dropdowns, summary inputs, and a paired detail pane.

### StrictMode double-effect guard

`useEffect` in pages that fetch on mount uses a `hasInitialized = useRef(false)` flag to prevent the second StrictMode invocation from firing duplicate API calls. Match this pattern when adding new mount-fetch pages.

### Portaled overlays

Row-level dropdowns (see `Order.tsx`) render via `createPortal` into `document.body` with `position: fixed` computed from the button's `getBoundingClientRect()`. This is deliberate — the table's overflow clipping would otherwise hide the menu. `Modal` and `BottomSheet` (`src/components/ui/modal`, `src/components/ui/bottom-sheet`) follow the same pattern.

## Conventions

- **ESLint `naming-convention`** is enforced (see `eslint.config.js`): `PascalCase` for types/components, `camelCase` for functions/variables, `UPPER_CASE` allowed for constants, `snake_case` allowed on interface members (to match WP REST payload shape).
- `@typescript-eslint/no-explicit-any` is a warning with auto-fix to `unknown`.
- Styling is Tailwind utilities in JSX, `clsx` / `tailwind-merge` for conditionals. Dark mode is class-based with the `dark:` prefix.
- TailAdmin design tokens in use: `text-body`, `bg-boxdark`, `border-strokedark`, `text-brand-500`, `shadow-theme-xs`.
- `tsconfig.app.json` has `strict`, `noUnusedLocals`, `noUnusedParameters` on. `npm run build` swallows TS errors (`tsc -b || true`), so rely on `npm run type-check` as the gate.

## Reuse existing components — check before building new

Before writing raw HTML or custom styles, check if an existing component covers the need:

| Need | Component | Path |
|------|-----------|------|
| Button | `Button` | `src/components/ui/button/Button.tsx` — variants: `primary`, `outline`, `orange`; sizes: `sm`, `md` |
| Select / dropdown | `Select` | `src/components/form/Select.tsx` — uncontrolled (`defaultValue` + `onChange`); pass `key` to reset externally |
| Text input | `Input` | `src/components/form/input/InputField.tsx` — does **not** forward `ref`; use raw `<input ref={...}>` when flatpickr or direct DOM access is needed |
| Form label | `Label` | `src/components/form/Label.tsx` |
| Badge | `Badge` | `src/components/ui/badge/Badge.tsx` |
| Modal | `Modal` | `src/components/ui/modal/index.tsx` |
| Portaled dropdown menu | `Dropdown` + `DropdownItem` | `src/components/ui/dropdown/` |

**`Button` and `Input` do not use `forwardRef`** — when a `ref` on the underlying DOM element is required (e.g. portal positioning, flatpickr init), use a raw `<button>` or `<input>` instead. Do not wrap in a `forwardRef` shim without asking first.

## Route map

Routes are registered manually in `src/App.tsx`. The active feature is `/order-jaonaichan` (`src/pages/Jaonaichan/Order.tsx`); most other routes (charts, forms, UI elements, table examples) are TailAdmin template pages kept as reference implementations.
