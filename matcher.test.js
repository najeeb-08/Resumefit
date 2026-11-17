const test = require("node:test");
const assert = require("node:assert/strict");
const RF = require("../matcher.js");
const S = RF.samples;

test("parseCSV handles quotes, multi-line cells and delimiters", () => {
  const p = RF.parseCSV('title;description\r\nA;"line1\nline2, with comma"\r\nB;desc');
  assert.equal(p.delimiter, ";");
  assert.deepEqual(p.headers, ["title", "description"]);
  assert.equal(p.rows.length, 2);
  assert.equal(p.rows[0][1], "line1\nline2, with comma");
});

test("parseCSV reports an unterminated quote", () => {
  assert.equal(RF.parseCSV('a,b\n1,"oops').unterminatedQuote, true);
});

test("rankJobs rejects CSVs without a description column", () => {
  assert.throws(() => RF.rankJobs("my resume", RF.parseCSV("x,y\n1,2")), /description/);
});

test("analyze: matching resume scores higher than an unrelated one", () => {
  const good = RF.analyze(S.resume, S.jd);
  const bad = RF.analyze("Chef | chef@example.com\nSkills: knife work, plating", S.jd);
  assert.ok(good.score > bad.score + 30, `${good.score} vs ${bad.score}`);
  assert.ok(good.matchedSkills.includes("Python"));
  assert.ok(good.missingSkills.includes("Agile"));
});

test("analyze: skills named only as 'a plus' are optional and weigh less", () => {
  const r = RF.analyze(S.resume, S.jd);
  assert.ok(r.optionalSkills.includes("Docker"));
  assert.ok(r.optionalSkills.includes("FastAPI"));
  assert.ok(!r.optionalSkills.includes("Python"));
});

test("analyze: a resume is not penalised for libraries that imply a skill", () => {
  const r = RF.analyze("Skills: scikit-learn, FastAPI", "We need machine learning and REST API experience.");
  assert.ok(r.matchedSkills.includes("Machine Learning"));
  assert.ok(r.matchedSkills.includes("REST APIs"));
});

test("ATS checklist: sample resume passes the format checks, an empty-ish one does not", () => {
  const good = RF.atsCheck(S.resume);
  const bad = RF.atsCheck("some words only");
  assert.ok(good.score >= 90, String(good.score));
  assert.ok(bad.score < 30, String(bad.score));
  assert.equal(good.checks.length, 14);
});

test("rankJobs sorts by score and rankResumes handles the sample CSV", () => {
  const jobs = RF.rankJobs(S.resume, RF.parseCSV(S.jobsCsv));
  const scores = jobs.results.map((r) => r.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.equal(jobs.results[0].title, "Junior Machine Learning Engineer");
  const res = RF.rankResumes(S.jd, RF.parseCSV(S.resumesCsv));
  assert.equal(res.results[0].name, "Aisha Khan");
  assert.ok(res.results[0].reply.startsWith("Hi Aisha"));
});

test("rankResumeList names candidates from file text and finds emails", () => {
  const r = RF.rankResumeList(S.jd, [{ name: "", text: "Priya Nair | priya@x.com\nSkills: Python, SQL", source: "priya.pdf" }]);
  assert.equal(r.results[0].name, "Priya Nair");
  assert.equal(r.results[0].email, "priya@x.com");
});

test("planGaps ranks the missing skills and what-if scoring never lowers a score", () => {
  const jobs = RF.rankJobs(S.resume, RF.parseCSV(S.jobsCsv));
  const plan = RF.planGaps(jobs.resume, jobs.results, 6);
  assert.ok(plan.length > 0);
  assert.ok(plan.every((p) => p.jobs > 0 && p.avgGain >= 0));
  const top = plan[0].skill;
  const after = RF.rescoreJobs(jobs.resume, jobs.results, [top]);
  assert.ok(after.every((r) => r.delta >= 0));
  assert.ok(after.some((r) => r.delta > 0));
});

test("highlightJD tags skills and keeps the original text intact", () => {
  const jd = "Need Python and Docker.";
  const segs = RF.highlightJD(jd, ["Python"], ["Docker"], []);
  assert.equal(segs.map((s) => s.text).join(""), jd);
  assert.deepEqual(segs.filter((s) => s.kind).map((s) => [s.text, s.kind]), [["Python", "have"], ["Docker", "miss"]]);
});

test("toCSV blocks spreadsheet formula injection and quotes cells", () => {
  const csv = RF.toCSV([{ label: "Name", get: (r) => r.n }], [{ n: "=cmd()" }, { n: "a,b" }]);
  assert.equal(csv, "Name\r\n'=cmd()\r\n\"a,b\"");
});

test("planGaps stays fast with 200 jobs", () => {
  const rows = [];
  for (let i = 0; i < 200; i++) rows.push([`Job ${i}`, "Co", `Build ${i % 2 ? "React and TypeScript" : "Python and Docker"} apps with SQL, AWS and Kubernetes. FastAPI a plus.`]);
  const jobs = RF.rankJobs(S.resume, { headers: ["title", "company", "description"], rows });
  const t = Date.now();
  RF.planGaps(jobs.resume, jobs.results, 10);
  assert.ok(Date.now() - t < 2000);
});
