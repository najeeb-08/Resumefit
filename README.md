# ResumeFit – Resume to Job Matcher

Paste your resume and a job description and get an instant **match score**, the **skills you're missing**, the **keywords to add**, and **tips to improve** your resume.

**Live demo:** https://najeeb-08.github.io/resumefit/

![screenshot](screenshot.png)

## Why I built it
Applying to jobs, I wanted to know how well my resume matched each role before hitting "Apply". ResumeFit gives that answer in seconds, and because it runs entirely in the browser, your resume never leaves your device.

## How it works
The score (0-100) combines three signals:

| Signal | Weight | What it measures |
|---|---|---|
| Skill coverage | 55% | Known tech and design skills in the job description that also appear in your resume |
| Keyword coverage | 30% | The job description's most frequent meaningful terms that appear in your resume |
| Text similarity | 15% | Cosine similarity of sublinear term-frequency vectors of both documents |

It also runs simple resume-quality checks (measurable results, section headings, links to GitHub/LinkedIn, length).

## Tech stack
- Vanilla JavaScript (no frameworks, no build step)
- NLP techniques: tokenization, stop-word removal, TF-style vectors, cosine similarity
- Responsive UI with dark and light mode

## Run locally
```bash
git clone https://github.com/najeeb-08/resumefit.git
cd resumefit
# just open index.html in your browser, or:
npx serve .
```

## Deploy free (GitHub Pages)
1. Push these files to a GitHub repo.
2. Repo → **Settings → Pages** → Source: `main` branch, `/ (root)` → Save.
3. Your site goes live at `https://najeeb-08.github.io/resumefit/`.

## Roadmap
- [ ] Upgrade matching with sentence embeddings (sentence-transformers) behind a FastAPI backend
- [ ] PDF resume upload
- [ ] Save and compare scores across multiple job descriptions
- [ ] ATS-style formatting checks

## Limitations
Skill detection uses a built-in dictionary of ~60 skills, so niche skills may be missed. The score is a guide, not a guarantee.

## Author
Built by **Najeebullah N** · [GitHub](https://github.com/najeeb-08) · [LinkedIn](https://linkedin.com/in/your-profile)
