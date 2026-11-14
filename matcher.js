/*
 * ResumeFit matching engine
 * Scores how well a resume matches a job description using:
 *   1. Skill coverage   – known tech/design skills found in the JD vs. the resume
 *   2. Keyword coverage – the JD's most frequent meaningful terms present in the resume
 *   3. Cosine similarity – sublinear term-frequency vectors of both documents
 * Runs fully client-side. Works in the browser and in Node (for tests).
 */
(function (root) {
  "use strict";

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
    SQL: ["sql", "mysql", "postgresql", "postgres"],
    MongoDB: ["mongodb"],
    JavaScript: ["javascript", "js", "es6"],
    TypeScript: ["typescript"],
    React: ["react", "reactjs", "react.js"],
    "Next.js": ["next.js", "nextjs"],
    "Node.js": ["node.js", "nodejs", "node"],
    Express: ["express", "express.js"],
    HTML: ["html", "html5"],
    CSS: ["css", "css3"],
    "Tailwind CSS": ["tailwind", "tailwind css"],
    Java: ["java"],
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
    "OOP": ["oop", "object oriented", "object-oriented"],
    Agile: ["agile", "scrum"],
    "Data Analysis": ["data analysis", "data analytics"],
    "Data Visualization": ["data visualization", "tableau", "power bi", "matplotlib"],
    "LLMs": ["llm", "llms", "large language model", "large language models", "openai", "langchain"],
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
      "build builds building engineer engineers junior senior expose help helps need needs make makes plus knowledge " +
      "hiring hire skills skill develop developer developers developing").split(" ")
  );

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

  function hasPhrase(text, phrase) {
    const re = new RegExp("(^|[^a-z0-9+#])" + esc(phrase) + "($|[^a-z0-9+#])", "i");
    return re.test(text);
  }

  function extractSkills(text) {
    const t = text.toLowerCase();
    const found = new Set();
    for (const [name, aliases] of Object.entries(SKILLS)) {
      if (aliases.some((a) => hasPhrase(t, a))) found.add(name);
    }
    return found;
  }

  function tokenize(text) {
    return text
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
    for (const v of b.values()) {
      const y = 1 + Math.log(v);
      nb += y * y;
    }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  function topKeywords(jdCounts, n) {
    return [...jdCounts.entries()]
      .filter(([w, c]) => c >= 2 || w.length > 5)
      .sort((x, y) => y[1] - x[1] || y[0].length - x[0].length)
      .slice(0, n)
      .map(([w]) => w);
  }

  function label(score) {
    if (score >= 80) return "Excellent match";
    if (score >= 65) return "Strong match";
    if (score >= 45) return "Decent match";
    if (score >= 25) return "Weak match";
    return "Low match";
  }

  function analyze(resume, jd) {
    resume = (resume || "").trim();
    jd = (jd || "").trim();
    if (!resume || !jd) throw new Error("Both resume and job description are required.");

    const rSkills = extractSkills(resume);
    const jSkills = extractSkills(jd);
    const matched = [...jSkills].filter((s) => rSkills.has(s));
    const missing = [...jSkills].filter((s) => !rSkills.has(s));
    const extra = [...rSkills].filter((s) => !jSkills.has(s));

    const rCounts = counts(tokenize(resume));
    const jCounts = counts(tokenize(jd));
    const kws = topKeywords(jCounts, 25);
    const kwHit = kws.filter((k) => rCounts.has(k));
    const kwMiss = kws.filter((k) => !rCounts.has(k));

    const skillCov = jSkills.size ? matched.length / jSkills.size : null;
    const kwCov = kws.length ? kwHit.length / kws.length : 0;
    const cos = cosine(jCounts, rCounts);

    const raw =
      skillCov === null
        ? 0.7 * kwCov + 0.3 * Math.min(1, cos * 2)
        : 0.55 * skillCov + 0.3 * kwCov + 0.15 * Math.min(1, cos * 2);
    const score = Math.max(0, Math.min(100, Math.round(raw * 100)));

    // Resume quality tips
    const tips = [];
    const rl = resume.toLowerCase();
    if (missing.length)
      tips.push(
        `Add these skills to your resume where you genuinely have them: ${missing.slice(0, 6).join(", ")}. Put them in a Skills section and inside project bullets.`
      );
    if (kwMiss.length)
      tips.push(`Work these job-description keywords into your bullets naturally: ${kwMiss.slice(0, 8).join(", ")}.`);
    if (!/\d/.test(resume) || (resume.match(/\d+%|\d+\+|\$\d+|\d+x/g) || []).length < 2)
      tips.push("Add measurable results (e.g. \"improved accuracy by 12%\", \"served 500+ users\"). Numbers make bullets stand out.");
    const sections = ["education", "experience", "projects", "skills"];
    const noSec = sections.filter((s) => !rl.includes(s));
    if (noSec.length) tips.push(`Consider adding clear section headings for: ${noSec.join(", ")}.`);
    if (!/github\.com|linkedin\.com|portfolio/i.test(resume))
      tips.push("Include links to your GitHub, LinkedIn and live projects at the top of your resume.");
    const words = resume.split(/\s+/).length;
    if (words < 150) tips.push("Your resume looks short. Add project details, tools used and outcomes.");
    if (words > 900) tips.push("Your resume is long. Aim for one page with your strongest, most relevant points.");
    if (!tips.length) tips.push("Great alignment. Tailor your top 3 bullets to mirror the job's priorities and you're set.");

    return {
      score,
      label: label(score),
      breakdown: {
        skillCoverage: skillCov === null ? null : Math.round(skillCov * 100),
        keywordCoverage: Math.round(kwCov * 100),
        textSimilarity: Math.round(Math.min(1, cos * 2) * 100),
      },
      matchedSkills: matched,
      missingSkills: missing,
      extraSkills: extra,
      matchedKeywords: kwHit,
      missingKeywords: kwMiss,
      tips,
      wordCount: words,
    };
  }

  const api = { analyze, extractSkills, tokenize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ResumeFit = api;
})(typeof self !== "undefined" ? self : this);
