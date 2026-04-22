# CLAUDE.md — bigboss.jaonaichan

Admin dashboard for WooCommerce order management, built on **TailAdmin** (Tailwind CSS admin template).
Backend is a WordPress site at `jaonaichan.com` exposed via WP-REST + custom JWT auth.

---

## Rules
- ALWAYS check if a file exists before creating it
- Read existing files first, then modify — never overwrite

---

## IMPORTANT RULES
- NEVER create a file without first checking if it already exists
- Use Read tool to check file existence before any write operation

---

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | React 19 + TypeScript ~5.7 |
| Build | Vite 6.1 + vite-plugin-svgr |
| Styling | Tailwind CSS 4.0 + tailwind-merge + clsx |
| Routing | React Router 7.1 (BrowserRouter, manual routes) |
| State | Context API only — no Redux / Zustand |
| Charts | ApexCharts 4 (react-apexcharts) |
| Calendar | @fullcalendar/react 6 |
| Date picker | flatpickr 4 |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| DOMPurify | dompurify 3 (HTML sanitisation) |
| SEO | react-helmet-async 2 |

---

## Project Structure

```
src/
├── api/
│   ├── auth.ts          # JWT sign-in/sign-out, localStorage helpers
│   └── client.ts        # apiRequest() — fetch wrapper, injects Bearer token, handles 403
├── services/
│   └── jaonaichan.ts    # getOrders(), getProductsBulk() — only API call site
├── interfaces/
│   ├── order.jaonaichan.ts         # Primary WooCommerce order / product types
│   └── order-second.jaonaichan.ts  # Alternative order schema
├── context/
│   ├── ThemeContext.tsx    # light / dark — persisted to localStorage, toggled via html.dark class
│   └── SidebarContext.tsx # isExpanded, isMobileOpen, hover, active menu
├── hooks/
│   ├── useAuth.ts     # { user, isLoggedIn, token, signOut }
│   ├── useSpinner.ts  # withSpinner(asyncFn) loading helper
│   ├── useModal.ts    # open / close modal state
│   └── useGoBack.ts   # navigation helper
├── layout/
│   ├── AppLayout.tsx    # outer shell — AppHeader + AppSidebar + <Outlet>
│   ├── AppHeader.tsx
│   ├── AppSidebar.tsx
│   └── Backdrop.tsx     # mobile sidebar overlay
├── pages/               # one folder per route
│   ├── AuthPages/       # SignIn, SignUp, SignOut
│   ├── Dashboard/
│   ├── Jaonaichan/      # primary order-management page
│   ├── Forms/ Tables/ Charts/ UiElements/ OtherPage/
│   ├── UserProfiles.tsx
│   └── Calendar.tsx
├── components/
│   ├── auth/            # ProtectedRoute, SignInForm, SignUpForm
│   ├── charts/          # bar/ line/ ApexCharts wrappers
│   ├── common/          # CardFrame, PageMeta, PageBreadCrumb, PageSpinner, ScrollToTop, ThemeToggleButton
│   ├── ecommerce/       # EcommerceMetrics, MonthlySalesChart, RecentOrders, …
│   ├── form/            # input/ form-elements/ switch/ Select MultiSelect DatePicker
│   ├── header/
│   ├── tables/
│   │   ├── BasicTables/
│   │   └── DataTable/   # DataTableOne — primary generic table (see below)
│   ├── ui/              # button/ badge/ modal/ dropdown/ alert/ avatar/ tabs/ table/ task/
│   └── UserProfile/
├── icons/               # SVG icon components (+ icons/order/)
├── App.tsx              # route tree
├── main.tsx             # entry point
└── index.css            # Tailwind base styles
```

---

## Routing

Defined manually in `App.tsx`:

- Public: `/signin`, `/signup`, `/signout`
- Protected (inside `<AppLayout>`): wrapped by `<ProtectedRoute>` which redirects to `/signin` when no token
- 404 catch-all at the bottom

---

## Auth Flow

1. POST `/jwt-auth/v1/token` → returns `{ token, user_display_name, … }`
2. Token stored in localStorage as `${PREFIX}Token`, user as `${PREFIX}User`
3. Every request: `Authorization: Bearer {token}` added by `apiRequest()`
4. 403 response → automatic redirect to `/signin`
5. Sign-out clears both localStorage keys

Env vars (in `.env`):

```
JAONAICHAN_API_URL=https://jaonaichan.com/wp-json
JAONAICHAN_PREFIX=bigboss
```

---

## State Management

- **ThemeContext** — `useTheme()` — light/dark, class on `<html>`
- **SidebarContext** — `useSidebar()` — expand/collapse, mobile open, hover, active item
- Everything else is local `useState` per page
- `useRef` used as init-flag to prevent duplicate API calls under React 18/19 StrictMode

---

## DataTableOne — Generic Table Component

Location: `src/components/tables/DataTable/DataTableOne.tsx`

Key props:

| Prop | Type | Purpose |
|---|---|---|
| `columns` | `ColumnDef<T>[]` | Column definitions — key (dot-notation), label, sortable, render fn |
| `data` | `T[]` | Static client-side data |
| `fetchFn` | `(params) => Promise<FetchResult<T>>` | Server-side fetch (mutually exclusive with data) |
| `rowKey` | `keyof T` | Unique row identifier |
| `searchable` | `"toolbar" \| "header" \| ""` | Where to render search input |
| `exportable` | `"toolbar" \| "header" \| ""` | Where to render CSV export button |
| `scrollable` | `boolean` | Replaces pagination with scroll container |
| `selectable` | `boolean` | Checkbox column + bulk actions |
| `filters` | `FilterConfig[]` | Dropdown filter panel |
| `tabs` | `TabOption[]` | Tab row in toolbar |

ColumnDef supports dot-notation keys (`"billing.first_name"`), custom `render()`, `noExport`, and `classNameTableCell`.

---

## Shared Component Conventions

- **`<ComponentTableCard>`** — card wrapper for table pages (title, desc, divider slot, body)
- **`<PageMeta>`** — Helmet title + description
- **`<PageBreadCrumb>`** — breadcrumb nav
- **`<Button>`** — variants: `primary | outline | orange | …`, sizes: `sm | md | lg`
- **`<Modal>`** — overlay modal, `fullscreen` prop available
- **`<Badge>`** — status labels with color variants
- **`<Dropdown>` / `<DropdownItem>`** — rendered via `createPortal` to avoid z-index issues

---

## Styling Conventions

- Tailwind utility classes directly in JSX — no CSS modules
- `clsx()` for conditional classes
- Dark mode: class-based (`dark:` prefix) toggled on `<html>`
- TailAdmin-specific tokens: `dark:bg-boxdark`, `dark:border-strokedark`, `text-body`, `dark:text-bodydark`
- Responsive: `sm:`, `md:`, `lg:`, `xl:` prefixes

---

## TypeScript Conventions

- Strict mode on (`noUnusedLocals`, `noUnusedParameters`)
- Generic components: `<DataTableOne<OrderIF>>`
- All domain types live in `src/interfaces/`
- Naming: `PascalCase` for components, `camelCase` for hooks/utilities, `*.jaonaichan.ts` suffix for domain types
