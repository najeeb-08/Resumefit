/*
 * ResumeFit matching engine (v2)
 *  - analyze():      job-match score (skills + keywords + cosine similarity) and ATS score
 *  - atsCheck():     rule-based ATS readiness checklist for a resume
 *  - parseCSV():     small, dependency-free CSV parser (quotes, multi-line cells, , ; tab)
 *  - rankJobs():     one resume vs many job listings (CSV)
 *  - rankResumes():  many resumes (CSV) vs one job description
 * Runs fully client-side. Works in the browser (window.ResumeFit) and in Node (module.exports).
 */
(function (root) {
  "use strict";

  const MAX_ROWS = 200;

  // canonical name -> aliases (all lowercase)
  const SKILLS = {
    Python: ["python"],
    "Machine Learning": ["machine learning", "ml"],
    "Deep Learning": ["deep learning"],
    NLP: ["nlp", "natural language processing"],
    "Computer Vision": ["computer vision", "opencv"],
    TensorFlow: ["tensorflow"],
    PyTorch: ["pytorch"],
    "Scikit-learn": ["scikit-learn", "sklearn", "scikit learn"],
    Pandas: ["pandas"],
    NumPy: ["numpy"],
    Statistics: ["statistics", "statistical"],
    SQL: ["sql", "mysql", "postgresql", "postgres", "sqlite"],
    MongoDB: ["mongodb"],
    Redis: ["redis"],
    Firebase: ["firebase"],
    JavaScript: ["javascript", "js", "es6"],
    TypeScript: ["typescript"],
    React: ["react", "reactjs", "react.js"],
    "Next.js": ["next.js", "nextjs"],
    "Node.js": ["node.js", "nodejs", "node"],
    Express: ["express", "express.js"],
    HTML: ["html", "html5"],
    CSS: ["css", "css3"],
    "Tailwind CSS": ["tailwind", "tailwind css"],
    WordPress: ["wordpress"],
    Java: ["java"],
    "Spring Boot": ["spring boot", "spring"],
    "C++": ["c++"],
    C: ["c programming"],
    "C#": ["c#"],
    Go: ["golang"],
    FastAPI: ["fastapi"],
    Flask: ["flask"],
    Django: ["django"],
    "REST APIs": ["rest", "restful", "rest api", "rest apis", "api", "apis"],
    GraphQL: ["graphql"],
    Git: ["git"],
    GitHub: ["github"],
    Docker: ["docker"],
    Kubernetes: ["kubernetes", "k8s"],
    AWS: ["aws", "amazon web services"],
    Azure: ["azure"],
    GCP: ["gcp", "google cloud"],
    "CI/CD": ["ci/cd", "cicd", "github actions", "jenkins"],
    Linux: ["linux"],
    "Data Structures & Algorithms": ["data structures", "algorithms", "dsa"],
    OOP: ["oop", "object oriented", "object-oriented"],
    Agile: ["agile", "scrum"],
    Excel: ["excel", "microsoft excel"],
    "Data Analysis": ["data analysis", "data analytics"],
    "Data Visualization": ["data visualization", "tableau", "power bi", "matplotlib"],
    LLMs: ["llm", "llms", "large language model", "large language models", "openai", "langchain"],
    "Generative AI": ["generative ai", "genai", "gen ai", "prompt engineering"],
    Figma: ["figma"],
    Canva: ["canva"],
    "UI/UX": ["ui/ux", "ui ux", "user interface", "user experience", "ux", "ui design"],
    "Graphic Design": ["graphic design", "photoshop", "illustrator", "branding"],
    "Responsive Design": ["responsive", "responsive design", "mobile-first"],
    Testing: ["unit testing", "pytest", "jest", "testing"],
    Communication: ["communication", "collaboration", "teamwork"],
  };

  const STOP = new Set(
    ("a an the and or but if then else of to in on at by for with from as is are was were be been being it its this that " +
      "these those we you your our their they he she i me my us will would can could should may might must do does did " +
      "have has had not no yes so such than too very just also into about over under up down out off more most other some " +
      "any all each every both few many much own same only own per via etc eg ie job role position candidate candidates " +
      "company team work working works experience years year plus strong good great excellent ability able looking join " +
      "responsibilities requirements qualifications preferred required including include using use used well new " +
      "build builds building engineer engineers junior senior expose help helps need needs make makes knowledge " +
      "hiring hire skills skill develop developer developers developing ship work").split(" ")
  );

  const ACTION_VERBS = new Set(
    ("built developed designed created led improved analyzed analysed implemented deployed delivered managed reduced increased " +
      "launched optimized optimised automated trained collaborated engineered researched presented organized organised mentored " +
      "migrated integrated tested wrote produced streamlined achieved established coordinated resolved shipped maintained " +
      "architected evaluated applied compared planned owned drove").split(" ")
  );

  // What a missing skill can be bridged from, and a concrete project idea.
  const BRIDGES = {
    FastAPI: { from: ["Flask", "Django", "Python", "REST APIs"], idea: "build a small FastAPI service that serves one of your models" },
    React: { from: ["JavaScript", "Next.js", "HTML", "CSS"], idea: "rebuild one of your websites as a React app" },
    Docker: { from: ["Linux", "Git", "CI/CD"], idea: "containerize one project with a Dockerfile" },
    SQL: { from: ["Pandas", "Data Analysis", "MongoDB"], idea: "move a project's data into SQLite or PostgreSQL and query it" },
    Agile: { from: ["Communication", "GitHub", "Git"], idea: "mention sprints, stand-ups or Kanban if you used them in a team" },
    TensorFlow: { from: ["Deep Learning", "Machine Learning", "Python"], idea: "train a small neural network and publish the notebook" },
    PyTorch: { from: ["Deep Learning", "Machine Learning", "Python"], idea: "train a small neural network and publish the notebook" },
    NLP: { from: ["Machine Learning", "Scikit-learn", "Python"], idea: "add a text-classification project, such as spam or sentiment" },
    "Machine Learning": { from: ["Scikit-learn", "Pandas", "Python"], idea: "describe your ML coursework or add one end-to-end model project" },
    AWS: { from: ["Docker", "Linux", "Azure", "GCP"], idea: "deploy one project on a free cloud tier" },
    Azure: { from: ["AWS", "GCP", "Docker"], idea: "deploy one project on a free cloud tier" },
    GCP: { from: ["AWS", "Azure", "Docker"], idea: "deploy one project on a free cloud tier" },
    Kubernetes: { from: ["Docker", "Linux"], idea: "run a containerized app on a local cluster such as minikube" },
    TypeScript: { from: ["JavaScript", "React", "Node.js"], idea: "convert one JavaScript project to TypeScript" },
    "Node.js": { from: ["JavaScript", "Express"], idea: "build a small REST API with Node and Express" },
    Figma: { from: ["Canva", "UI/UX", "Graphic Design"], idea: "recreate one of your Canva designs as a Figma prototype" },
    "UI/UX": { from: ["Figma", "Canva", "Graphic Design", "Responsive Design"], idea: "write a short case study for one design, with the problem and your choices" },
    "Data Visualization": { from: ["Pandas", "Excel", "Data Analysis"], idea: "build one dashboard in Power BI, Tableau or matplotlib" },
    Excel: { from: ["Pandas", "SQL", "Data Analysis"], idea: "mention spreadsheets you built, with formulas and pivot tables" },
    "CI/CD": { from: ["GitHub", "Git", "Docker"], idea: "add a GitHub Actions workflow to one repo" },
    Testing: { from: ["Python", "JavaScript"], idea: "add unit tests to one project and mention coverage" },
  };

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const SKILL_RES = Object.entries(SKILLS).map(([name, aliases]) => [
    name,
    aliases.map((a) => new RegExp("(^|[^a-z0-9+#])" + esc(a) + "($|[^a-z0-9+#])", "i")),
  ]);

  const list = (a) => (a.length <= 1 ? a[0] || "" : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);

  function extractSkills(text) {
    const t = String(text || "").toLowerCase();
    const found = new Set();
    for (const [name, res] of SKILL_RES) if (res.some((r) => r.test(t))) found.add(name);
    return found;
  }

  function firstIndex(text, name) {
    const t = String(text || "").toLowerCase();
    const entry = SKILL_RES.find((e) => e[0] === name);
    let best = Infinity;
    if (entry) for (const r of entry[1]) { const m = t.search(r); if (m >= 0 && m < best) best = m; }
    return best;
  }

  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s/-]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^[.\-/]+|[.\-/]+$/g, ""))
      .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));
  }

  function counts(tokens) {
    const m = new Map();
    for (const t of tokens) m.set(t, (m.get(t) || 0) + 1);
    return m;
  }

  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (const [k, v] of a) {
      const x = 1 + Math.log(v);
      na += x * x;
      if (b.has(k)) dot += x * (1 + Math.log(b.get(k)));
    }
    for (const v of b.values()) { const y = 1 + Math.log(v); nb += y * y; }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  function topKeywords(jdCounts, n) {
    return [...jdCounts.entries()]
      .filter(([w, c]) => c >= 2 || w.length > 5)
      .sort((x, y) => y[1] - x[1] || y[0].length - x[0].length)
      .slice(0, n)
      .map(([w]) => w);
  }

  const label = (s) => (s >= 80 ? "Excellent match" : s >= 65 ? "Strong match" : s >= 45 ? "Decent match" : s >= 25 ? "Weak match" : "Low match");
  const bandOf = (s) => (s >= 65 ? "strong" : s >= 45 ? "possible" : "weak");

  /* ---------------- ATS checklist ---------------- */
  function atsCheck(text) {
    const t = String(text || "");
    const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const words = (t.trim().match(/\S+/g) || []).length;
    const checks = [];
    const add = (id, name, points, max, pass, warn, fail) => {
      const status = points >= max ? "pass" : points > 0 ? "warn" : "fail";
      checks.push({ id, label: name, points, max, status, detail: status === "pass" ? pass : status === "warn" ? warn : fail });
    };
    const has = (re) => lines.some((l) => re.test(l));
    const phoneRe = /(\+?\d[\d\s().-]{7,}\d)/;
    const noYearRanges = t.replace(/\b(19|20)\d\d\s*[-–]\s*(19|20)\d\d\b/g, " ");

    const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(t);
    add("email", "Email address", hasEmail ? 8 : 0, 8, "Found.", "", "Add a professional email address near the top.");
    const hasPhone = phoneRe.test(noYearRanges);
    add("phone", "Phone number", hasPhone ? 7 : 0, 7, "Found.", "", "Add a phone number so recruiters can call you.");
    const hasLinks = /(linkedin\.com|github\.com|portfolio|behance\.net|https?:\/\/)/i.test(t);
    add("links", "Profile links", hasLinks ? 5 : 0, 5, "LinkedIn, GitHub or portfolio link found.", "", "Add your LinkedIn, GitHub or portfolio link.");
    const head = (lines[0] || "").split(/[|·•,]/)[0].trim();
    const nameOk = !!head && head.split(/\s+/).length <= 6 && !/[@\d]/.test(head);
    add("name", "Name at the top", nameOk ? 5 : 0, 5, "Found.", "", "Start with your full name alone on the first line.");

    add("skills", "Skills section", has(/^(technical |key |core )?skills\b/i) ? 5 : 0, 5, "Found.", "", "Add a clearly labeled Skills section.");
    add("education", "Education section", has(/^(education|academics?|qualifications?)\b/i) ? 5 : 0, 5, "Found.", "", "Add a clearly labeled Education section.");
    add("experience", "Experience section", has(/^(work |professional |industry )?(experience|employment|internships?)\b/i) ? 5 : 0, 5, "Found.", "", "Add an Experience or Internships section. Freelance work counts.");
    add("projects", "Projects section", has(/^(academic |personal |key )?projects?\b/i) ? 5 : 0, 5, "Found.", "", "Add a Projects section with links and results.");

    const lenPts = words >= 200 && words <= 900 ? 10 : words >= 120 && words <= 1200 ? 5 : 0;
    add("length", "Length", lenPts, 10, `${words} words, a good range.`, `${words} words. Aim for 300 to 700 words, about one page.`, `${words} words. ${words < 120 ? "Add project details, tools and outcomes." : "Cut to the most relevant points."}`);

    const bullets = lines.filter((l) => /^[-•*–▪●◦·]\s*\S/.test(l)).length;
    add("bullets", "Bullet points", bullets >= 3 ? 10 : bullets >= 1 ? 5 : 0, 10, `${bullets} bullet points.`, "Use at least 3 bullet points so ATS and recruiters can scan it.", "Describe projects and jobs with short bullet points.");

    const stripped = t
      .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, " ")
      .replace(/(\+?\d[\d\s().-]{7,}\d)/g, " ")
      .replace(/\b(19|20)\d\d\b/g, " ");
    const nums = (stripped.match(/\b\d[\d,]*(\.\d+)?(\s?(%|\+|x\b|k\b))?/g) || []).length;
    add("numbers", "Measurable results", nums >= 4 ? 15 : nums >= 2 ? 9 : nums >= 1 ? 4 : 0, 15, `${nums} numbers found.`, "Add more numbers (accuracy, users, time saved, files, graphics made).", "Add numbers to your bullets, for example \"improved accuracy by 12%\".");

    const verbs = lines.filter((l) => {
      const w = l.replace(/^[-•*–▪●◦·]\s*/, "").split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
      return ACTION_VERBS.has(w);
    }).length;
    add("verbs", "Action verbs", verbs >= 3 ? 10 : verbs >= 1 ? 5 : 0, 10, `${verbs} bullets start with an action verb.`, "Start more bullets with verbs such as Built, Designed or Deployed.", "Start bullets with action verbs such as Built, Designed or Deployed.");

    add("dates", "Dates", /\b(19|20)\d\d\b/.test(t) ? 5 : 0, 5, "Found.", "", "Add years for your education, jobs and projects.");
    add("chars", "Plain characters", /[\u{1F300}-\u{1FAFF}☀-➿─-▟]/u.test(t) ? 0 : 5, 5, "No emoji or box-drawing characters.", "", "Remove emoji and box-drawing characters. ATS parsers often break on them.");

    const score = checks.reduce((s, c) => s + c.points, 0);
    return { score, checks, words };
  }

  /* ---------------- suggestions ---------------- */
  function bridgeTip(skill, owned) {
    const b = BRIDGES[skill];
    if (!b) return `${skill}: if you have used it, add it to Skills and a project bullet. If not, add one small project that uses it.`;
    const own = b.from.find((s) => owned.has(s));
    const suffix = /^(mention|describe|write)/.test(b.idea) ? "" : ", then list it under Projects";
    return own
      ? `${skill}: you already list ${own}, so ${b.idea}${suffix}.`
      : `${skill}: not on your resume. If you have used it, add it. If not, ${b.idea}${suffix}.`;
  }

  function guessTitle(jd) {
    const lines = String(jd || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const first = lines[0] || "";
    if (first && first.split(/\s+/).length <= 9 && first.length <= 70 && !/[.!?]$/.test(first)) return first;
    const m = String(jd || "").match(/(?:hiring|seeking|looking for)\s+(?:an?\s+)?([A-Za-z/ +.#-]{3,60}?)(?:[.,:;\n]|$)/i);
    return m ? m[1].trim() : "";
  }

  function candidateReply(name, band, a, title) {
    const first = String(name || "").trim().split(/\s+/)[0] || "there";
    const role = title || "this role";
    const strong = list(a.matchedSkills.slice(0, 3));
    const gaps = list(a.missingSkills.slice(0, 2));
    if (band === "strong")
      return `Hi ${first}, thank you for applying for ${role}. Your experience with ${strong || "your background"} matches what we are looking for. We would like to set up a short call. Which days this week suit you?`;
    if (band === "possible")
      return `Hi ${first}, thank you for applying for ${role}. ${strong ? `Your experience with ${strong} is relevant. ` : ""}${gaps ? `Could you tell us more about your experience with ${gaps}? ` : ""}We will decide on next steps once we hear back from you.`;
    return `Hi ${first}, thank you for applying for ${role}. We are moving forward with candidates whose experience is closer to ${list(a.missingSkills.slice(0, 3)) || "the role requirements"}. We encourage you to apply again as you build that experience.`;
  }

  /* ---------------- analysis ---------------- */
  // A skill on the resume that clearly implies another one (so the resume is not penalised for wording).
  const IMPLIES = {
    "Machine Learning": ["Scikit-learn", "TensorFlow", "PyTorch", "Deep Learning", "NLP", "Computer Vision"],
    "REST APIs": ["FastAPI", "Flask", "Django", "Express"],
    JavaScript: ["React", "Next.js", "Node.js", "TypeScript"],
    React: ["Next.js"],
  };

  function prepareResume(resume) {
    const text = String(resume || "").trim();
    const skills = extractSkills(text);
    for (const [skill, from] of Object.entries(IMPLIES)) if (from.some((s) => skills.has(s))) skills.add(skill);
    return { text, skills, counts: counts(tokenize(text)), format: atsCheck(text) };
  }

  function analyze(resumeIn, jdIn, meta) {
    meta = meta || {};
    const R = resumeIn && typeof resumeIn === "object" ? resumeIn : prepareResume(resumeIn);
    const jd = String(jdIn || "").trim();
    if (!R.text || !jd) throw new Error("Both resume and job description are required.");

    const jSkills = extractSkills(jd);
    const byJd = (a, b) => firstIndex(jd, a) - firstIndex(jd, b);
    const matched = [...jSkills].filter((s) => R.skills.has(s)).sort(byJd);
    const missing = [...jSkills].filter((s) => !R.skills.has(s)).sort(byJd);
    const extra = [...R.skills].filter((s) => !jSkills.has(s));

    const jCounts = counts(tokenize(jd));
    const kws = topKeywords(jCounts, 25);
    const kwHit = kws.filter((k) => R.counts.has(k));
    const kwMiss = kws.filter((k) => !R.counts.has(k));

    const skillCov = jSkills.size ? matched.length / jSkills.size : null;
    const kwCov = kws.length ? kwHit.length / kws.length : 0;
    const cos = cosine(jCounts, R.counts);
    const raw = skillCov === null ? 0.7 * kwCov + 0.3 * Math.min(1, cos * 2) : 0.55 * skillCov + 0.3 * kwCov + 0.15 * Math.min(1, cos * 2);
    const score = Math.max(0, Math.min(100, Math.round(raw * 100)));
    const band = bandOf(score);

    const keywordMatch = Math.round(100 * (skillCov === null ? kwCov : 0.6 * skillCov + 0.4 * kwCov));
    const atsScore = Math.round(0.6 * R.format.score + 0.4 * keywordMatch);

    const title = String(meta.title || "").trim() || guessTitle(jd);
    const company = String(meta.company || "").trim();
    const at = company ? ` at ${company}` : "";

    const tips = [];
    if (matched.length) tips.push(`Lead with ${list(matched.slice(0, 3))} in your first bullets. This posting asks for ${matched.length > 1 ? "them" : "it"} first.`);
    missing.slice(0, 4).forEach((s) => tips.push(bridgeTip(s, R.skills)));
    if (!jSkills.size) tips.push("This posting names no skills from the built-in list. Compare the keywords below by hand.");
    if (title) tips.push(`Use "${title}" or a close variant in your headline or summary so keyword filters pick it up.`);
    const kwShow = kwMiss.filter((k) => k.length > 3).slice(0, 6);
    if (kwShow.length) tips.push(`Mirror the posting's wording where it is true for you: ${kwShow.join(", ")}.`);

    const profile = /computer science|b\.?\s?e\.?\b|b\.?\s?tech/i.test(R.text) ? "Computer Science graduate" : "Candidate";
    const top = matched.filter((s) => !["Communication", "Agile", "GitHub"].includes(s)).slice(0, 3);
    const summary = `${profile} with hands-on experience in ${list(top.length ? top : [...R.skills].slice(0, 3)) || "software and design"}, applying for the ${title || "advertised"} role${at}.`;
    const coverNote = `Hi${company ? ` ${company} hiring team` : ""}, I'm applying for the ${title || "advertised"} role. My work with ${list(matched.slice(0, 2)) || "the skills you list"} lines up with what you are asking for${extra.length ? `, and my ${extra[0]} experience adds a different angle` : ""}. I'd welcome a chance to talk about how I can contribute.`;

    return {
      score, label: label(score), band,
      breakdown: {
        skillCoverage: skillCov === null ? null : Math.round(skillCov * 100),
        keywordCoverage: Math.round(kwCov * 100),
        textSimilarity: Math.round(Math.min(1, cos * 2) * 100),
      },
      ats: { score: atsScore, format: R.format.score, keywordMatch, checks: R.format.checks },
      matchedSkills: matched, missingSkills: missing, extraSkills: extra,
      matchedKeywords: kwHit, missingKeywords: kwMiss,
      tips, summary, coverNote, title, company,
      reply: candidateReply(meta.name, band, { matchedSkills: matched, missingSkills: missing }, title),
      wordCount: R.format.words,
    };
  }

  /* ---------------- CSV ---------------- */
  function parseCSV(text) {
    text = String(text || "").replace(/^﻿/, "");
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const n = (c) => firstLine.split(c).length - 1;
    const cands = [[",", n(",")], [";", n(";")], ["\t", n("\t")]].sort((a, b) => b[1] - a[1]);
    const delim = cands[0][1] > 0 ? cands[0][0] : ",";
    const rows = [];
    let row = [], cell = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += ch;
      } else if (ch === '"' && cell === "") inQ = true;
      else if (ch === delim) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = ""; rows.push(row); row = [];
      } else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    const clean = rows.filter((r) => r.some((c) => c.trim() !== ""));
    const headers = (clean.shift() || []).map((h) => h.trim());
    return { headers, rows: clean, delimiter: delim, unterminatedQuote: inQ };
  }

  const COLS = {
    jobs: {
      title: ["title", "jobtitle", "role", "position", "jobrole"],
      company: ["company", "employer", "organization", "organisation", "companyname"],
      description: ["description", "jobdescription", "jd", "details", "requirements", "summary"],
      url: ["url", "link", "joburl", "applylink"],
    },
    resumes: {
      name: ["name", "candidate", "candidatename", "fullname"],
      email: ["email", "emailaddress", "mail"],
      resume: ["resume", "resumetext", "cv", "text", "content", "profile"],
    },
  };

  function mapColumns(parsed, mode) {
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
    const spec = COLS[mode];
    const map = {};
    const notes = [];
    parsed.headers.forEach((h, i) => {
      const k = norm(h);
      for (const key of Object.keys(spec)) if (map[key] === undefined && spec[key].includes(k)) { map[key] = i; break; }
    });
    const required = mode === "jobs" ? "description" : "resume";
    if (map[required] === undefined) {
      const used = new Set(Object.values(map));
      let best = -1, bestLen = 0;
      parsed.headers.forEach((h, i) => {
        if (used.has(i)) return;
        const avg = parsed.rows.reduce((s, r) => s + (r[i] || "").length, 0) / Math.max(1, parsed.rows.length);
        if (avg > bestLen) { bestLen = avg; best = i; }
      });
      if (best >= 0 && bestLen >= 60) {
        map[required] = best;
        notes.push(`No "${required}" column found, so "${parsed.headers[best]}" was used (the column with the longest text).`);
      } else {
        throw new Error(`Could not find a "${required}" column. Your CSV has: ${parsed.headers.join(", ") || "no header row"}. The first row must be a header row that includes "${required}".`);
      }
    }
    return { map, notes };
  }

  function checkParsed(parsed) {
    if (!parsed.headers.length || !parsed.rows.length) throw new Error("The CSV needs a header row and at least one data row.");
    if (parsed.unterminatedQuote) throw new Error("The CSV has an opening quote that is never closed. Check the quotes around long text cells.");
  }

  function rankJobs(resumeText, parsed) {
    checkParsed(parsed);
    const { map, notes } = mapColumns(parsed, "jobs");
    const R = prepareResume(resumeText);
    if (!R.text) throw new Error("Paste your resume first.");
    const results = [];
    let skipped = 0;
    parsed.rows.slice(0, MAX_ROWS).forEach((r, i) => {
      const jd = (r[map.description] || "").trim();
      if (!jd) { skipped++; return; }
      const title = (map.title !== undefined ? r[map.title] : "") || guessTitle(jd) || `Job ${i + 1}`;
      const company = map.company !== undefined ? r[map.company] || "" : "";
      const url = map.url !== undefined ? r[map.url] || "" : "";
      const a = analyze(R, jd, { title, company });
      results.push(Object.assign({ row: i + 2, title: title.trim(), company: company.trim(), url: url.trim() }, a));
    });
    results.sort((x, y) => y.score - x.score || y.ats.score - x.ats.score);
    return { results, skipped, total: parsed.rows.length, truncated: parsed.rows.length > MAX_ROWS, notes, format: R.format };
  }

  function rankResumes(jdText, parsed, opts) {
    checkParsed(parsed);
    opts = opts || {};
    const { map, notes } = mapColumns(parsed, "resumes");
    const jd = String(jdText || "").trim();
    if (!jd) throw new Error("Paste the job description first.");
    const title = String(opts.title || "").trim() || guessTitle(jd);
    const results = [];
    let skipped = 0;
    parsed.rows.slice(0, MAX_ROWS).forEach((r, i) => {
      const text = (r[map.resume] || "").trim();
      if (!text) { skipped++; return; }
      const name = (map.name !== undefined ? r[map.name] : "").trim() || `Candidate ${i + 1}`;
      const email = map.email !== undefined ? (r[map.email] || "").trim() : "";
      const a = analyze(text, jd, { title, name });
      results.push(Object.assign({ row: i + 2, name, email }, a));
    });
    results.sort((x, y) => y.score - x.score || y.ats.score - x.ats.score);
    return { results, skipped, total: parsed.rows.length, truncated: parsed.rows.length > MAX_ROWS, notes, title };
  }

  function csvCell(v) {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // block spreadsheet formula injection
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(columns, rows) {
    const head = columns.map((c) => csvCell(c.label)).join(",");
    return [head].concat(rows.map((r) => columns.map((c) => csvCell(c.get(r))).join(","))).join("\r\n");
  }

  /* ---------------- sample data ---------------- */
  const samples = {
    resume: `Sample Candidate | candidate@email.com | +91 90000 00000 | github.com/sample | linkedin.com/in/sample
Computer Science Engineering graduate with experience in machine learning, web development and graphic design.

Skills
Python, scikit-learn, Pandas, NumPy, SQL, JavaScript, HTML, CSS, Git, GitHub, Canva, REST APIs, data analysis

Projects
- Built a text classification model in Python using scikit-learn and NLP techniques, reaching 92% accuracy on 8,000 reviews.
- Developed a responsive portfolio website with HTML, CSS and JavaScript; deployed on GitHub Pages and used by 400+ visitors.
- Created 150+ social media graphics in Canva for small businesses, improving engagement by 25%.
- Analyzed sales data with Pandas and built charts to find trends in monthly revenue.

Experience
Graphic Designer | Local Studio | 2023 - 2025
- Delivered 20+ branding and social media projects for clients using Canva.

Education
B.E. Computer Science Engineering | 2023`,
    jd: `Junior Machine Learning Engineer
We are looking for a junior engineer to build machine learning models in Python and ship them as REST APIs.
Requirements: Python, scikit-learn, Pandas, SQL, Git, NLP, REST APIs. Experience with FastAPI, Docker and React is a plus.
You will work in an agile team with designers and product managers and present data analysis results.`,
    jobsCsv: `title,company,description
Junior Machine Learning Engineer,Northwind Analytics,"Build machine learning models in Python and ship them as REST APIs. Requirements: Python, scikit-learn, Pandas, SQL, Git, NLP. FastAPI and Docker are a plus. Work in an agile team and present data analysis results."
Front-End Developer,Brightside Studio,"Build responsive interfaces with React, JavaScript, HTML and CSS. Work closely with designers in Figma. Experience with Git, REST APIs and Tailwind CSS is a plus. Strong communication skills."
Data Analyst,Harbor Retail,"Analyze sales data with SQL, Python and Pandas. Build dashboards in Power BI or Tableau and present data visualization insights to managers. Excel required."
UI/UX Designer,Pixel & Co,"Design user interfaces and brand assets in Figma and Canva. Strong graphic design and UI/UX skills, responsive design experience, and basic HTML and CSS knowledge."
Senior Backend Engineer,Cloudline,"Design scalable services in Java and Spring Boot with PostgreSQL, Docker, Kubernetes and AWS. CI/CD experience required. 5+ years of experience."`,
    resumesCsv: `name,email,resume
Aisha Khan,aisha@example.com,"Aisha Khan | aisha@example.com | +91 90000 00001 | github.com/aisha
Skills: Python, scikit-learn, Pandas, SQL, NLP, Git, Docker, FastAPI
Projects
- Built an NLP sentiment classifier in Python with scikit-learn, reaching 91% accuracy on 10,000 reviews.
- Deployed a FastAPI service in Docker that serves predictions to 200+ users.
Education: B.Tech Computer Science 2024"
Rohan Das,rohan@example.com,"Rohan Das | rohan@example.com
Skills: HTML, CSS, JavaScript, Canva
Projects
- Designed a portfolio website and 50+ social media graphics in Canva.
Education: B.Sc 2023"
Meera Iyer,meera@example.com,"Meera Iyer | meera@example.com | +91 90000 00003
Skills: Python, Pandas, SQL, Tableau, Excel, Git
Experience
- Analyzed retail sales data with SQL and Pandas, cutting weekly reporting time by 40%.
- Built 6 Tableau dashboards used by 30+ managers.
Education: M.Sc Statistics 2022"`,
  };

  const api = { analyze, atsCheck, prepareResume, extractSkills, tokenize, parseCSV, mapColumns, rankJobs, rankResumes, toCSV, samples, MAX_ROWS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ResumeFit = api;
})(typeof self !== "undefined" ? self : this);
