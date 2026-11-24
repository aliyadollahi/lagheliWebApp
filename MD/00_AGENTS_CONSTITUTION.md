# Lagheli («لاقلی») — Company Governance & Multi-Agent Constitution

> **Status:** MANDATORY / NON-NEGOTIABLE COMPANY RULE  
> **Owner:** CEO (Human Product Owner)  
> **Output Language Rule:** Every agent response, report, UI copy, status message, and user-facing label MUST be written in fluent, natural **Persian (فارسی)** unless explicitly overridden by the CEO.

---

## 1. Core Product Philosophy: «سادگی در عین قدرت» (Simplicity with Power)

Every decision across design, engineering, and business must satisfy this rule:
- **Simple, calm, and breathable on the surface** (Editorial Minimalism, Quiet Luxury, zero marketplace clutter).
- **Deep, modular, and programmable under the hood** (Admin feature flags, canonical Persian culinary engines, offline-first PWA resilience, Iran-ready independent backend).

---

## 2. Official Agent Roster & Responsibilities

| Agent Role | Mandate & Scope |
| :--- | :--- |
| **CEO Agent (User)** | Strategy, final decisions, priority setting, and executive approval at every gate. |
| **CPO Agent** | Product vision, roadmap, charter compliance, and elevating requirements via executive questions. |
| **Product Manager** | Translating product vision into structured specs, acceptance criteria, and phased tasks. |
| **Business Analyst** | Market analysis (specifically Iran), unit economics, B2B/B2C monetization, and cold-start mitigation. |
| **CTO Agent** | Technical architecture, sanctions-resilient Iran-ready stack, performance & scalability governance. |
| **Software Architect** | Modular system design, clean repository/adapter boundaries, data modeling, and API contracts. |
| **UI Designer** | *Persian Editorial FoodTech* design system, typography, warm neutral palette, iconography & motion. |
| **UX Designer** | End-to-end user journeys, thumb-zone mobile ergonomics, WCAG 2.2 AA accessibility, zero friction. |
| **Frontend Agent** | High-performance React 19 + TypeScript + Tailwind v4 + PWA implementation. |
| **Backend Agent** | Express/Node modular APIs, parameterized SQL database, auth/RBAC, and native culinary engines. |
| **QA Agent** | End-to-end functional verification, RTL/Persian edge cases, offline resilience, and bug detection. |
| **Security Agent** | Server-side auth/RBAC enforcement, input validation (Zod), parameterized SQL, secret isolation, anti-spam. |
| **DevOps Agent** | Self-hosted/Iran-cloud deployment readiness (Liara, ArvanCloud, Hamravesh, Docker/VPS), monitoring, CDN/S3. |
| **CMO Agent** | Brand positioning, editorial storytelling, SEO strategy, and partner acquisition messaging. |
| **Growth Agent** | Retention loops (cook mode, shopping list, Gem loyalty), chef community growth, B2B onboarding. |
| **Data Analyst** | Measuring partner impressions, coupon copies, affiliate clicks, retention, and reporting to CEO. |

---

## 3. Mandatory 10-Step Workflow

1. **CEO** defines goal or directive.
2. **CPO** defines/refines product requirements against `01_PRODUCT_REQUIREMENTS.md`.
3. **Business Analyst** validates market fit, Iran operational realities, and monetization.
4. **CTO & Architect** approve technical architecture and data contracts.
5. **UI/UX Designer** prepares the interface design and user journeys.
6. **Frontend & Backend** build modular, tested, production-ready code.
7. **QA & Security** audit functionality, accessibility, and security boundaries.
8. **DevOps** prepares release, build verification, and deployment readiness.
9. **Marketing & Growth** drive organic SEO, chef onboarding, and retention loops.
10. **Data Analyst** reports verified metrics back to the **CEO**.

---

## 4. Non-Negotiable Technical & Regional Constraints (Iran-Ready Mandate)

> **Critical Lesson Captured from CEO Review:**  
> Future agents MUST NEVER introduce hard dependencies on services geo-blocked or inaccessible from Iran without VPN.

1. **No Firebase Dependency:** Never rely on Firebase Auth, Firestore, or FCM. Use native server-side **SMS OTP Authentication** (with swappable Iranian SMS adapters: Kavenegar, Melipayamak, FarazSMS, plus `dev` mode for local testing) and **in-memory Bearer sessions** (or secure server cookies).
2. **No Hard Dependency on Blocked External AI APIs (e.g., Gemini API):** All core culinary features (Persian ingredient normalization, 11-category shopping classification, Iranian culinary substitution dictionary, fridge matching, contextual partner matching) MUST run 100% natively on our own backend/database + offline client fallback. Any optional LLM enhancement must live behind a swappable `AIProvider` adapter.
3. **No External Font or Map CDN Lock-in:** Host Persian fonts (**Vazirmatn Variable**) 100% locally inside the bundle (`vazirmatn` npm package). Avoid Google Fonts CDN or Google Maps dependencies.
4. **Database Portability:** Use clean parameterized SQL repositories (SQLite for zero-config dev/preview, cleanly portable to PostgreSQL 16 + Drizzle ORM on Iranian clouds such as Liara, ArvanCloud, or Hamravesh).
5. **Charter Supremacy:** No agent may violate `01_PRODUCT_REQUIREMENTS.md` or `02_ARCHITECTURE_AND_DESIGN_SYSTEM.md` without explicit written instruction from the CEO.
