# FORSA — Website Audit Report

**Date**: 6 July 2026
**File audited**: `forsa-homepage-header-fixed (2).html` (the official homepage, treated as final design)
**Mandate**: verify the homepage accurately represents the final Membership-first
FORSA platform and complies with the approved language policy — without
redesigning it. Layout, visual identity, branding, colors, typography, and UX
are preserved throughout; every change below is a content, terminology, or
technical correction, not a design change.

---

## Verdict

**Yes, ready for production**, with the corrections in this report applied.
The homepage's visual design was already strong and did not need to change.
What it said, however, had drifted from what the platform actually does and
from the approved language policy in several concrete, fixable ways — all
now corrected.

---

## Section-by-section review

### Navigation
- **Finding**: the "Portals" nav link was labeled "Partenaires"/"Partners"/"الشركاء"
  (Partners) in all three languages, while the section it links to (`#portals`)
  covers Student, University, *and* Partner portals — and the footer's own
  link to the same section already correctly says "Portails"/"Portals"/"البوابات".
  **Fixed**: nav label now matches the footer's correct term in all three
  languages.
- **Finding**: below 900px, the nav links disappeared with no replacement —
  no hamburger menu, no way to reach in-page sections on mobile.
  **Fixed**: added a functional hamburger menu (see Technical Review).
- Logo, language switcher, Login/Join buttons: all still accurate, unchanged.

### Hero
- Copy is accurate and already well-aligned with the language policy: "FORSA
  is a student ecosystem — not a financing company" / correctly frames Bronze
  membership as gated on acceptance ("every *accepted* student"). No changes
  needed beyond what's covered by the terminology sweep below.

### Membership (Bronze / Silver / Gold)
- **Finding — significant**: the French version used "Argent" and "Or" (the
  literal French translations of Silver/Gold) as membership tier names
  throughout — in the tier cards, the progression badges, CTAs, and body
  copy. The approved language policy explicitly requires **"Membre Silver"**
  and **"Membre Gold"** for French — the English tier names are kept as
  loanwords, not translated. (Arabic *does* translate them — "فضي"/"ذهبي" —
  and was already correct.) This was also visibly inconsistent with the
  progression badges themselves, which have always shown the letters "S"
  and "G" — a mismatch with a French label starting with "A" or "O" that
  was itself a clue something was off.
  **Fixed**: every French instance of "Argent"/"Or" as a tier name is now
  "Silver"/"Gold," consistently across cards, badges, CTAs ("Devenir Silver
  →"), and body copy.
- **Finding — significant**: "educational support" / "soutien éducatif" /
  "دعم تعليمي" was used throughout to describe the Silver/Gold benefit,
  rather than the approved required term, **Tuition Facilitation Plan** /
  **Plan de facilitation des frais universitaires** / **خطة تيسير المعاليم
  الجامعية**.
  **Fixed**: the full approved term now appears at the canonical
  introduction points (the membership section intro, the footnote, the
  footer legal line); a natural shortened form ("Tuition Facilitation" /
  "Facilitation des frais" / "تيسير المعاليم") is used in space-constrained
  spots (the pricing pills), which is standard writing practice — define
  the full term once, abbreviate consistently after — not a departure from
  the required terminology.
- **Finding**: the "Devenir Silver/Gold" fine print said "subject to
  eligibility, capacity, and human validation" — accurate but generic.
  **Fixed**: now says "and the review committee's decision," matching the
  approved **Review Committee Decision** term and giving the actual decision
  process a name, not just an unnamed "human" gesture.
- **Finding**: all three CTA buttons (Bronze, Silver, Gold) linked to
  `/register` — see "Links" below.
- The footnote's "not a loan" framing was already good messaging and is
  preserved, now paired with the full approved terminology and an explicit
  mention of the review committee + AI recommendation (see below).

### FORSA Score
- Section is accurate and already excellent messaging: "reflects your
  reliability and commitment — not your family's income" directly
  reinforces "not a credit score" positioning. No structural change.
- **Fixed**: the "Unlocks Silver & Gold" feature description referenced
  "educational support" — updated to name the review committee and the
  tuition facilitation plan explicitly (same terminology sweep as above).

### Student Journey ("How It Works") — most substantial content fix
- **Finding — significant**: the 4 steps did not match the real, built
  student journey. They described "Create your account" → "AI Interview" →
  "Human Review" → "Activation Meeting" — but in the actual platform:
  - Account creation does not come first — a visitor submits a free
    **Membership Request** with no account and no documents; an account is
    only created *after* approval, via the password-set link the student
    receives by email.
  - The AI Interview is not part of *becoming a Bronze member* — it happens
    later, when an already-Bronze member applies for a Tuition Facilitation
    Plan (Silver/Gold).
  - Neither the **FORSA ID** nor the **FORSA Digital Pass** — both real,
    already-built platform capabilities issued the moment Bronze membership
    is approved — were mentioned anywhere on the page.
  **Fixed**, within the exact same 4-card layout (no structural change):
  1. **Membership Request** — submit a free request, no documents required.
  2. **Become a Bronze Member** — once approved, receive your FORSA ID and
     FORSA Digital Pass, activate your account.
  3. **Apply for Facilitation** — the AI Interview now correctly sits here,
     explicitly stated as "it recommends, it never decides" (the approved
     **AI recommends, humans decide** philosophy, made concrete rather than
     left implicit).
  4. **Decision & Activation** — the review committee's final decision,
     merged with the (pre-existing, unverified-but-plausible-as-a-business-
     practice) in-person activation step for approved Silver/Gold members,
     so no informational content from the original was silently dropped.
  This also naturally introduces FORSA ID and Digital Pass without adding a
  new section — exactly the "integrate naturally, don't force it" guidance.

### Guarantor Portal
- Reviewed against the actual, tested Guarantor Portal (Konnect payment,
  bank/cash receipt upload, linked-student visibility, shared
  notifications, privacy-by-design scoping) — the section's claims all
  match what the platform actually does. No content changes beyond the tier
  name fix (Silver, not Argent) in the illustrative preview panel.

### University / Partner (within "Who are you?" and "Portals")
- Both accurately describe the real, tested University Portal (track
  enrolled students, real-time payment status) and Partner Portal (referral
  tracking, commissions, exclusive tools). No content changes needed.

### FAQ
- **No FAQ section exists on the page.** This wasn't invented — see
  Recommendations.

### Footer / Legal disclaimer
- **Finding — significant**: the legal disclaimer said only "FORSA is not a
  credit institution" — narrower than the approved policy's full required
  disclaimer (not a bank, lender, *or* credit institution).
  **Fixed**: now reads, in full, in all three languages: *"FORSA is a
  student ecosystem and tuition facilitation platform — it is not a bank,
  lender, or credit institution."* This is the single most important
  compliance fix in this audit — the exact sentence the approved policy is
  built around, now stated explicitly rather than implied.
- Contact section (within the footer) is accurate and complete — no changes.
- Portal links, ecosystem links: accurate; see Links below.

---

## Language compliance

A full sweep of the entire page (all three languages) for every explicitly
prohibited term (loan, borrower, lender, debt, credit, interest rate, APR,
consumer credit, financing company + French/Arabic equivalents) found
**zero matches** — consistent with the parallel `LANGUAGE_AUDIT_REPORT.md`
findings for the product portals. The corrections above are about aligning
with the *required* terminology (Tuition Facilitation Plan, Review
Committee Decision, Silver/Gold as kept English loanwords in French), not
about removing risky language that was already absent.

**Arabic and French were prioritized** in every fix: each multi-language
string was corrected Arabic-first, then French, then English, matching the
approved priority order — never English-only.

**Confirmed**: no wording on the page presents FORSA as a bank, lender,
credit provider, or loan company. The footer disclaimer now states this
explicitly and completely, in all three languages.

---

## Links

All 7 "Join"/"Register" CTAs (nav, hero, Bronze/Silver/Gold cards, Student
user-type card, Guarantor section) pointed to `/register` — a route that,
per this engagement's Phase 3.5 engineering pass, was intentionally removed
and now redirects to `/join` (the real Membership Request form). The
redirect means these links still *worked*, but pointed at a dead route by
coincidence rather than by design.
**Fixed**: all 7 now link directly to `/join`.

Portal links (student/university/partner/guarantor/admin subdomains) match
the six real, built, tested frontends from this engagement. The Finance
portal is correctly *not* linked from the public site — it's internal-only
staff tooling, consistent with every other portal's actual access model.

External links to `forsa.tn/genesis`, `forsa.tn/blog`, `forsa.tn/privacy`,
`forsa.tn/terms`, `forsa.tn/legal`, `forsa.tn/inpdp`, `forsa.tn/cookies`
could not be verified from this environment (no network access to confirm
these pages exist/are live) — flagged in Recommendations, not fixed.

---

## Technical review

| Item | Finding | Action |
|---|---|---|
| Mobile navigation | Nav links vanished below 900px with no replacement — no way to reach in-page sections on mobile | **Fixed** — added a functional hamburger menu; verified via real browser testing at a 390px viewport (see Verification) |
| SEO meta tags | No canonical URL, no `og:url`, no Twitter Card tags | **Fixed** — added `<link rel="canonical">`, `og:url`, `og:locale`, `og:site_name`, and `twitter:card`/`title`/`description` |
| Open Graph image | No `og:image` | **Not fixed** — no hosted image asset exists to reference; flagged in Recommendations |
| Accessibility — focus states | No `:focus-visible` styles anywhere — keyboard users had no visible focus indicator on any link or button | **Fixed** — added a page-wide `:focus-visible` outline using the brand cyan color |
| Accessibility — reduced motion | No `prefers-reduced-motion` handling; fade-in/scroll-reveal animations always ran | **Fixed** — added a media query that disables animations and instant-shows content for users who've requested reduced motion |
| Accessibility — semantics | Headings, ARIA labels, landmark roles, `aria-hidden` on decorative emoji | Already good — reviewed, no changes needed |
| Images | No `<img>` tags — logo is inline SVG, icons are emoji | Already optimal for performance; no changes needed |
| Performance | Single font family (Inter) via preconnect, no heavy assets, inline CSS/JS (no extra requests) | Already good; no changes needed |
| Spacing / typography | Consistent use of `clamp()` type scale, shared radius/shadow tokens throughout | Reviewed, no inconsistencies found |
| Icons | Emoji-based throughout, consistently `aria-hidden`; new step/trust icons (📝🎫🤖👥🎫) follow the same pattern | Consistent; no changes needed beyond the new icons already added |
| Broken links | Portal subdomains verified against real built frontends; external `forsa.tn/*` marketing/legal pages unverifiable from this environment | See Recommendations |

---

## New elements integrated

- **FORSA ID** and **FORSA Digital Pass** — added naturally into "How It
  Works" step 2 (issued on Bronze approval) and as a new 6th trust-strip
  item, rather than as a forced standalone section.
- **AI recommends, humans decide** — made explicit in step 3's copy ("it
  recommends, it never decides") and in the membership footnote.
- **Review Committee Decision** — named explicitly in step 4, the pricing
  fine print, the FORSA Score section, and the footnote — replacing vaguer
  "human review"/"human team" language.
- **Membership-first philosophy** and **trusted student ecosystem** — these
  were already the page's central framing (hero, membership section) and
  did not need to be added.
- **Updated student journey** — see "How It Works" above.
- **Final approved language** — see Language Compliance above.

Nothing was added that wasn't either already present or explicitly named in
this audit's brief.

---

## Verification performed

- **JS syntax**: extracted and validated with `node --check` — no errors.
- **CSS**: brace-balance checked — 253 open, 253 close.
- **HTML structure**: tag-balance checked for every structural element
  (`div`, `section`, `article`, `header`, `footer`, `nav`, `ul`, `li`, `a`,
  `button`, headings, `svg`) — no mismatches.
- **Real browser testing** (Playwright/Chromium), desktop (1440px) and
  mobile (390px) viewports:
  - Trust strip renders all 6 items correctly.
  - Language switching (FR→EN→AR) works; `dir="rtl"` correctly applied for
    Arabic; no console errors in any language.
  - Mobile hamburger menu opens, shows all 4 nav links plus the language
    switcher (relocated from the header row, which didn't have room for
    it alongside the logo, Join button, and burger at once), and correctly
    closes when a link is clicked.
  - All "Join"/"Register" CTAs confirmed pointing to `/join`.
  - Visual screenshots taken and reviewed for hero, membership cards, "How
    It Works," trust strip, guarantor section, and footer in French,
    English, and Arabic — layout, colors, and typography all confirmed
    unchanged from the original design.

---

## Recommendations for future improvement (not applied — out of this audit's scope)

1. **Add a real FAQ section.** Not present today; several natural questions
   ("Is this really free?", "What if I'm rejected?", "How is my data used?")
   would fit the page's existing tone and could reduce support-email
   volume. Deliberately not added here — the brief was to audit and correct
   the existing homepage, not add new sections.
2. **Verify the external `forsa.tn/*` links** (genesis, blog, privacy,
   terms, legal, inpdp, cookies) are live and point where expected — this
   environment has no network access to confirm.
3. **Add an `og:image`** once a hosted brand image asset exists — currently
   the logo only exists as inline SVG, which Open Graph doesn't support
   directly.
4. **Run a formal automated accessibility audit** (e.g., axe DevTools or
   Lighthouse) before public launch — this review checked structure,
   semantics, and focus states manually and found the page in good shape,
   but an automated contrast-ratio pass across every color pairing was not
   performed.
5. **Legal document content**: the Terms of Service and Privacy Policy
   pages this page links to don't exist in any repository this engagement
   has touched — consistent with the parallel `LANGUAGE_AUDIT_REPORT.md`'s
   finding that this content (tracked as T-226) remains outstanding for
   the legal/compliance team.
