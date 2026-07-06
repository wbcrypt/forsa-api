# FORSA Phase 3 — Navigation & User Journey Audit

Scope: the public website (`implementation/website/`, 16 pages, 3 languages) plus code-level verification of the entry points it hands off to (`forsa-student`'s `/join` and `/login`, and the `/login` route on all 5 portals). The 5 portals themselves are separate applications/deployments — this audit verifies the website's links *into* them are correct and complete, not their internal screens.

---

## 1. Every CTA and its destination

### Nav (identical structure on every page, all 16 files)

| Label (EN) | Destination | Type |
|---|---|---|
| Logo | Home page, same language | Internal |
| How It Works | `#how` (same page) or `{home}#how` | In-page anchor |
| Get Started | `#tiers` / `{home}#tiers` | In-page anchor |
| FORSA Score | `#score` / `{home}#score` | In-page anchor |
| Portals | `#portals` / `{home}#portals` | In-page anchor |
| About | About page, same language | Internal |
| FAQ | FAQ page, same language | Internal |
| FR / EN / ع | Equivalent page in that language | Internal |
| Log in | **Login portal chooser**, same language (fixed this phase — see §3) | Internal |
| Join for Free | `student.forsa.tn/join` | External |

### Homepage-only

| Element | Destination |
|---|---|
| Hero "Join for Free →" | `student.forsa.tn/join` |
| Hero "Discover how FORSA works" | `#how` |
| Bronze tier CTA | `student.forsa.tn/join` |
| Silver tier CTA | `student.forsa.tn/join` |
| Gold tier CTA | `student.forsa.tn/join` |
| Portal card × 4 (Student/Guarantor/University/Partner) | `https://{role}.forsa.tn` (root, not `/login` — these are "explore the portal" cards, not auth links) |

### FAQ-only

| Element | Destination |
|---|---|
| 5 category sidebar links | `#faq-N` anchors into the accordion, each verified to hit a real `<details id="faq-N">` |

### Login page (new, all 3 languages + root alias)

| Card | Destination |
|---|---|
| Student | `student.forsa.tn/login` |
| Parent / Guarantor | `guarantor.forsa.tn/login` |
| University | `university.forsa.tn/login` |
| Partner | `partner.forsa.tn/login` |
| Admin | `dashboard.forsa.tn/login` *(inferred — see §6)* |
| "New to FORSA? Join for Free" | `student.forsa.tn/join` |

### Footer (identical on every page)

| Column | Links |
|---|---|
| Ecosystem | Get Started, FORSA Score, How It Works (anchors), About, FAQ |
| Portals | Student/Guarantor/University/Partner portal roots |
| Contact | `hello@forsa.tn`, `students@`, `universities@`, `partners@forsa.tn` (mailto) |
| Legal | Log in (→ login chooser), Privacy Policy, Terms of Use |

**Result: zero `href="#"` placeholders, zero empty hrefs, zero dead-end buttons anywhere on the site.** Full CTA inventory captured programmatically for all 16 pages — every link resolves to either a real anchor, a real internal page, a real external subdomain, or a mailto.

---

## 2. Fixed this phase

### Issue: "Log in" misrouted every visitor to the Student portal

Before this audit, every "Log in" / "Connexion" / "تسجيل الدخول" button — in the nav and footer, on all 16 pages — pointed straight at `https://student.forsa.tn/login`. A guarantor, university, partner, or admin visitor clicking "Log in" from the marketing site would land on the *student* login screen.

**Fix:** built a new `/login` page (3 languages + root FR alias) as a portal chooser — five cards (Student, Parent/Guarantor, University, Partner, Admin), each linking to that portal's own `/login`. Reuses the homepage's existing `.portal` card component for zero visual drift. Nav and footer "Log in" now point here instead of directly to the student portal.

### Issue: hero decorative elements overflowed on tablet/mobile

Found during the responsive pass (technically a Phase 2 carry-over, fixed alongside this audit since it's the same website): the floating feature badges and background circle behind the hero phone mockup had no narrow-viewport rule, causing horizontal scroll at 834px and 390px across all 3 languages. Fixed by hiding both (purely decorative, `aria-hidden`) at the existing breakpoints where other hero decorations already disappear. Verified 0 overflow across 12 pages × 4 breakpoints after the fix.

### Regression caught and fixed during this same pass

Redeploying the site from the page generator after adding the login pages silently dropped the favicon `<link>` tags and the seven favicon/manifest asset files — they'd been patched into the previous build by hand and the generator's page template never actually included them. Caught by re-running the full test suite after redeployment (favicon count went from 7 to 0), fixed by re-injecting the tags and restoring the asset files, then re-verified.

---

## 3. Navigation audit results

- **Desktop / laptop / tablet / mobile:** 0 layout issues across 12 pages × 4 breakpoints (1440/1280/834/390px) after the hero-overflow fix above.
- **Language switcher:** verified on all 16 pages — exactly one active pill, and the other two always target the *equivalent* page (not the homepage) in the other two languages. Confirmed by live click-through: AR FAQ → click EN → lands on EN FAQ; FR Login → click AR → lands on AR Login.
- **Footer:** every link (Home/About/FAQ/Portals/Contact/Login/Privacy/Terms) resolves; live-clicked the footer's Login link from the About page and confirmed it lands on the login chooser.
- **No orphan nav items:** all 4 in-page anchors referenced by nav (`#how`, `#tiers`, `#score`, `#portals`) exist exactly once on every homepage, in all 3 languages.
- **No duplicate navigation:** confirmed visually and via the CTA inventory — no repeated nav entries.
- **Mobile nav:** hamburger menu opens, all 8 items (6 nav links + lang switcher + 2 buttons) become visible and clickable — this was fixed in Phase 2, re-verified here after the login-page addition.

---

## 4. User journeys

### New visitor → Membership Request

```
Homepage → "Join for Free" → student.forsa.tn/join → MembershipRequestPage
  → single combined form (name, email, phone, city, university, programme)
  → submit → confirmation screen ("Our team will review your request...")
  → (async, post-approval) email with set-password link → Bronze member,
    FORSA ID + Digital Pass issued → Member Dashboard
```

Verified at the code level in `forsa-student`: `/join` routes directly to `MembershipRequestPage` (not a raw signup form), and `/register` even redirects to `/join` — confirming a prior deliberate move away from account-first registration. This matches the intended journey's *intent* (Membership Request → Basic Info → Review → Bronze → ID → Pass → Dashboard) with one sequencing difference worth noting: email verification happens *after* the team reviews the request (as part of the approval email's set-password link), not before. That's a more secure order, not a defect — no unnecessary intermediate pages exist either way.

### Existing Student / Guarantor / University / Partner / Administrator

```
Homepage → Log in → Login chooser → [portal card] → {portal}.forsa.tn/login
```

All five destinations verified to exist as real routes in their respective repos (`grep` for `path="/login"` in each `App.tsx` — all five confirmed). The chooser itself was click-tested end-to-end (Playwright): correct hrefs, correct page reached, correct language preserved.

---

## 5. Every page and its links (summary)

| Page | Inbound (linked from) | Outbound (links to) |
|---|---|---|
| Home | Every page's logo/nav, login chooser's "Join for Free" | About, FAQ, Login, 4 portal roots, student join, in-page anchors |
| About | Every page's nav | Home, FAQ, Login, portal roots, mailto, legal |
| FAQ | Every page's nav | Home, About, Login, portal roots, mailto, legal, its own 16 accordion items |
| Login | Every page's nav/footer "Log in" | Home (logo), About, FAQ, 5 portal `/login` URLs, student `/join` |

No page is unreachable; no page is a dead end (every page has a working way back to Home via the logo, at minimum).

---

## 6. Remaining issues / recommendations

1. **Admin domain unconfirmed.** No repo or env file documents a public subdomain for the Admin Dashboard. `dashboard.forsa.tn` was inferred from the `forsa-dashboard` repo name, following the same `<role>.forsa.tn` pattern as the other four portals — but this needs explicit confirmation from the team before launch. If the real domain differs, it's a one-line fix in `content_login.py` → `PORTAL_LOGIN_URLS`.
2. **Privacy Policy / Terms of Use still point to pages that don't exist yet** (`forsa.tn/privacy`, `forsa.tn/terms`) — flagged already in the Phase 2 report, still open.
3. **Portal cards on the homepage link to portal *roots*, not `/login`** — this is intentional (they're framed as "explore this portal" cards with descriptive copy, not auth shortcuts), but worth a sentence of confirmation that this is the desired behavior rather than an oversight, since it's a subtly different pattern from the new Login page's cards.
4. **The 5 portal apps themselves were not journey-tested past their `/login` and `/join` entry points** — verifying what happens *inside* each portal (dashboard content, forms, etc.) was outside this audit's reach since they're separate running applications, not part of the static website being audited.

---

*Phase 3 (navigation & user journey) complete for the public website. `WEBSITE_INTEGRATION.md` updated with the new `/login` route; `FORSA_BRAND_GUIDE.md` unaffected (no new brand elements introduced — the login page reuses the existing portal-card component verbatim).*
