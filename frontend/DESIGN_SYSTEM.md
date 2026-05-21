# London School Explorer — Design System

## Overview

The Atlas design language. Warm, editorial, authoritative. Inspired by quality city guides and data journalism — a tool that feels worthy of one of the most important decisions a parent makes.

The one unforgettable element: **the 8px Ofsted quality band** on every school card. Before reading a word, you see the colour pattern across the grid — green, blue, amber, red. It turns the results into a visual map of school quality across London.

---

## Typefaces

Loaded from Google Fonts via `index.html`. Never use system fonts or Inter.

| Role | Font | Usage |
|------|------|-------|
| Display | **Fraunces** (variable opsz/wght) | School names, page headlines, hero text, modal titles |
| UI | **Outfit** (300–700) | All labels, body copy, buttons, filter controls |
| Data | **JetBrains Mono** (400–700) | All statistics: Attainment 8, % RWM, A-level points, stat cards |

### CSS variables
```css
--font-display : 'Fraunces', Georgia, serif;
--font-ui      : 'Outfit', system-ui, sans-serif;
--font-mono    : 'JetBrains Mono', 'Fira Code', monospace;
```

### Rules
- Always pair `font-optical-sizing: auto` with Fraunces so the variable axis works
- Use `letter-spacing: -0.03em` on large Fraunces display text
- Use `letter-spacing: -0.02em` on card-level Fraunces names
- JetBrains Mono goes on `.card-metric-value`, `.stat-card-value`, `.shortlist-metric`

---

## Colour Palette

All colours are CSS custom properties on `:root`. Never hardcode hex values in components — always use the variable.

### Base surfaces (warm, not cold)
```
--canvas    #F2EFE9   Page background — warm stone parchment
--surface   #FEFCF8   Cards, panels — cream white
--surface-2 #F7F4EE   Alternate surface, table headers, filter bar hover
```

### Dark panel — Ink
```
--ink        #0D1F35   Topbar + hero background (they share this)
--ink-muted  rgba(255,255,255,.55)   Subdued text on dark bg
--ink-subtle rgba(255,255,255,.12)   Borders/dividers on dark bg
```

### Primary CTA — London Brick
```
--brick      #E05B2B   Primary buttons, active states, links
--brick-dark #C44E22   Hover/pressed state
--brick-pale #FDF0EB   Tint bg for selected/active pill controls
```

### Ofsted Quality Colours
These are **first-class design tokens** — they appear structurally (card bands, hero backgrounds), not just as decoration.

```
--outstanding      #1E6B3C   Deep forest green
--outstanding-pale #EDFAF3   Badge/card backgrounds
--good             #1847A8   Confident navy
--good-pale        #EBF1FD
--ri               #B87008   Warm amber
--ri-pale          #FEF7E6
--inadequate       #C41E1E   Strong red
--inadequate-pale  #FEF0F0
--uninspected      #6B6458   Warm taupe
--uninspected-pale #F5F3F0
```

### Text
```
--text        #1C1917   Warm near-black (primary)
--text-muted  #6B6458   Warm taupe (labels, secondary text)
--text-subtle #A09890   Light muted (meta, hints, placeholders)
```

### Borders
```
--border       #E2DDD5   Standard warm beige border
--border-light #EDECE8   Very light — card inner dividers
```

### Shadows
All shadows use warm brown, not cold black.
```
--shadow-sm  0 1px 3px rgba(28,25,23,.06), 0 1px 2px rgba(28,25,23,.04)
--shadow-md  0 4px 16px rgba(28,25,23,.10), 0 2px 6px rgba(28,25,23,.06)
--shadow-lg  0 12px 40px rgba(28,25,23,.15), 0 4px 12px rgba(28,25,23,.08)
```

---

## Radius Scale

```
--r-sm   6px    Small controls, table cells
--r-md   10px   Cards, filter inputs, info banners
--r-lg   14px   Modal, frosted compare bar
--r-xl   20px   Hero search bar stacked (mobile)
--r-pill 999px  All pill-shaped buttons and chips
```

---

## Layout

### Page constraint
```
--page-max  1280px   Max content width
--page-px   24px     Horizontal padding (16px on mobile)
--topbar-height 60px  Used to offset sticky elements
```

### Key layout rules
- Topbar and Hero share `--ink` background — they appear as one continuous dark panel on the home page
- Filter bar sticks at `top: var(--topbar-height)` below the topbar
- No sidebar on desktop — horizontal filter bar replaces it entirely
- Cards grid is 2-column on desktop (`≥960px`), 1-column below

---

## The Ofsted Band System

The **card band** is the signature design element of this app. A coloured 8px strip runs the full left edge of every school card, colour-coded by Ofsted rating. It grows to 10px on hover.

### Mapping function (single source of truth)
Use `ofstedBandClass()` and `ofstedCssColor()` from `OfstedBadge.tsx`:

```tsx
import { ofstedBandClass, ofstedCssColor } from '../components/OfstedBadge'

// Card band
<div className={`card-band ${ofstedBandClass(school.ofsted_overall)}`} />

// Detail hero background
<div className="detail-hero" style={{ background: ofstedCssColor(data.ofsted_overall) }}>
```

### CSS band classes
```
.band--outstanding   background: var(--outstanding)
.band--good          background: var(--good)
.band--ri            background: var(--ri)
.band--inadequate    background: var(--inadequate)
.band--new           background: var(--border)
.band--uninspected   background: var(--uninspected-pale)
```

---

## Component Reference

### Buttons

| Class | Usage |
|-------|-------|
| `.btn.btn-primary` | Primary action — brick background |
| `.btn.btn-ghost` | Secondary — outlined |
| `.btn.btn-danger-ghost` | Destructive — red outlined |
| `.btn.btn-sm` | Small variant (13px, less padding) |
| `.btn-icon` | Tiny pill (28px height) — card Save/Compare |
| `.btn-icon.saved` | Active state — brick colour |
| `.btn-icon.compared` | Active state — navy/good colour |
| `.btn-compare-go` | Compare bar CTA — pill, brick |
| `.link-button` | Text-only button — brick colour |

### Badges

| Class | Usage |
|-------|-------|
| `.badge.badge--outstanding` | Green — Ofsted Outstanding |
| `.badge.badge--good` | Blue — Ofsted Good |
| `.badge.badge--ri` | Amber — Requires improvement |
| `.badge.badge--inadequate` | Red — Inadequate |
| `.badge.badge--new` | Grey — New Ofsted framework |
| `.badge.badge--uninspected` | Light grey — Not inspected |
| `.badge.badge--selective` | Amber/yellow — Selective school |
| `.badge.badge--sixth` | Purple — Has sixth form |

On the dark `.detail-hero` panel, all badges automatically get white translucent treatment via `.detail-hero .badge`.

### Filter Bar Controls

| Class | Usage |
|-------|-------|
| `.filter-pill` | Wrapper for `<select>` — styled as pill |
| `.filter-pill--active` | When filter has non-default value (brick tint) |
| `.filter-toggle` | Pill button replacing checkboxes |
| `.filter-toggle--active` | When toggled on |
| `.filter-search-input` | Text search input — expands on focus |
| `.postcode-chip` | Shows active postcode location |

### Cards

| Class | Usage |
|-------|-------|
| `.school-card` | Horizontal card container (flex row) |
| `.school-card.in-compare` | Brick border glow when in comparison |
| `.card-band` | 8px left strip — requires band-- class |
| `.card-body` | Content area |
| `.card-name` | School name — Fraunces 17px |
| `.card-meta` | Borough · Phase · Type · Pupils row |
| `.card-footer` | Bottom row: badges left, metric right |
| `.card-metric-value` | Large mono number |
| `.card-benchmark` | up/down/avg comparison note |

---

## Design Decisions Log

**Why Fraunces?** It's a variable serif with an optical size axis — it looks refined at large sizes and sturdy at small ones. It has warmth and character without being decorative. Unlike Playfair Display, it doesn't feel Victorian.

**Why London Brick (#E05B2B)?** The corporate blue default is the most overused colour in SaaS. Terracotta/brick is warm, unmistakably human, and evokes London's built environment. It creates energy without aggression.

**Why no sidebar?** 260px of wasted horizontal space on desktop. The horizontal filter bar gives the cards room to breathe in a 2-column layout — each card is ~600px wide and can hold proper horizontal layout with the quality band.

**Why the Ofsted band?** Parents scan for quality signal first, details second. The band lets you read the grid in a second before reading a word. It's the most information-dense element in the design.

**Why JetBrains Mono for data?** Numbers in a proportional font feel accidental. Mono feels measured, deliberate, technical-but-warm. It separates data from prose visually without a size change.
