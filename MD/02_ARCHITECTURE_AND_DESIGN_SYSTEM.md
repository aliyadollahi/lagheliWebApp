# Lagheli («لاقلی») — Technical Architecture, Design System & Agent Handoff Guide

> **Audience:** All Engineering, Design, QA, Security, and DevOps Agents working on Lagheli now or in future iterations.

---

## 1. Repository Map (Clean Modular Structure)

```text
/MD/                           # Immutable governance, product charter & architecture guides
/public/
  icon.svg                     # Cast-iron skillet (Lagheli) + golden egg vector brand icon
  pwa-192x192.png              # Standard PWA icon (192x192)
  pwa-512x512.png              # Standard PWA icon (512x512)
  pwa-maskable-512x512.png     # Maskable icon with safe-zone padding
  apple-touch-icon.png         # iOS Safari PNG touch icon (180x180)
/server.ts                     # Express full-stack server (API + Vite middleware in dev / dist in prod)
/src/
  /shared/
    types.ts                   # Single source of truth for all domain TypeScript interfaces
    persianEngine.ts           # Persian normalizer, canonical taxonomy, 11-category classifier, native substitution engine
  /server/
    db.ts                      # Parameterized SQLite database (PostgreSQL-portable schema) + Persian seed data
  /hooks/
    usePWA.ts                  # PWA install prompt (Chromium + iOS Safari) & online/offline status hooks
  /lib/
    api.ts                     # Typed fetch wrapper (in-memory Bearer tokens) + Guest Local-First storage
  /components/
    SplashScreen.tsx           # Animated Lagheli skillet + egg entry screen (auto-dismiss + instant skip)
    Navigation.tsx             # 3-zone Desktop TopHeader + Mobile Thumb-Zone BottomNav
    EditorialImage.tsx         # Resilient food photography container with zero-broken-image fallback
    RecipeFeed.tsx             # Editorial hero + Persian search + OR/AND filter drawer + minimalist cards
    RecipeDetailModal.tsx      # Servings scaler, checklist, 1-click shopping, substitutions, Q&A, contextual partner
    CookModeOverlay.tsx        # Distraction-free Cook Mode + Screen Wake Lock + multi-timers + Web Audio chime
    KitchenHub.tsx             # Smart Fridge Matcher + Persian Ingredient Substitution Finder
    EditorialOrderView.tsx     # Quiet Luxury daily food ordering + Toman checkout + order tracking
    ShoppingListView.tsx       # 11-category shopping list + consolidation + offline persistence
    MarketplaceView.tsx        # 10-role Partner Directory + Business Page + Self-Serve Register + Claim flow
    ProfileAndAdminView.tsx    # 4-Tab User Profile + Gem Wallet + Admin Programmable Control Center
    ChefProfileModal.tsx       # Public chef page with Follow/Unfollow + Followers/Following lists
    SubmitRecipeModal.tsx      # Multi-step Wizard for new recipes & variations
    AuthModal.tsx              # Iran-ready SMS OTP login + Guest Local-First merge
```

---

## 2. Design System Tokens (`src/index.css`)

| Token | Light Mode | Dark Mode | Role |
| :--- | :--- | :--- | :--- |
| `--lagheli-canvas` | `#F9F8F4` | `#141412` | 60% Primary warm paper / deep charcoal backdrop |
| `--lagheli-surface` | `#FFFFFF` | `#1C1B18` | 30% Elevated editorial cards & drawers |
| `--lagheli-surface-muted` | `#F1EFE8` | `#24231F` | Secondary controls, segmented bar tracks |
| `--lagheli-border` | `#E5E1D6` | `#2F2D27` | 1px subtle structural hairlines |
| `--lagheli-ink` | `#1C1B18` | `#F4F1EA` | High-contrast primary typography (WCAG AA+) |
| `--lagheli-ink-muted` | `#615E55` | `#A9A497` | Secondary captions & unboxed `·` metadata |
| `--lagheli-accent` | `#3F523B` | `#8EA888` | 10% Deep Persian Olive primary CTAs & active states |
| `--lagheli-saffron` | `#A97222` | `#D8A85B` | Subtle saffron highlights (VIP, egg yolk, steam) |

### Mandatory UX Rules for Future Agents
1. **Zero-Pill Metadata:** Static info (`region`, `time`, `calories`, `category`) MUST render as plain unboxed text separated by `·`. Only interactive `<button>` filters use segmented backgrounds.
2. **Touch Target Floor:** Minimum `44px–48px` hitbox on all interactive buttons, tabs, and inputs.
3. **Dual-Theme Contract:** `@custom-variant dark (&:where(.dark, .dark *));` is active in Tailwind v4 — every new surface/text/border MUST include balanced `dark:*` classes.
4. **Motion Discipline:** Respect `prefers-reduced-motion`; keep routine micro-interactions ≤200ms and animate compositor properties only.

---

## 3. Backend API Contract & Security Boundaries

### Security Invariants (Audited by Security Agent)
- **Zero Hardcoded Secrets:** Environment variables live exclusively in server-side `process.env` (documented in `.env.example`: `ADMIN_PASSCODE`, `SMS_PROVIDER`, `SMS_API_KEY`, `DATABASE_URL`).
- **In-Memory Session Tokens:** User & Admin `Authorization: Bearer` tokens are held strictly in React memory (`src/lib/api.ts`) and verified against SHA-256 hashes in SQLite `sessions`. Never store auth tokens in `localStorage`.
- **First-Run Admin Setup:** When `ADMIN_PASSCODE` is unset, `POST /api/admin/setup` atomically hashes the first admin password via `crypto.scryptSync` and locks itself permanently. If `ADMIN_PASSCODE` is set in production env, it always overrides any stored fallback hash.
- **Parameterized SQL Everywhere:** All queries in `server.ts` and `src/server/db.ts` use `better-sqlite3` bound parameters (`?`).
- **Strict Input & URL Validation:** All mutating endpoints validate payloads with `zod` and reject unsafe URL schemes (`javascript:`, `data:`).
- **Rate Limiting & Anti-Spam:** OTP requests, admin login attempts, and daily Q&A Gem rewards are rate-limited on the server.

### Iran Production Migration Checklist (DevOps Agent)
1. Set `DATABASE_URL` and swap SQLite driver in `src/server/db.ts` to PostgreSQL 16 (same normalized table schema).
2. Set `SMS_PROVIDER=kavenegar` (or `melipayamak`) and `SMS_API_KEY` in production Secrets to switch OTP from Dev preview mode to live Iranian SMS delivery.
3. Set `ADMIN_PASSCODE` in server environment secrets before public launch.
4. Keep `vazirmatn` bundled locally and host user-uploaded food imagery on Iranian S3-compatible storage (ArvanCloud / Liara / MinIO).
