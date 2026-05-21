# London School Explorer — Parent UX Review (v1 Alpha)

**Reviewer perspective:** Parent searching for a primary or secondary school in London.  
**Date:** May 2026  
**Scope:** Full walkthrough of Search, School Detail, Rankings, and Compare features.

---

## Executive Summary

The alpha has solid data foundations and a clean visual design. A technically-minded user can extract real value from it today. But from a parent's perspective — someone who may be choosing a school for the first time, under deadline pressure, without knowing what "Attainment 8" means — the app creates more friction than it removes. The three biggest gaps are: no location-based search, no plain-English explanations of metrics, and no way to save or share a shortlist. These three changes alone would transform the experience.

---

## 1. The Search Page

### What works
- Borough, phase, gender, type, sixth form, and selective filters cover the basics well.
- Ofsted badge on each card is immediately legible (Outstanding, Good, etc.).
- Showing a single key metric per card (Expected RWM for primaries, Attainment 8 for secondaries) is a good contextual choice.
- 3,196 schools is a credible number — it builds trust that the data is comprehensive.

### Pain points

**No postcode or distance search.**  
This is the single most important missing feature. The first thing any parent does when choosing a school is ask "what's near me?" The current borough filter is a blunt instrument — boroughs are large, and a parent in Chiswick doesn't want to scroll through every Hounslow school. Without proximity search, the app forces parents to already know which borough to filter by, which defeats the purpose.

**Results default to alphabetical order.**  
Alphabetical means "Abacus Belsize" is always first. A parent doesn't care about alphabetical — they want the best schools near them, or Outstanding schools first. There is no way to sort the list on the search page (sorting is only on the Rankings page, which is a separate route the parent may never find).

**Jargon-heavy school type labels.**  
Labels like "PRU", "other", and "Free School" will confuse most parents. A parent seeing "PRU" has no idea it stands for Pupil Referral Unit (a school for excluded pupils). "Other" tells them nothing. These need plain-English labels or at minimum a tooltip.

**The "+" compare button is invisible.**  
Each school card has a small "+" in the top-right corner. There is no tooltip, no label, no hint text explaining it adds the school to a comparison. Most parents will never discover it. It should be labelled "Compare" or "Add to compare".

**No map view.**  
Parents think spatially. They want to see where schools are relative to their home, the bus route, or the secondary feeder schools. A map layer — even a simple "view on Google Maps" link from the address — would dramatically improve spatial understanding.

**No indication of data freshness.**  
The page says "3,000+ London schools" but doesn't say when the data was last updated. A parent wondering whether the Ofsted rating is from 2019 or 2024 has no way to know from this page.

---

## 2. The School Detail Page

### What works
- The five-tab layout (Overview, Academic results, Destinations, Context, History) is a logical structure.
- The address, head teacher name, and website are present and the website is a live link.
- The Ofsted inspection history tab is genuinely useful — seeing a school has been Outstanding for six consecutive years is reassuring.
- The "+ Compare" button on the detail page is prominent and the resulting comparison tray persists across navigation.
- Financial data (income/expenditure per pupil) is unexpectedly interesting — showing a school spends £14k per pupil versus £10k is a real differentiator.

### Pain points

**Overview tab is incomplete.**  
The Ofsted section only shows "Leadership & management". Under the new Ofsted framework there are four sub-judgements (Quality of Education, Behaviour and Attitudes, Personal Development, Leadership & Management). Parents care most about Quality of Education, but it isn't shown. There's no link to the full Ofsted report on gov.uk either.

**"Inspected (new framework)" badge is unexplained.**  
This means the school was inspected under Ofsted's 2019 Education Inspection Framework (EIF). A parent has no context for this. They may wonder if "new framework" means the result is recent or if it's a different grading system.

**Crucial information is absent.**  
A parent looking at a school profile will immediately ask:
- How do I apply? (no admissions link, no local authority application deadline)
- Is there a waiting list / how oversubscribed is it?
- What's the school's phone number? (address shown, not phone)
- Is this a faith school? (religious character not shown)
- What is the catchment area?
- Are there any open evenings I can attend?

None of these are answered.

**Academic results tab: one year, no context.**  
The table shows a single row: `2024/25 | 84.0% | 32.0% | –`. Three problems:
1. There is no historical trend — is 84% improving or declining? A parent can't tell.
2. There is no national or London average to benchmark against. 84% sounds good, but is it above or below average? Without a comparator, the number is meaningless.
3. Column headers ("% Expected RWM", "% Greater depth", "Progress (R/W/M)") are pure DfE jargon. A first-time parent will not know what any of these mean.

**Destinations tab is almost always empty for primaries.**  
Destinations data tracks where pupils go after leaving school — crucial for secondary parents (university destinations) but not collected for primary schools. The tab shows "No destinations data available for this school." without any explanation of why. A parent may think the school failed to report data, or that something is wrong.

**Context tab has multiple "Not available" fields.**  
FSM eligible (6yr), SEN (EHCP), and Absence rate all show "Not available" for this school. Seeing three "Not available" entries in a row feels like broken data, even if it's legitimately absent. The terms "FSM", "EAL", "SEN", "EHCP" are all acronyms that need plain-English translations.

**History tab dates look suspicious.**  
Every historical Ofsted entry is dated "31 August 20XX". This appears to be a data artefact (a default date used when the exact inspection date is unknown) rather than real inspection dates. A parent who notices this will distrust the whole dataset.

**The tab bar overflows on mobile.**  
The "History" tab is partially cut off on a standard phone-width viewport. The tab bar needs to scroll horizontally, which is not obvious to a user.

**The compare tray obscures page content.**  
Once a school is added to the comparison tray, a dark bar appears fixed at the bottom of the screen. On a small screen this covers the last row of whatever data is visible on the detail page. There is no way to collapse the tray without removing the school.

---

## 3. Rankings Page

### What works
- The medal icons (gold/silver/bronze) give an immediate visual hierarchy.
- Rank-by options cover the key metrics: Ofsted, Attainment 8, Gr5+ E&M, % Exp RWM, A-level pts.
- The "50 Outstanding" summary badge is a great quick-answer feature.
- Filters mirror the search page (borough, phase, type).

### Pain points

**Still no distance filter.**  
Even on the Rankings page, there is no way to answer "what are the top-ranked primaries within 2 miles of me?" — the most natural parent question when using a rankings view.

**Rank-by labels are still jargon.**  
"Attainment 8", "Gr5+ E&M", "% Exp RWM", "A-level pts" — none of these mean anything to a parent who didn't go through the UK system recently. A brief tooltip or "(GCSE score)" annotation would help enormously.

**No national rank context.**  
Seeing a school ranked #1 in London for Attainment 8 is great — but what does that mean nationally? Is London above or below the national average? Adding a "London average" marker on the ranking would anchor the data.

**Ranking treats all school types equally.**  
A parent filtering for secondaries sees grammar schools, independent schools, and state comprehensives ranked together. A grammar school or fee-paying school will almost always top the academic rankings, which makes the list misleading for parents looking for the best non-selective state school.

---

## 4. Compare Page

### What works
- Side-by-side comparison with green/red highlighting for best/worst is immediately useful.
- URL-based state (e.g., `/compare?urns=100053,136663`) means the comparison is shareable in principle.
- Up to 5 schools can be compared.

### Pain points

**The compare page ignores the comparison tray.**  
If a parent adds a school to the tray from a school detail page and then navigates to `/compare`, the page says "Add at least 2 schools to start comparing" — ignoring the school already in the tray. The tray and the compare page are not connected. This is confusing and breaks the expected flow.

**School names are truncated in the column headers.**  
"Abbs Cross Acader..." loses the full name and both parent schools look similar. The headers need to be taller or use a wrapped layout.

**No explanation of the green/red highlighting.**  
Green means best in comparison, red means worst — but this is never explained. A parent may think red means the value is below a national threshold, which is a different (and potentially misleading) interpretation.

**No ability to save or share a comparison.**  
There is no "Share this comparison" button. The URL does contain the URNs, so a tech-savvy parent could copy the URL — but most won't know to do this. A "Copy link" button would make this trivially easy.

**"Not available" appears frequently in compare rows.**  
When data is missing for one school (e.g., Progress 8), the row shows "Not available" vs a real number. The green/red highlighting still fires on the real number, making it look like the unavailable school is worse when the data simply isn't there.

**No Ofsted sub-judgements in compare.**  
The Ofsted row just shows the inspection status ("Inspected (new framework)") rather than the actual overall grade. A parent comparing two schools needs to see "Outstanding vs Good" in the Ofsted row.

---

## 5. Missing Features — Opportunities for v2

These are features a parent would expect to find, ranked by likely impact:

### High priority

| Feature | Why a parent needs it |
|---|---|
| **Postcode / distance search** | Finding nearby schools is the primary use case |
| **Map view** | Parents think spatially — school location relative to home, transport, sibling schools |
| **Plain-English metric tooltips** | RWM, FSM, EAL, EHCP, Attainment 8, Progress 8 need a single-sentence explanation on hover |
| **Admissions link / application info** | The next step after choosing a school is applying — the app currently stops at browsing |
| **National / London average benchmarks** | Raw percentages are meaningless without context — show whether a school is above or below average |
| **Saved shortlist / favourites** | Parents research over days and weeks — they need to bookmark schools without rebuilding every session |

### Medium priority

| Feature | Why a parent needs it |
|---|---|
| **Full Ofsted sub-judgements** | Quality of Education is the most important sub-judgement for most parents |
| **Link to Ofsted report PDF** | The authoritative source — parents will want to read the full narrative |
| **Historical performance trend charts** | Is a school improving, declining, or stable? A line chart answers this instantly |
| **Religious character** | Faith schools matter greatly to many families — it should be front and centre |
| **SEND / SEN provision details** | Parents of children with additional needs need to know what support is available |
| **Shareable comparison link** | A "Copy link" button on the compare page |
| **Sort results on search page** | Let parents sort by Ofsted rating, performance, or school size directly from the list |

### Lower priority (but high delight)

| Feature | Why a parent needs it |
|---|---|
| **Open evenings / events calendar** | School open evenings are the primary discovery event for secondary choices |
| **Sibling & feeder school info** | Which primaries feed into a particular secondary? |
| **Transport / travel time** | How long does it take to get there from a given postcode? |
| **Parent reviews / community tone** | Controversial but parents look for this — Ofsted Parentview scores would be a start |
| **"Schools like this"** | Recommendation engine: if you're looking at Acland Burghley, here are 3 similar schools |

---

## 6. Language & Accessibility

The app uses DfE/Ofsted jargon throughout. A glossary page would help, but in-context tooltips are more effective. Every metric that appears on screen should have a one-line plain-English description available on hover or tap.

Terms that need plain-English equivalents on first use:
- **RWM** → Reading, Writing and Maths (the core Key Stage 2 measure)
- **Attainment 8** → Average GCSE score across 8 subjects (max ~90, national avg ~47)
- **Progress 8** → Whether pupils did better or worse than similar pupils nationally (0 = average)
- **Grade 5+ E&M** → % of pupils getting a strong pass in English and Maths GCSE
- **FSM** → Free School Meals eligible (a proxy for economic disadvantage)
- **EAL** → English as an Additional Language
- **SEN / EHCP** → Special Educational Needs / Education, Health and Care Plan
- **PRU** → Pupil Referral Unit (school for excluded pupils — probably not relevant for most parents)
- **KS2 / KS4** → Key Stage 2 (Year 6, age 11) / Key Stage 4 (Year 11, age 16)

---

## 7. Summary of Issues Found During Walkthrough

| Severity | Issue |
|---|---|
| Critical | No postcode/distance search |
| Critical | Ofsted Attainment 8 etc. shown without any plain-English explanation |
| High | Compare tray and compare page are disconnected — inconsistent state |
| High | School cards: "+" button unlabelled — the compare feature is hidden |
| High | Only one year of academic data shown — no trend, no national average |
| High | Destinations tab empty for primaries with no explanation |
| High | No admissions or application information anywhere |
| Medium | School names truncated in compare column headers |
| Medium | History tab dates show "31 August" for all entries — looks like a data artefact |
| Medium | Ofsted row in compare shows inspection status, not the actual overall grade |
| Medium | "Not available" rows in compare still trigger green/red highlighting |
| Medium | Rankings mix grammar/independent schools with state schools in the same list |
| Medium | Compare tray fixed bar covers page content on small screens |
| Medium | Tab bar overflows on mobile — "History" tab cut off |
| Low | No data freshness / "last updated" indicator |
| Low | No "share this comparison" button (URL approach works but is undiscovered) |
| Low | No loading skeleton states — fast API masks the need now, but worth adding |

---

## 8. What to Build First

If the goal of v2 is to serve real London parents, the recommended build order is:

1. **Postcode search + map view** — the defining feature gap; nothing else matters if you can't find schools near your home.
2. **Metric tooltips / glossary** — pure content work, high impact, low effort.
3. **National/London benchmark overlays** — context that makes every existing number useful.
4. **Saved shortlist** — requires auth or local storage; enables return visits.
5. **Full Ofsted judgements** — data already in the system, surface all four sub-judgements.
6. **Admissions links** — even a link to the LA admissions portal per borough would be a start.
7. **Historical trend charts** — replace the single-row table with a sparkline or multi-year chart.
