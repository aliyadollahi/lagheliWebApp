# Lagheli («لاقلی») — Official Product Requirements Charter

> **Brand Meaning:** «لاقلی» means **frying pan / skillet** in Persian culinary heritage.  
> **Brand Entry Symbol:** A minimalist cast-iron skillet («لاقلی») with a sunny-side-up egg — representing **a simple yet nourishing, authentic meal** (*سادگیِ اصیل، در هر وعده*).

---

## 1. Visual & Brand Identity (Persian Editorial FoodTech)

- **Aesthetic Fusion:** Editorial Minimalism + Warm Minimalism + Swiss Typographic Hierarchy + Quiet Luxury + Functional Minimalism.
- **Native Persian-First:** Full `dir="rtl"` & `lang="fa"`, self-hosted **Vazirmatn** variable typography, Persian numerals (`۰-۹`), Toman currency (`۲۸۵٬۰۰۰ تومان`), proper BiDi isolation for promo codes and phone numbers.
- **Accessibility:** Strict **WCAG 2.2 AA** compliance — ≥4.5:1 text contrast, 44px–48px touch targets, semantic landmarks, screen-reader announcements (`aria-live`), non-color-only error/success indicators, and full `prefers-reduced-motion` support.
- **Strictly Forbidden:**
  - Crowded marketplace layouts, noisy discount banners, promotional sliders, spinning wheels.
  - Static pill-badge clutter on recipe/dish cards (use clean unboxed inline text separated by `·`).
  - Overlaying heavy text or gradients on editorial food photography.
  - Card Action Policy (Charter #11 Resolved): Minimalist recipe cards standardize on **Bookmark (نشانک)** alone (no duplicate heart icon clutter).

---

## 2. Six Core Product Modules

### Module 1: Editorial Food Ordering («سفره ادیتوریال»)
- Curated daily chef's menu with single-column breathable layout & featured dish of the day.
- Dish story, key ingredients, dietary info, **Single / Double portion selector** with instant Toman pricing, optional kitchen notes.
- City & neighborhood selector, quiet floating cart summary bar, transparent invoice (subtotal, warm packaging fee, free-delivery threshold), strict Persian/English mobile & address validation, order tracking code & order history.
- Seamless bridge between ordering and cooking («دستور پخت خانگی» / «حوصله پخت نداری؟ آماده سفارش بده»).

### Module 2: Recipe Discovery, Details & Cook Mode («کاوش و حالت آشپزی»)
- Minimalist recipe cards with high-resolution editorial photography, prep+cook time, verified chef link, 1-click shopping add, Web Share, and Bookmark toggle.
- Normalized Persian search (unifying `ی/ي`, `ک/ك`, `آ/ا`, ZWNJ, Persian/English digits).
- Faceted OR/AND filtering across categories, seasons, regions, diets, verified chefs, bookmarks, and followed chefs.
- Dynamic **Servings Scaler**, macro nutrition breakdown, interactive ingredient checklist, **1-click Add Missing to Shopping List**, inline **Substitution Finder**, VIP Gem-unlockable recipes, **Variations / Forking**, and **Recipe Q&A** (with Upvotes & Best Answer rewards).
- **Cook Mode:** Distraction-free step-by-step view, **Screen Wake Lock API**, **multiple simultaneous countdown timers** with gentle audio chime, and scaled inline step ingredients.

### Module 3: Smart Kitchen — Fridge Matching & Substitutions («آشپزخانه هوشمند»)
- **Fridge Matching («یخچال‌گردی»):** Quick-pick Iranian pantry items, toggle to assume common household staples (`نمک، فلفل، زردچوبه، روغن، آب`), toggle for exact match, ranked results by match %, and 1-click add missing items to shopping list.
- **Ingredient Substitution Engine:** Native Iranian culinary database + offline client fallback returning substitute name, exact ratio, flavor/texture note, compatibility %, category, vegan flag, and 1-click add to shopping list.

### Module 4: Smart Categorized Shopping List («لیست خرید هوشمند»)
- 1-click add missing ingredients from any recipe, or manual item entry with automatic classification.
- **Smart Deduplication & Consolidation:** Merges identical canonical ingredients with matching units automatically.
- **11 Official Categories:** سبزیجات و صیفی‌جات، میوه و دانه‌ها، لبنیات، پروتئین و تخم‌مرغ، ادویه و معطرها، چاشنی و رب‌ها، غلات و آرد، حبوبات، خشکبار و مغزها، روغن و چربی‌ها، سایر مواد.
- Three view modes (By Category / By Recipe / All), category filter, check-off, clear checked, clear all, share as text, and Admin-controlled instant delivery partner suggestion.

### Module 5: Community, 4-Tab Profile, Follow System & Gamification
- **4-Tab Profile:** `دستورهای من` (authored + bookmarked), `سوالات من` (Q&A + stats), `نشان‌های افتخار` (progress & rewards), `کیف جِم` (balance, Gem-to-Coupon store, redeemed coupons, transaction ledger).
- **Public Chef Profiles:** Bio, specialty, verified badge, Follow/Unfollow, and 3 tabs (`دستورها`, `دنبال‌کنندگان`, `دنبال‌شوندگان`).
- **5 User Levels:** آشپز تازه‌کار → همراه پرانرژی → کدبانو و آشپز فعال → سرآشپز خلاق → استاد آشپزی لاقلی.
- **Multi-Step UGC Recipe / Variation Submission Wizard** with moderation queue for non-verified authors.

### Module 6: Admin-Programmable Food Industry Ecosystem (B2B)
- **10 Food Industry Roles (individually toggleable in Admin Panel):**
  1. برندهای مواد غذایی (`food_brands`)
  2. تجهیزات خانه و آشپزخانه (`kitchen_equipment`)
  3. فروشگاه‌ها و سوپرمارکت‌ها (`stores_supermarkets`)
  4. رستوران‌ها و مطبخ‌ها (`restaurants_kitchens`)
  5. کافه‌ها و شیرینی‌سراها (`cafes_bakeries`)
  6. سرآشپزها و مشاوران تغذیه (`chefs_nutritionists`)
  7. آموزشگاه‌های آشپزی (`culinary_schools`)
  8. تولیدکنندگان بومی و مشاغل خانگی (`local_artisans`)
  9. کیترینگ و تشریفات (`catering_events`)
  10. پیک و سرویس‌های ارسال فوری (`instant_delivery`)
- **3 Admin-Toggleable Placements:** Explore Showcase + Directory, Quiet Contextual Links in Recipe/Shopping (strictly capped by `maxPartnerCardsPerRecipe`, default `1`), and Independent Marketplace Tab.
- **3 Monetization Models:** Contextual links + Gem coupons, Tiered packages (`free` / `featured` / `sponsor`), Tracked promo & affiliate codes.
- **3 B2B Management Flows:** Self-serve registration (approval queue), Admin direct management, and Public Auto-Page with **Claim Page** workflow.
- **Event Analytics:** Tracks `impression`, `profile_open`, `coupon_copy`, `gem_redeem`, and `affiliate_click`.
