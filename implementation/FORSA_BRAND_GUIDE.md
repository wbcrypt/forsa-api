# FORSA Brand Guide

The single source of truth for FORSA's visual identity across every product surface: the public website, the Student/Guarantor/University/Partner portals, the Admin Dashboard, and transactional emails.

All assets referenced below live in [`implementation/brand-assets/`](./brand-assets/).

---

## 1. Logo

### Official marks

| Mark | File | Use |
|---|---|---|
| Icon + wordmark (horizontal lockup) | `brand-assets/forsa-logo-lockup.png` | Primary mark. Use wherever there's room for the full lockup — page headers, marketing, documents. |
| Icon only (transparent) | `brand-assets/forsa-icon.png`, `forsa-icon-512.png` | Compact contexts: portal nav bars/sidebars (paired with a text "forsa" wordmark), loading screens, in-app marks. |
| Icon on navy square (app-icon style) | `brand-assets/forsa-app-icon-navy.png` | Favicons, apple-touch-icon, Android home-screen icons, anywhere a filled-square icon is required. |

The logo is a graduation cap merged with an "F" swoosh, rendered in a navy-to-cyan gradient. It always reads left-to-right regardless of page direction (the nav row is locked to `direction:ltr` even on the Arabic site, so the mark never mirrors).

### Clear space

Keep clear space around the mark equal to at least the height of the graduation cap's brim (roughly 20% of the icon's total height) on all sides. Don't let text, borders, or other UI crowd closer than that.

### Minimum size

- Icon alone: **20px** height minimum (below this the cap/swoosh detail degrades).
- Horizontal lockup: **28px** height minimum.
- Favicon contexts (16×16, 32×32): use the pre-rendered navy-square favicon files directly — don't re-derive from the transparent icon at these sizes, the filled background is what keeps it legible at that scale.

### Incorrect usage

- Don't recolor the gradient (no single-color, inverted, or off-brand-hue versions).
- Don't stretch or crop the icon out of its proportions.
- Don't place the transparent icon directly on a busy photo or low-contrast background — use the navy-square version instead.
- Don't pair the icon with any wordmark styling other than the lowercase `f`**o**`rsa` treatment (lowercase, the "o" in cyan, everything else in navy — see Typography below).

### A known limitation, and what to do about it

The only source available for this brand pass was a flattened raster composite (1536×1024px), not a vector master. Extracted crops top out at roughly 122–147px before upscaling, so **512×512 icons (Android/PWA) are visibly softer than a true vector source would produce**, even after sharpening. This is fine for now but isn't final-quality. **Recommendation:** commission or produce a true vector (SVG/AI/Figma) master of this exact mark, then regenerate every derived size from that instead of from the raster crop. Until then, treat everything in `brand-assets/` as the correct *design*, not necessarily the correct *resolution ceiling*.

---

## 2. Color Palette

Anchored on the two colors actually present in the approved logo (sampled directly from its gradient), which also happen to already match the website's existing tokens — so the whole ecosystem now converges on one palette instead of three slightly different ones.

### Primary

| Token | Hex | Use |
|---|---|---|
| **Navy** (primary brand color) | `#1B3A8C` | Headers, primary text on light backgrounds, primary buttons (dark variant), nav wordmark |
| **Navy, dark** | `#123077` / `#122868` | Gradients, footers, dark section backgrounds |
| **Cyan** (accent) | `#00C4C8` | Accent highlights, primary CTA buttons, links, the "o" in the wordmark |
| **Cyan, dark** | `#00A8AC` | Button hover states, darker accent needs |

### Full scale (Tailwind — used identically across all 5 portals + dashboard)

```
navy:  50 #EEF2FC   100 #DCE6F9   200 #B0C4EF   300 #86A3E0   400 #5378CC
       500 #35599E  600 #274787   700 #1F3D8F   800 #1B3A8C   900 #122868   950 #0A1740

teal:  50 #E6FBFB   100 #CCF7F8   200 #99EEF0   300 #4DE0E3   400 #33D6D9
       500 #00C4C8  600 #00A8AC   700 #007478   800 #0A4145   900 #082F33
```

### Neutrals & UI tokens (from the website design system)

```
--soft:  #F4F8FF   /* light section backgrounds */
--line:  #DCE7F6   /* borders, dividers */
--text:  #24324A   /* body text */
--muted: #69758A   /* secondary text */
```

### Tier colors (Bronze / Silver / Gold — unchanged, not part of this pass)

```
--bronze: #B87333
--silver: #8FA1B5
--gold:   #DCA51B
```

### What changed

Every portal (`forsa-student`, `forsa-guarantor`, `forsa-university`, `forsa-partner`, `forsa-dashboard`, `forsa-finance`) previously ran a **different, mismatched** navy/teal (`navy-800: #1B2A5E`, `teal-500: #14b8a6` — a more muted, purple-leaning navy and a green-leaning teal). Those did not match the approved logo's actual colors. All six were updated in place via their `tailwind.config.js`, so every `bg-navy-800`, `text-teal-500`, etc. class already in the codebase now renders the correct color with no component-level changes needed. A handful of hardcoded hex values outside the Tailwind config (chart colors, QR-code branding, print stylesheets, a focus-outline color) were updated to match individually — see the Brand Audit Report for the exact file list.

**Do not use** any other blue or teal shade anywhere in the product. If a new one is needed, it must be a tint/shade of the scale above, not a new hue.

---

## 3. Typography

Single typeface across the entire ecosystem: **Inter** (Google Fonts), weights 400–900.

| Role | Size | Weight | Letter-spacing | Color |
|---|---|---|---|---|
| H1 (hero) | `clamp(44px, 5.4vw, 74px)` | 900 | -0.055em | Navy, accent line in Cyan |
| H2 (section) | `clamp(32px, 4vw, 46px)` | 900 | -0.04em | Navy |
| H3 (card/step title) | 15.5–28px depending on context | 900 | -0.02em | Navy |
| Paragraph | 15–18px | 400 | normal | `--text` / `--muted` |
| Button label | 13–15px | 800–900 | normal | White on filled buttons, Navy on ghost buttons |
| Nav label | 13–13.5px | 700 | normal | Navy at 90% opacity |
| Eyebrow / label | 11–13px | 900 | 0.13–0.15em, uppercase | Cyan (dark variant) |

Line-height: 1.6 for body copy, 1.08–1.2 for headings. Headings always get tighter letter-spacing as size increases (see the negative values above) — this is a deliberate part of the type feel, not an oversight.

---

## 4. Buttons

Two variants, used identically everywhere:

- **`btn-main`** (primary): filled Cyan background, white text, 999px (fully rounded) border-radius, `box-shadow: 0 14px 32px rgba(0,196,200,.25)`. Hover: darker Cyan (`#00A8AC`) + `translateY(-1px)`.
- **`btn-ghost`** (secondary): transparent background, 1.5px Navy border at 22% opacity, Navy text, same full rounding.

Height: 42–46px depending on context. Font-weight 800, centered content via `inline-flex`.

## 5. Cards

Border-radius 18–24px depending on card type (`--r: 24px` is the base token). Border: `1px solid var(--line)`. Shadow scales with card importance:

- Standard card: `0 12–18px 40–44px rgba(27,58,140,.05–.075)`
- Elevated/hero card: `--shadow: 0 24px 70px rgba(27,58,140,.11)`

Cards never use a heavier shadow than the `--shadow` token — that's the ceiling for the whole system.

## 6. Badges / Pills

Fully rounded (999px), uppercase, 11px, weight 900, letter-spacing 0.04em. Colored fill matches context (tier color for membership pills, Cyan/Navy for status).

## 7. Icons

Two icon treatments coexist by design, not by accident:

- **Inline SVG, stroke-based** (`stroke-width: 1.8`, `currentColor`) for functional UI icons — portals, steps, feature callouts. Keep new icons on this same stroke weight.
- **Emoji**, used sparingly and only in the FORSA Score trust-timeline section (🪪💳⭐🥇) — a deliberate, minimal choice for that one section, not a general pattern. Don't introduce emoji elsewhere in the product; use the SVG stroke style for everything else.

Don't mix in a third icon library (Font Awesome, Material Icons, etc.) — portals currently use `lucide-react`, which is stroke-based and compatible with this same visual weight; keep using it there.

## 8. Shadows & Radius reference

```
--r:      24px   /* default card radius */
--shadow: 0 24px 70px rgba(27,58,140,.11)   /* elevated card / hero ceiling */
```

Smaller components (badges, buttons) use full 999px rounding. Nothing in the system uses sharp (0px) corners.

## 9. Grid & Spacing

- Content max-width: `1180px` (`.wrap`), except the nav row specifically, which needs `1320px` to fit 6 links + language switcher + 2 buttons without wrapping (see the nav-crowding fix in `WEBSITE_INTEGRATION.md`).
- Section vertical padding: `76px` top/bottom (`54px` on mobile).
- Card/grid gaps: 16–22px depending on density.
- Breakpoints: mobile menu activates at `1200px` (not the more common 768/980px — deliberately wider, because this nav specifically needs the room); content grids (hero, tiers, portals, footer) collapse to a single column at `980px`.

## 10. Language & Terminology

**Arabic is the canonical content source.** French and English are official adaptations authored from the Arabic, not independent originals or literal word-for-word translations. See the terminology table below — use these exact phrases in all three languages, every time; never mix in a synonym.

| Concept | Arabic | French | English |
|---|---|---|---|
| Ecosystem | منظومة تعليمية رقمية | Écosystème éducatif digital | Digital educational ecosystem |
| Member | عضو فرصة / عضوية فرصة | Membre FORSA | FORSA member |
| Membership application | طلب عضوية | Demande d'adhésion | Membership Request |
| Facilitation plan | خطة تيسير المعاليم الجامعية | Plan de facilitation des frais universitaires | Tuition facilitation plan |
| Digital ID card | بطاقة فرصة الرقمية | Pass digital FORSA | FORSA Digital Pass |
| Member ID | معرف فرصة | Identifiant FORSA | FORSA ID |
| AI's role | توصية الذكاء الاصطناعي | Recommandation IA | AI recommendation |
| Final decision | قرار لجنة المراجعة | Décision du comité de revue | Review committee decision |
| Legal grounding | القوانين والتراتيب الجاري بها العمل في الجمهورية التونسية | lois et réglementations en vigueur en République tunisienne | laws and regulations in force in the Republic of Tunisia |

**Never describe FORSA as:** a bank, a lender, a credit institution, a loan provider, or a finance company — in any of the three languages, including synonyms (French "financement", "crédit", "prêt"; Arabic "قرض", "تمويل" in the banking sense; English "financing", "loan", "credit"). The one approved self-description is: *a digital educational ecosystem, acting as a reseller/distributor of educational services provided by partner universities, within the laws and regulations in force in Tunisia.*

Known open item: the backend's transactional email templates (`src/notifications/email-templates.ts`) currently use "financement" ("0% financing") throughout — a leftover from before this terminology was formalized. Flagged in the Brand Audit Report as needing a full content pass; only colors were touched there in this phase.

## 11. UI Examples

See the live reference implementation:

- Homepage, About, FAQ (all 3 languages): [`implementation/website/`](./website/)
- Nav, footer, button, card patterns: any page in the website above — they're all built from the same shared template (see `WEBSITE_INTEGRATION.md`).

---

*This document reflects the state of the FORSA brand as of the Phase 2 consistency pass. Update it whenever the palette, logo, or type scale changes — this file, not any individual repo, is the source of truth.*
