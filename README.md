# ResumeFit – Resume to Job Matcher (v2)

Score a resume against a job description, check how ATS-friendly it is, and rank many jobs or many resumes from a CSV. Everything runs in your browser, so your data is never uploaded.

**Live demo:** https://najeeb-08.github.io/Resumefit/

<!-- Add a screenshot after your site is live: upload screenshot.png to this repo, then delete this line and the arrows around the next one.
![ResumeFit screenshot](screenshot.png)
-->

## What's new in v2
- **ATS score**: a 0-100 estimate that combines a 14-point resume checklist (contact details, sections, length, bullets, numbers, action verbs, dates, plain characters) with keyword match to the job.
- **Rank jobs (CSV)**: upload a CSV of job listings and see which ones fit your resume best, with a verdict (Apply now, Apply after edits, Stretch).
- **Rank resumes (CSV)**: upload a CSV of resumes and rank candidates against one job description.
- **Suggestions written for each upload**: tips, a suggested summary and a cover note opener per job, and a suggested reply per candidate. They change with each job's required skills and what your resume already covers.
- **Export**: download or copy the ranked results as CSV.
- **New interface**: three tabs, sortable tables, expandable details, dark mode.

## How it works
The **job match score** (0-100) combines three signals:

| Signal | Weight | What it measures |
|---|---|---|
| Skill coverage | 55% | Known tech and design skills in the job description that also appear in your resume |
| Keyword coverage | 30% | The job description's most frequent meaningful terms that appear in your resume |
| Text similarity | 15% | Cosine similarity of sublinear term-frequency vectors of both documents |

The **ATS score** is 60% resume format checks (14 rules, 100 points) and 40% keyword match. It is an estimate. Real ATS systems differ.

## CSV formats
**Jobs CSV** (first row must be a header):

```csv
title,company,description,url
Junior ML Engineer,Northwind Analytics,"Build models in Python and ship REST APIs...",https://example.com/job/1
```

Only `description` is required. If no column has that name, the column with the longest text is used.

**Resumes CSV**:

```csv
name,email,resume
Aisha Khan,aisha@example.com,"Skills: Python, scikit-learn ... (full resume text, quotes allowed across lines)"
```

Only `resume` is required. Commas, semicolons and tabs are detected automatically, and up to 200 rows are ranked. The app has sample CSVs you can load or download.

Ranking is a tool to decide what to read first. Keep a person in any hiring decision.

## Tech stack
- Vanilla JavaScript (no frameworks, no build step)
- NLP techniques: tokenization, stop-word removal, TF-style vectors, cosine similarity
- Rule-based ATS checks, a dependency-free CSV parser
- HTML5 and CSS3, responsive layout with dark and light mode
- Hosted on GitHub Pages

## Run locally
```bash
git clone https://github.com/najeeb-08/Resumefit.git
cd Resumefit
# open index.html in your browser, or:
npx serve .
```

## Roadmap
- [ ] FastAPI backend with sentence-transformers embeddings
- [ ] LLM-written tailored bullets and cover letters (server-side)
- [ ] PDF and DOCX resume upload
- [ ] Save and compare scores over time

## Limitations
Skill detection uses a built-in dictionary of about 65 skills, so niche skills may be missed. Scores are guides, not guarantees.

## Author
Built by **Najeebullah N** · [GitHub](https://github.com/najeeb-08) · [LinkedIn]([https://linkedin.com/in/your-profile](https://www.linkedin.com/in/najeebullah-n-331487278/))
