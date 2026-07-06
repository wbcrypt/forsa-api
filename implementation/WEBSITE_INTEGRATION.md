# FORSA — Public Website Integration

Adds **About Us** and **FAQ** as full public pages alongside the homepage,
in French, English, and Arabic, sharing one header, footer, and design
system. Static HTML, no build step, no server-side routing.

Source content: `forsa-about-ar-v3.html` and `forsa-faq-ar-final.html`
(Arabic master). Homepage: `forsa-homepage-v5-final_4[.html|-en.html|-ar.html]`
(design system source of truth, as instructed).

## Pages added

| Page  | FR | EN | AR |
|-------|----|----|----|
| Home  | `fr/index.html` (+ root `index.html` alias) | `en/index.html` | `ar/index.html` |
| About | `fr/about/index.html` (+ root `about/index.html` alias) | `en/about/index.html` | `ar/about/index.html` |
| FAQ   | `fr/faq/index.html` (+ root `faq/index.html` alias) | `en/faq/index.html` | `ar/faq/index.html` |
| Login | `fr/login/index.html` (+ root `login/index.html` alias) | `en/login/index.html` | `ar/login/index.html` |

16 files total. Nav labels: FR "À propos"/"FAQ", EN "About"/"FAQ",
AR "عن فرصة"/"الأسئلة الشائعة". Login page added in Phase 3 (see
`PHASE3_NAVIGATION_AUDIT.md`) — a portal chooser, not a form: the "Log in"
nav/footer link used to point straight at `student.forsa.tn/login`
regardless of who clicked it.

## Routes

The requested routes (`/`, `/about`, `/faq`, `/login`, `/fr`, `/fr/about`,
..., `/en/*`, `/ar/*`) are implemented as a **folder-per-route,
`index.html` per folder** structure — the standard way to get clean URLs
from static files on any host that resolves `/about/` → `about/index.html`
(Apache, Nginx, Netlify, Vercel static, GitHub Pages, S3+CloudFront, etc.
all do this by default). No routing config exists in this repo since
there is no static file server wired up yet — point one at this
directory and the 16 requested routes resolve exactly as specified.

`/`, `/about`, `/faq` are literal copies of the `/fr/*` pages (French is
the default/root language). They are separate files, not a redirect, so
editing French content means editing both the `fr/` copy and the root
copy — see "Known limitation" below.

## Design system

Header, footer, logo, color tokens, typography, spacing, and the
language switcher are all lifted verbatim from the homepage's `<style>`
block and nav/footer markup — About and FAQ only add page-specific CSS
(`.about-*`, `.faq-*`) layered on top, reusing the same color variables,
shadow, and radius tokens. No visual language was invented.

**Mobile nav added.** The homepage design had no mobile navigation — nav
links simply used `display:none` below 980px with nothing to replace
them. Since About/FAQ links now need to be reachable on every device, a
hamburger menu was added (same nav, same links, slide-down panel). This
also fixes the pre-existing gap on the homepage itself.

**Language switcher made functional.** The EN/FR/ع pills were static,
non-interactive `<span>`s. They're now real links that jump to the
equivalent page in the other language (not just the homepage) —
e.g. clicking "EN" while on the Arabic FAQ page goes to the English FAQ
page, not the English homepage.

**FORSA Score section.** Handled as a separate, earlier fix in this same
session: the section was missing from the v5 homepage despite the nav
still linking to `#score`. Rebuilt from scratch (trust-building 4-step
timeline + 4 compact cards, not a restoration of the old version) and is
included in the homepage content these pages reuse.

## Translation notes

Arabic is the master source, per instruction. French and English are
adapted, not transliterated — e.g. Arabic "من نحن؟" (literally "who are
we") is rendered as "Who we are" / "Qui sommes-nous ?", not a stilted
literal match.

Approved terminology used consistently across all three languages:
FORSA ID / Identifiant FORSA / معرف فرصة; FORSA Digital Pass / Pass
digital FORSA / بطاقة فرصة الرقمية; Membership Request / Demande
d'adhésion / طلب عضوية; Tuition Facilitation Plan / Plan de facilitation
des frais universitaires / خطة تيسير المعاليم الجامعية; AI recommendation
/ Recommandation IA / توصية الذكاء الاصطناعي; Review committee decision /
Décision du comité de revue / قرار لجنة المراجعة.

**Terminology note carried forward, not resolved:** this task's brief
specifies "digital educational ecosystem" / "Écosystème éducatif
digital" / "منظومة تعليمية رقمية" as the canonical ecosystem description.
The existing homepage (from the earlier language-audit session) uses
"student ecosystem" / "écosystème étudiant" / "منظومة الطلاب" instead.
Both are accurate, approved framings from two different sessions — they
are not in conflict on compliance grounds, but they are two different
phrases for the same concept. About/FAQ use the newer "digital
educational ecosystem" phrasing per this task's explicit terminology
list; the homepage was left as-is since rewording it wasn't in scope
here. Worth reconciling to one phrase site-wide in a future pass.

**Banned-term avoidance:** no instance of loan/prêt/قرض,
lender/prêteur/دائن, credit institution/organisme de crédit/مؤسسة
ائتمان, interest rate/taux d'intérêt/نسبة فائدة, or bank-as-self-
description anywhere in the new pages. The FAQ explicitly states FORSA
is not a bank, lender, or credit institution, and operates as a
reseller/distributor of educational services from partner universities,
within Tunisian law — both as a dedicated Q&A and in the shared footer
legal line (instruction #6).

## Footer

Every page shares one footer with: Ecosystem (Get Started, FORSA Score,
How It Works, About, FAQ), Portals (all 4), Contact (email + 3 audience
links), and a new **Legal** column (Login, Privacy Policy, Terms of Use)
— plus the expanded compliance disclaimer below the fold.

## Remaining legal-policy links still missing

- **Privacy Policy** and **Terms of Use** footer links point to
  `https://forsa.tn/privacy` and `https://forsa.tn/terms` — these pages
  do not exist yet on the live domain. Placeholder URLs, not placeholder
  pages; needs real destinations before launch.
- No dedicated Cookie Policy or Data Protection Officer contact page —
  the FAQ's data-protection answer covers this in prose but there's no
  standalone reference page for it.
- No sitemap.xml / robots.txt added (out of scope for this pass, flagging
  since it affects discoverability of the new /about and /faq routes).

## Known limitation — root-level French duplication

`/`, `/about`, `/faq` are separate physical files from `/fr/*`, not a
redirect or symlink, because plain static hosting has no server-side
alias mechanism to rely on. Practical effect: a future French content
edit must be applied to both copies. If a real static host/CDN is
selected for deployment, the cleaner fix is to configure `/`, `/about`,
`/faq` as URL rewrites to the `fr/*` files at the server/CDN level and
delete the duplicated root copies.

## Testing performed

Automated (Playwright) across all 12 pages: `lang`/`dir` attributes
correct per language, zero console/page errors, every internal link
resolves to a file that actually exists, language switcher has exactly
one active pill and targets the equivalent page in each language, mobile
hamburger menu opens and every link inside it becomes visible and
clickable (caught and fixed a real bug here — see below), FAQ accordion
opens on click, and the homepage's `#score` anchor is present and
scrolls correctly. HTML tag-balance checked on every file.

**Bug caught and fixed during testing:** the homepage's original CSS
hides all `<a>` tags inside `.links` below 980px (`display:none`) with
nothing to replace them. The initial hamburger-menu patch only restored
`opacity`, not `display` — so the mobile dropdown opened but every link
inside it stayed invisible except one. Fixed by restoring `display`
explicitly per element type (plain links, buttons, and the lang-switcher
pills each need a different `display` value). Also caught: converting
the language switcher from `<span>` to `<a>` left it unstyled, since the
original CSS only targeted `.langs span` — added `.langs a` styling to
match.
