# Demo scenario: AcmeCloud — Big Tech earnings one‑pager in 2 minutes

## Company (fictional)
- Name: AcmeCloud, Inc.
- Size: ~$300M ARR B2B SaaS; enterprise GTM; quarterly board meetings
- Team: Finance org with FP&A, Strategic Finance, and IR

## Customer persona
- Role: Director of FP&A (primary). Secondary: CFO, Head of Strategy/Chief of Staff
- Goals:
  - Produce board‑ready one‑pager summarizing peers’ earnings each quarter
  - Benchmark growth engines (Cloud/Ads/Services) and callouts from transcripts
  - Deliver consistent, high‑quality visuals exportable to PPTX on tight deadlines
- Pain points:
  - Manual PDF wrangling; inconsistent formatting; last‑minute edits
  - Disconnected inputs (press releases, transcripts, internal KPI CSV)
  - Recreating the same templates every quarter
- Success metrics:
  - < 2 minutes to first draft; < 10 minutes to final
  - Fewer manual edits; consistent theme and layout
  - Reusable flow across quarters/peer sets

## Scenario
- Trigger: Earnings season; CFO requests a “Big Tech Qx Highlights” one‑pager before a strategy meeting.
- Objective: Upload 5 public press‑release PDFs + 1 short earnings call transcript + a tiny internal KPI CSV; generate a single executive slide with bullets + 3 stats, export PPTX.

## Inputs (for the demo)
- Public PDFs (any recent quarter):
  - Microsoft (MSFT) press release
  - Apple (AAPL) press release
  - Alphabet (GOOGL) press release
  - Amazon (AMZN) press release
  - Meta (META) press release
  - Optional: one transcript (e.g., MSFT) for qualitative context
- Internal (demo) files:
  - `public/demo/kpi/bigtech_kpi.csv`
  - `public/demo/kpi/initiatives.md`

## Desired output (single slide)
- Theme: Professional (gradient)
- Title: “Big Tech Qx Earnings Highlights”
- Subtitle: “Revenue/EPS and growth engines”
- Bullets: one concise line per company (Rev/EPS/growth engine)
- Stats: three standout metrics (e.g., +8% Revenue YoY, +14% Cloud, $0.06 EPS beat)
- Export: PPTX via “Download PPTX”

## Customer journey (happy path)
1) Upload
   - Drag & drop 5 press releases (PDF) + one transcript (PDF) + `bigtech_kpi.csv`
   - Description: “Compare this quarter’s Big Tech earnings with headline KPIs and growth engines.”
2) Theme
   - Select “Professional”
3) Research (optional)
   - Toggle on; query adds brief benchmark context
4) Plan
   - Auto plan generates slide content structure; accept
5) Preview
   - Generate slide HTML; optionally tweak one bullet and regenerate
6) Download
   - Export PPTX; share in CFO deck

## Acceptance criteria
- End‑to‑end flow completes in under 2 minutes for first draft
- Slide is visually consistent and board‑ready (title, 3–5 bullets, 2–3 stats)
- PPTX export opens cleanly in PowerPoint/Google Slides

## Demo script (60–90 seconds)
- “We’re prepping the CFO for a strategy meeting in 30 minutes.”
- Upload PDFs + CSV → choose Professional theme → enable research → auto‑plan → preview slide → quick edit/regenerate → export PPTX.
- Close with: “Quarterly one‑pager in minutes, not hours—repeatable every earnings season.”
