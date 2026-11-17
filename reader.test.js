const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const RR = require("../reader.js");

// Build a small .docx-style zip with deflate-compressed entries.
function zip(files) {
  const chunks = [], central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameB = Buffer.from(name), raw = Buffer.from(content), comp = zlib.deflateRawSync(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nameB.length, 26);
    chunks.push(lh, nameB, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, nameB);
    offset += 30 + nameB.length + comp.length;
  }
  const cd = Buffer.concat(central), n = Object.keys(files).length, eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(n, 8); eocd.writeUInt16LE(n, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, eocd]);
}
const file = (name, buf) => ({ name, size: buf.length, type: "", arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), text: async () => buf.toString("utf8") });

test("kindOf recognises supported types", () => {
  assert.equal(RR.kindOf({ name: "CV.PDF" }), "pdf");
  assert.equal(RR.kindOf({ name: "cv.docx" }), "docx");
  assert.equal(RR.kindOf({ name: "cv.doc" }), "doc");
  assert.equal(RR.kindOf({ name: "jobs.csv" }), "csv");
  assert.equal(RR.kindOf({ name: "cv.txt" }), "text");
  assert.equal(RR.kindOf({ name: "cv.exe" }), "unknown");
});

test("reads a .docx: paragraphs, bullets, entities and header text", async () => {
  const doc = `<w:document><w:body>
    <w:p><w:r><w:t>Rohan Das</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Built R&amp;D tools with 50+ users</w:t></w:r></w:p>
  </w:body></w:document>`;
  const header = `<w:hdr><w:p><w:r><w:t>rohan@example.com | +91 90000 11111</w:t></w:r></w:p></w:hdr>`;
  const buf = zip({ "word/document.xml": doc, "word/header1.xml": header });
  const r = await RR.readFileText(file("cv.docx", buf));
  assert.equal(r.kind, "docx");
  assert.match(r.text, /^rohan@example\.com/);
  assert.match(r.text, /Rohan Das/);
  assert.match(r.text, /- Built R&D tools with 50\+ users/);
});

test("rejects a broken .docx, an old .doc and unsupported files with clear messages", async () => {
  await assert.rejects(RR.readFileText(file("bad.docx", Buffer.from("not a zip at all, just text"))), /valid \.docx/);
  await assert.rejects(RR.readFileText(file("old.doc", Buffer.from("x"))), /old \.doc/);
  await assert.rejects(RR.readFileText(file("a.exe", Buffer.from("x"))), /not supported/);
});

test("reads .txt and rejects empty files and files over 10 MB", async () => {
  const r = await RR.readFileText(file("cv.txt", Buffer.from("Meera Iyer\r\n\r\n\r\n\r\nSkills: Python")));
  assert.equal(r.text, "Meera Iyer\n\nSkills: Python");
  await assert.rejects(RR.readFileText(file("e.txt", Buffer.from("   "))), /empty/);
  await assert.rejects(RR.readFileText({ name: "big.txt", size: RR.MAX_BYTES + 1, text: async () => "x" }), /10 MB/);
});

test("PDF text is rebuilt line by line from pdf.js items (using an injected reader)", async () => {
  const items = [
    { str: "Priya Nair", transform: [1, 0, 0, 1, 10, 100], width: 50 },
    { str: "Skills:", transform: [1, 0, 0, 1, 10, 80], width: 30 },
    { str: "Python,", transform: [1, 0, 0, 1, 44, 80], width: 35, hasEOL: true },
    { str: "SQL", transform: [1, 0, 0, 1, 10, 60], width: 18, hasEOL: true },
  ];
  const fakePdfjs = { getDocument: () => ({ promise: Promise.resolve({ numPages: 1, destroy() {}, getPage: async () => ({ getTextContent: async () => ({ items }) }) }) }) };
  const r = await RR.readFileText(file("cv.pdf", Buffer.from("%PDF-fake")), { pdfjs: fakePdfjs });
  assert.equal(r.text, "Priya Nair\nSkills: Python,\nSQL");
});

test("a PDF with no text gives a helpful message", async () => {
  const fakePdfjs = { getDocument: () => ({ promise: Promise.resolve({ numPages: 1, destroy() {}, getPage: async () => ({ getTextContent: async () => ({ items: [] }) }) }) }) };
  await assert.rejects(RR.readFileText(file("scan.pdf", Buffer.from("%PDF-fake")), { pdfjs: fakePdfjs }), /scan/);
});
