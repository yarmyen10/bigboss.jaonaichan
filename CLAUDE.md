# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Admin dashboard for WooCommerce order management, built on the **TailAdmin** React template. The backend is a WordPress site at `jaonaichan.com` exposed via WP-REST + custom JWT auth — this app is a pure frontend SPA that talks to that REST API.

## Commands

```bash
npm run dev         # Vite dev server
npm run build       # vite build — prebuild runs tsc -b but TS errors do NOT fail the build
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
JAONAICHAN_ENABLE_MOCK=true             # enable mock/stub mode (set false for prod)
```

`.env` is gitignored; the values above are the current dev defaults.

## Architecture

### Request layer: `src/api/` → `src/services/` → pages

- `src/api/auth.ts` — JWT sign-in against `/jwt-auth/v1/token`; stores token under `${PREFIX}Token` and a `BigBossUser` JSON under `${PREFIX}User` in localStorage.
- `src/api/client.ts` — single `apiRequest<T>()` fetch wrapper. Injects `Authorization: Bearer <token>`, and on **403** calls `signOut()` and hard-redirects to `/signin`. All network calls must go through this.
- `src/services/jaonaichan.ts` — all typed endpoint functions. Pages consume these; they must not call `fetch` directly.

Current service functions:

| Function | Endpoint / purpose |
|---|---|
| `getDashboardStats(year?)` | Dashboard overview — metrics, monthly revenue, recent orders, status breakdown |
| `getOrders(params)` | Fetch paginated order list |
| `getOrder(id)` | Fetch single order detail |
| `getProductsBulk(...)` | Fetch products by IDs |
| `getProductsBulkByOrders({orderIds, statuses, page, perPage})` | Bulk products scoped to orders |
| `patchBill2(orderId, amount, status, paidAt, unitPrices, unitPricesId)` | Update Bill 2 on an order |
| `patchOrderStatus(orderId, status)` | Update order status |
| `getBillSlipObjectUrl(orderId, bill)` | Returns blob object URL for PromptPay slip preview |
| `getBarcodeOrderItems()` | Fetch items pending barcode pack |
| `validateBarcode()` | Validate a scanned barcode |
| `confirmPack(orderId, scanned)` | Confirm packed items for an order |
| `searchProductsForImport()` | Product search for barcode import flow |
| `getProductVariations()` | Fetch variations for a product |
| `saveBarcodeImport()` | Save barcode import batch |
| `getProfile()` | Fetch current user profile (`/bigboss-auth/v1/profile`) |
| `patchProfile()` | Update current user profile |

Domain types follow the `*.jaonaichan.ts` suffix:

- `src/interfaces/order.jaonaichan.ts` — primary order types (`Order`, `OrderListResponse`, `OrderDetailResponse`, `OrderItem`, `OrderItemProduct`, `OrderProductsBulkResponse`, `PatchBillResponse`)
- `src/interfaces/order-second.jaonaichan.ts` — alt schema
- `src/interfaces/barcode.jaonaichan.ts` — barcode flow types (`BarcodeOrderItem`, `GetOrderItemsResponse`, `ValidateBarcodeResponse`, `ConfirmPackResponse`, `ProductSearchResult`, `ProductSearchResponse`, `ProductVariation`, `GetVariationsResponse`, `BarcodeImportSaveResponse`)
- `src/interfaces/profile.jaonaichan.ts` — profile types (`UserProfile`, `PatchProfilePayload`, `PatchProfileResponse`)

### Order status config

`src/config/orderStatus.jaonaichan.ts` — `ORDER_STATUS_DETAILS` map keyed by `OrderStatus` union type; contains display text and badge color for all statuses (pending, paid-1, paid-2, completed, cancelled, etc.). Use this for rendering status badges — do not hardcode status strings.

`src/config/manageOrders.jaonaichan.ts` — `STATUS_MANAGE_ACTIONS` map of which actions are available per status; `resolveManageTabs()` helper builds the tab list for the Bill 2 action panel; `hasManageableOrders()` guard.

### Auth gating

Routes in `App.tsx` are wrapped individually in `<ProtectedRoute>` (`src/components/auth/ProtectedRoute.tsx`), which checks `isLoggedIn()` against localStorage and redirects to `/signin` if missing. Public routes (`/signin`, `/signup`, `/signout`) sit outside the `<AppLayout>` route element. There is no route-level guard — every protected route must be wrapped manually.

### Layout shell

`src/layout/AppLayout.tsx` composes `AppSidebar` + `AppHeader` + `<Outlet />` under a `SidebarProvider`. The sidebar's collapsed/expanded/mobile state lives in `SidebarContext`; theme (light/dark, class-based on `<html>`) lives in `ThemeContext` and is persisted to localStorage. These are the only two contexts — all other state is page-local `useState`.

### `DataTableOne` — the generic table

`src/components/tables/DataTable/DataTableOne.tsx` is the shared table used by every list page. Before building a new table UI, extend this one. Key capabilities:

- Column defs via `ColumnDef<T>[]` with dot-notation keys, `sortable`, `render(value, row)`, `noExport`, `width`, `align`, `classNameTableCell`.
- Either `data` (client-side) **or** `fetchFn` (server-side) — mutually exclusive.
- Toolbar features: `searchable`, `exportable` (CSV), `tabs`, `filters`, `bulkActions`, `selectable` checkboxes.
- Row interactions: `onRowClick`, `onRowLongPress`, `selectedRowKey`, `scrollable` (swaps pagination for a scroll container), `fillHeight`, `stickyFirstColumn`.

See `src/pages/Jaonaichan/Order.tsx` for a worked example using tabs, bulk actions, per-row portal dropdowns, summary inputs, and a paired detail pane.

### Domain components

`src/components/jaonaichan/` holds reusable components specific to this domain:

- `OrderDetails.tsx` — modal pane for a single order: customer info, billing address, payment method, Bill 1 & Bill 2 status + paid dates, slip image preview, items table. Calls `getOrder(id)` and `getBillSlipObjectUrl()` internally.
- `ProductDetailsCard.tsx` — product card with image, name, SKU, pricing, stock, categories, permalink. Two variants: `"card"` (wrapped in `ComponentCard`) and `"flat"` (for use inside modals).

### Hooks

`src/hooks/` provides shared stateful utilities:

- `useAuth.ts` — authentication state
- `useModal.ts` — open/close toggle for modals
- `useSpinner.ts` — loading spinner state
- `useGoBack.ts` — navigation back helper

### Barcode scanner integration

Both `BarcodePack.tsx` and `BarcodeImport.tsx` use the **Html5Qrcode** library loaded from CDN. The scanner instance is managed as a ref (`Html5QrcodeInstance`) to survive re-renders. Camera start/stop is handled in `useEffect` with cleanup — match this pattern for any new scanner pages.

### StrictMode double-effect guard

`useEffect` in pages that fetch on mount uses a `hasInitialized = useRef(false)` flag to prevent the second StrictMode invocation from firing duplicate API calls. Match this pattern when adding new mount-fetch pages.

### Portaled overlays

Row-level dropdowns (see `Order.tsx`) render via `createPortal` into `document.body` with `position: fixed` computed from the button's `getBoundingClientRect()`. This is deliberate — the table's overflow clipping would otherwise hide the menu. `Modal` and `BottomSheet` (`src/components/ui/modal`, `src/components/ui/bottom-sheet`) follow the same pattern.

## Conventions

- **ESLint `naming-convention`** is enforced (see `eslint.config.js`): `PascalCase` for types/components, `camelCase` for functions/variables, `UPPER_CASE` allowed for constants, `snake_case` allowed on interface members (to match WP REST payload shape).
- `@typescript-eslint/no-explicit-any` is a warning with auto-fix to `unknown`.
- Styling is Tailwind utilities in JSX, `clsx` / `tailwind-merge` for conditionals. Dark mode is class-based with the `dark:` prefix.
- TailAdmin design tokens in use: `text-body`, `bg-boxdark`, `dark:border-gray-800`, `text-brand-500`, `shadow-theme-xs`.
- `tsconfig.app.json` has `strict`, `noUnusedLocals`, `noUnusedParameters` on. `npm run build` swallows TS errors (prebuild `tsc -b || echo ...`), so rely on `npm run type-check` as the gate.

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
| Order detail pane | `OrderDetails` | `src/components/jaonaichan/OrderDetails.tsx` |
| Product info card | `ProductDetailsCard` | `src/components/jaonaichan/ProductDetailsCard.tsx` — variants: `"card"`, `"flat"` |
| Status badge color/text | `ORDER_STATUS_DETAILS` | `src/config/orderStatus.jaonaichan.ts` |

**`Button` and `Input` do not use `forwardRef`** — when a `ref` on the underlying DOM element is required (e.g. portal positioning, flatpickr init), use a raw `<button>` or `<input>` instead. Do not wrap in a `forwardRef` shim without asking first.

## Route map

Routes are registered manually in `src/App.tsx`.

**Active feature routes (Jaonaichan domain):**

| Route | Page | Notes |
|-------|------|-------|
| `/order-jaonaichan` | `Order.tsx` | Main order list + management |
| `/bill2-unit-prices` | `Bill2UnitPrices.tsx` | Batch unit-price editor |
| `/barcode-pack` | `BarcodePack.tsx` | Barcode scanner → pack confirmation |
| `/barcode-import` | `BarcodeImport.tsx` | Product search + barcode import |
| `/profile` | `UserProfiles.tsx` | User profile |

**Template / reference routes** (TailAdmin pages kept for reference):
`/`, `/calendar`, `/blank`, `/form-elements`, `/basic-tables`, `/customers-tables-ex`, `/orders-tables-ex`, `/alerts`, `/avatars`, `/badge`, `/buttons`, `/images`, `/videos`, `/line-chart`, `/bar-chart`

**Public (auth) routes:** `/signin`, `/signup`, `/signout`

**Fallback:** `*` → `NotFound.tsx`
