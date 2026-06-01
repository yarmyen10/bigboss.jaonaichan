# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # Production build (runs type-check first, errors non-fatal)
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm run preview      # Preview production build
```

No test suite configured.

## Architecture

React 19 SPA with React Router v7 (lazy-loaded pages), Tailwind CSS v4, Vite.

```
src/
├── api/          # client.ts (fetch wrapper with auth/CORS), auth.ts
├── services/     # jaonaichan.ts — all order, bill, barcode, profile API calls
├── interfaces/   # TypeScript types for API responses
├── hooks/        # useAuth, useGoBack, useModal, useSpinner
├── context/      # ThemeContext, SidebarContext
├── layout/       # AppLayout, AppHeader, AppSidebar
└── pages/        # Route-level components (lazy-loaded)
```

**API base**: `JAONAICHAN_API_URL` env var (default `https://jaonaichan.com/wp-json`). All calls go through `src/api/client.ts` which attaches the `bb_jwt` cookie and handles 401/403 → redirect to `/signin`.

**Routing**: React Router v7 with `ProtectedRoute` wrapping all authenticated pages. Routes defined in `src/main.tsx` or router config.

**Vite chunks**: Vendors split into 7 manual chunks (react, charts, calendar, maps, pdf, motion, dnd) — keep heavy imports inside their respective chunk boundaries.

## Key Patterns

- All WooCommerce REST calls go through `src/services/jaonaichan.ts`, not directly from components
- Auth state lives in `useAuth` hook; never read `bb_jwt` directly in components
- `DOMPurify` must be used before rendering any HTML from the API
- Env vars use `JAONAICHAN_` prefix and are accessed via `import.meta.env`
