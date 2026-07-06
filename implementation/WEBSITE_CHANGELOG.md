# FORSA — Website Changelog

Change log for `forsa-homepage-header-fixed (2).html`, the official FORSA
homepage. Layout, visual identity, branding, and UX are unchanged throughout
— every entry below is a content, terminology, or technical fix, verified
against the final Membership-first platform and the approved language policy.

## 2026-07-06 — Final website alignment pass

**Terminology**
- French membership tier names corrected from "Argent"/"Or" to the
  approved **"Silver"/"Gold"** (kept as English loanwords per the language
  policy) — fixed across tier cards, progression badges, CTAs, the FORSA
  Score section, and the Guarantor preview panel. Arabic ("فضي"/"ذهبي") was
  already correct.
- "Educational support"/"soutien éducatif"/"دعم تعليمي" replaced throughout
  with the approved **Tuition Facilitation Plan** terminology (full term at
  canonical introduction points, a natural shortened form in
  space-constrained pricing pills) — membership section intro, pricing
  cards, FORSA Score section, "Who are you?" student card, footnote, and
  footer legal disclaimer.
- "Human validation"/"human review" language replaced with the approved
  **Review Committee Decision** term at every decision-related mention
  (pricing fine print, FORSA Score section, "How It Works" step 4, the
  membership footnote).
- Footer legal disclaimer expanded from "not a credit institution" to the
  full approved disclaimer: *"FORSA is a student ecosystem and tuition
  facilitation platform — it is not a bank, lender, or credit institution."*

**Content accuracy**
- Rewrote all 4 "How It Works" steps (same 4-card layout, no structural
  change) to match the real, built student journey: Membership Request →
  Become a Bronze Member (FORSA ID + Digital Pass issued) → Apply for
  Facilitation (AI Interview, "recommends, never decides") → Decision &
  Activation (review committee). The previous steps described
  account-creation-first and an AI Interview as part of becoming Bronze,
  neither of which matches the actual platform.
- Added a 6th trust-strip item: **FORSA ID & Digital Pass** — a real,
  already-built platform capability that wasn't mentioned anywhere on the
  page before.
- Fixed the "Portals" nav label (was "Partenaires"/"Partners"/"الشركاء",
  inconsistent with the footer's own correct "Portails"/"Portals"/"البوابات"
  for the identical destination section).

**Links**
- All 7 "Join"/"Register" CTAs (nav, hero, Bronze/Silver/Gold cards,
  Student card, Guarantor section) updated from `/register` to `/join` —
  `/register` was intentionally removed and now only redirects, per this
  engagement's Phase 3.5 engineering pass; the CTAs worked by coincidence
  of the redirect, not by design.

**Technical**
- Added a functional mobile hamburger menu — nav links previously vanished
  below 900px with no replacement. The language switcher was relocated
  into the mobile dropdown (the header row doesn't have room for the logo,
  language switcher, Join button, and a hamburger all at once at phone
  widths); verified working via real browser testing at a 390px viewport.
- Added missing SEO/social meta tags: canonical URL, `og:url`, `og:locale`,
  `og:site_name`, and Twitter Card tags.
- Added page-wide `:focus-visible` styles — no interactive element had a
  visible keyboard-focus indicator before this.
- Added `prefers-reduced-motion` handling — fade-in and scroll-reveal
  animations now respect the user's OS-level motion preference.

**Verification**
- JS syntax validated (`node --check`), CSS brace-balance and HTML
  tag-balance checked across the full file — no errors.
- Real browser testing (Playwright/Chromium) at desktop (1440px) and
  mobile (390px): language switching (FR/EN/AR, including RTL), mobile
  menu open/close/link-click behavior, trust-strip item count, and all
  CTA link targets all verified directly, not assumed from the diff.

**Not changed** (confirmed correct, or deliberately out of scope):
- Hero section copy — already accurate and well-aligned.
- Guarantor/University/Partner section claims — verified against the
  actual, tested portals from this engagement; already accurate.
- No FAQ section added (none exists today — recommended for a future pass,
  not added here per the "do not add sections" instruction).
- External `forsa.tn/*` links (genesis, blog, privacy, terms, legal, inpdp,
  cookies) — cannot be verified live from this environment.

Full findings, section-by-section review, and recommendations in
`WEBSITE_AUDIT_REPORT.md`.
