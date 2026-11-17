# ResumeFit – Resume to Job Matcher

![tests](https://github.com/najeeb-08/Resumefit/actions/workflows/test.yml/badge.svg)

Match a resume to a job, check how ATS-friendly it is, find out which skills to learn first, and rank many jobs or many resumes at once. Upload PDF, DOCX or TXT files. Everything runs in your browser, so your data is never uploaded.

**Live demo:** https://najeeb-08.github.io/Resumefit/

<!-- Add a screenshot after your site is live: upload screenshot.png to this repo, then delete this line and the arrows around the next one.
![ResumeFit screenshot](screenshot.png)
-->

## What makes it different
- **Skill gap planner.** Rank your resume against a CSV of jobs, then tick a skill (for example Docker) and watch every score change. It shows which jobs move up a band, so you know what to learn first instead of guessing.
- **Explainable scores.** The job description and your resume are highlighted: green skills you have, red skills you lack, amber skills that are only a "plus". You can see why a score is what it is.
- **Must-have vs nice-to-have.** Skills listed as "a plus" count for less than requirements, and skills repeated in the posting count for more.
- **Drop a pile of resumes.** Drag many PDF, DOCX or TXT resumes onto the Rank resumes tab. Candidates are named from the file, ranked, and each gets a suggested reply.
- **Suggestions written for each upload.** Tips, a summary and a cover note opener per job, built from that job's skills and what your resume already covers.
- **Live scoring.** Edit the resume or job text and the scores update as you type.
- **Private by design.** No server, no accounts, no uploads. Files are read on your device.
- **Tested.** Unit tests run on every push with GitHub Actions.

## Features
| Tab | What it does |
|---|---|
| Match one job | Job match score, ATS score, highlighted skills, tailored suggestions, 14-point ATS checklist |
| Rank jobs (CSV) | Rank up to 200 job listings against your resume, plus the skill gap planner and what-if view |
| Rank resumes | Rank up to 200 resumes (files and/or CSV) against one job description |

Every resume and job description box accepts an upload or a drag and drop of a PDF, DOCX or TXT file. Results can be copied or downloaded as CSV.

## How it works
The **job match score** (0-100) combines three signals:

| Signal | Weight | What it measures |
|---|---|---|
| Skill coverage | 55% | Known tech and design skills in the job that also appear in the resume, weighted by how the posting words them |
| Keyword coverage | 30% | The job's most frequent meaningful terms that appear in the resume |
| Text similarity | 15% | Cosine similarity of sublinear term-frequency vectors of both documents |

The **ATS score** is 60% resume format checks (14 rules, 100 points) and 40% keyword match. It is an estimate. Real ATS systems differ.

The **skill gap planner** re-scores every job with one extra skill added to the resume and reports the average gain and how many jobs move up a band.

## File reading
- **PDF:** read with [pdf.js](https://mozilla.github.io/pdf.js/), loaded from cdnjs the first time you open a PDF. Scanned (image-only) PDFs have no text and are reported as such.
- **DOCX:** unzipped in the browser with the built-in `DecompressionStream`, then paragraphs, bullets and header text are extracted.
- **TXT / MD:** read as text. Old `.doc` files are not supported.

## CSV formats
**Jobs CSV** (first row must be a header):

```csv
title,company,description,url
Junior ML Engineer,Northwind Analytics,"Build models in Python and ship REST APIs...",https://example.com/job/1
```

Only `description` is required. **Resumes CSV:**

```csv
name,email,resume
Aisha Khan,aisha@example.com,"Skills: Python, scikit-learn ... (full resume text, quotes allowed across lines)"
```

Only `resume` is required. If the expected column is missing, the column with the longest text is used. Commas, semicolons and tabs are detected automatically. The app has sample CSVs you can load or download.

Ranking is a tool to decide what to read first. Keep a person in any hiring decision.

## Tech stack
- Vanilla JavaScript (no frameworks, no build step)
- NLP techniques: tokenization, stop-word removal, TF-style vectors, cosine similarity
- Rule-based ATS checks and a dependency-free CSV parser
- pdf.js for PDFs, a small zip and XML reader for DOCX
- HTML5 and CSS3, responsive layout with dark and light mode
- Node's built-in test runner, GitHub Actions for CI, GitHub Pages for hosting

## Project structure
```
index.html      interface (tabs, tables, upload and drag and drop)
matcher.js      scoring engine, ATS checks, CSV parsing, ranking, skill gap planner
reader.js       PDF, DOCX and TXT file reader
tests/          unit tests (npm test)
.github/        CI workflow
```

## Run locally
```bash
git clone https://github.com/najeeb-08/Resumefit.git
cd Resumefit
npx serve .     # or just open index.html in your browser
npm test        # runs the unit tests (Node 18 or newer)
```

## Roadmap
- [ ] FastAPI backend with sentence-transformers embeddings
- [ ] LLM-written tailored bullets and cover letters (server-side)
- [ ] OCR for scanned PDFs
- [ ] Save and compare scores over time

## Limitations
Skill detection uses a built-in dictionary of about 65 skills, so niche skills may be missed. Two-column PDF layouts can come out in a mixed order, so check the extracted text. Scores are guides, not guarantees.

## Author
Built by **Najeebullah N** · [GitHub](https://github.com/najeeb-08) · [LinkedIn](https://linkedin.com/in/your-profile)
