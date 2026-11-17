/*
 * ResumeFit file reader
 * Turns an uploaded file into plain text, fully in the browser:
 *   .pdf   -> pdf.js (loaded from cdnjs on first use)
 *   .docx  -> built-in unzip (DecompressionStream) + XML text extraction
 *   .txt / .md / .csv -> read as text
 * Works in the browser (window.ResumeReader) and in Node (module.exports) for tests.
 */
(function (root) {
  "use strict";

  const PDFJS_VERSION = "3.11.174";
  const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VERSION + "/pdf.min.js";
  const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VERSION + "/pdf.worker.min.js";
  const MAX_BYTES = 10 * 1024 * 1024;
  const MAX_PAGES = 8;

  function kindOf(file) {
    const n = String((file && file.name) || "").toLowerCase();
    const t = String((file && file.type) || "");
    if (/\.pdf$/.test(n) || t === "application/pdf") return "pdf";
    if (/\.docx$/.test(n)) return "docx";
    if (/\.doc$/.test(n)) return "doc";
    if (/\.(csv|tsv)$/.test(n)) return "csv";
    if (/\.(txt|md|text)$/.test(n) || t.indexOf("text/") === 0) return "text";
    return "unknown";
  }

  function normalize(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[   ]/g, " ")
      .replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl")
      .replace(/[▪●‣]/g, "•")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /* ---------------- PDF ---------------- */
  let pdfjsPromise = null;
  function loadPdfjs() {
    if (root.pdfjsLib) return Promise.resolve(root.pdfjsLib);
    if (typeof document === "undefined") return Promise.reject(new Error("PDF reader is only available in the browser."));
    if (!pdfjsPromise) {
      pdfjsPromise = new Promise(function (resolve, reject) {
        const s = document.createElement("script");
        s.src = PDFJS_URL;
        s.onload = function () {
          if (!root.pdfjsLib) { pdfjsPromise = null; return reject(new Error("The PDF reader did not start. Paste the text instead.")); }
          root.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
          resolve(root.pdfjsLib);
        };
        s.onerror = function () {
          pdfjsPromise = null;
          reject(new Error("Could not load the PDF reader. It needs an internet connection. You can paste the resume text instead."));
        };
        document.head.appendChild(s);
      });
    }
    return pdfjsPromise;
  }

  async function pdfToText(buf, lib) {
    lib = lib || (await loadPdfjs());
    const doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
    const pages = [];
    const n = Math.min(doc.numPages, MAX_PAGES);
    for (let p = 1; p <= n; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      const lines = [];
      let cur = "", lastY = null, lastEnd = null;
      const flush = function () { if (cur.trim()) lines.push(cur.replace(/\s+$/, "")); cur = ""; lastEnd = null; };
      for (const it of tc.items) {
        if (typeof it.str !== "string" || !it.transform) continue;
        const x = it.transform[4], y = it.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > Math.max(2, (it.height || 10) * 0.4)) flush();
        if (cur && lastEnd !== null && x - lastEnd > 1.5 && !/\s$/.test(cur) && !/^\s/.test(it.str)) cur += " ";
        cur += it.str;
        lastY = y;
        lastEnd = x + (it.width || 0);
        if (it.hasEOL) { flush(); lastY = null; }
      }
      flush();
      pages.push(lines.join("\n"));
    }
    try { if (doc.destroy) doc.destroy(); } catch (e) { /* ignore */ }
    return pages.join("\n\n");
  }

  /* ---------------- DOCX ---------------- */
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open .docx files. Use a PDF or paste the text.");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzipEntry(buf, wanted) {
    const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return null;
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      if (name === wanted) {
        const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
        const data = u8.subarray(start, start + csize);
        if (method === 0) return data;
        if (method === 8) return inflateRaw(data);
        throw new Error("Unsupported .docx compression.");
      }
      p += 46 + nlen + elen + clen;
    }
    return null;
  }

  function decodeEntities(s) {
    return s
      .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (m, d) { return String.fromCodePoint(parseInt(d, 10)); })
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  }

  function docxXmlToText(xml) {
    const out = [];
    for (const chunk of String(xml).split("</w:p>")) {
      const isList = /<w:numPr>/.test(chunk) || /<w:pStyle w:val="[^"]*(List|Bullet)[^"]*"/i.test(chunk);
      let line = chunk
        .replace(/<w:instrText[\s\S]*?<\/w:instrText>/g, "")
        .replace(/<w:tab\s*\/>/g, " ")
        .replace(/<w:br\s*\/>/g, "\n")
        .replace(/<[^>]+>/g, "");
      line = decodeEntities(line).replace(/[ \t]+/g, " ").trim();
      out.push(line ? (isList ? "- " : "") + line : "");
    }
    return out.join("\n");
  }

  async function docxToText(buf) {
    const entry = await unzipEntry(buf, "word/document.xml");
    if (!entry) throw new Error("This does not look like a valid .docx file.");
    // Many Word templates keep name and contact details in the page header.
    const parts = [];
    for (const n of ["word/header1.xml", "word/header2.xml", "word/header3.xml"]) {
      const h = await unzipEntry(buf, n);
      const t = h ? docxXmlToText(new TextDecoder("utf-8").decode(h)).trim() : "";
      if (t && parts.indexOf(t) < 0) parts.push(t);
    }
    parts.push(docxXmlToText(new TextDecoder("utf-8").decode(entry)));
    return parts.join("\n");
  }

  /* ---------------- public ---------------- */
  async function readFileText(file, opts) {
    const kind = kindOf(file);
    const name = (file && file.name) || "file";
    if (file.size > MAX_BYTES) throw new Error(name + " is over 10 MB.");
    let text = "";
    if (kind === "pdf") text = await pdfToText(await file.arrayBuffer(), opts && opts.pdfjs);
    else if (kind === "docx") text = await docxToText(await file.arrayBuffer());
    else if (kind === "text" || kind === "csv") text = await file.text();
    else if (kind === "doc") throw new Error(name + " is an old .doc file. Save it as .docx or PDF, or paste the text.");
    else throw new Error(name + " is not supported. Use PDF, DOCX or TXT.");
    text = normalize(text);
    if (!text) {
      throw new Error(kind === "pdf"
        ? name + " has no selectable text. It may be a scan. Export a text PDF or paste the text."
        : name + " is empty.");
    }
    return { text: text, kind: kind, name: name };
  }

  const api = { readFileText: readFileText, kindOf: kindOf, normalize: normalize, pdfToText: pdfToText, docxToText: docxToText, docxXmlToText: docxXmlToText, MAX_BYTES: MAX_BYTES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ResumeReader = api;
})(typeof self !== "undefined" ? self : this);
