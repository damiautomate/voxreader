// src/services/pdfExtract.js
// Extracts text from PDF with smart paragraph merging and chapter detection
import * as pdfjsLib from 'pdfjs-dist';

// Use CDN worker to avoid bundling issues
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

export async function extractPDF(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = [];
  const rawBlocks = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);

    // Render page to image for PDF sync view
    const vp = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    pages.push(canvas.toDataURL('image/jpeg', 0.8));

    // Extract text with positions
    const tc = await page.getTextContent();
    const pageHeight = page.view[3];
    const lines = [];
    let currentLine = [];
    let lastY = null;

    for (const item of tc.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      const h = item.height || item.transform[0];

      // New line if Y changes significantly
      if (lastY !== null && Math.abs(y - lastY) > h * 0.5) {
        if (currentLine.length) lines.push([...currentLine]);
        currentLine = [];
      }
      currentLine.push({
        str: item.str,
        x: item.transform[4],
        w: item.width,
        h,
        y
      });
      lastY = y;
    }
    if (currentLine.length) lines.push([...currentLine]);

    // Join items within each line using x-position gaps
    for (const line of lines) {
      line.sort((a, b) => a.x - b.x);
      let text = '';
      let prevEnd = 0;

      for (let i = 0; i < line.length; i++) {
        const it = line[i];
        const gap = it.x - prevEnd;
        const avgCharW = it.w / Math.max(it.str.length, 1);
        if (i > 0 && gap > avgCharW * 0.3) text += ' ';
        text += it.str;
        prevEnd = it.x + it.w;
      }

      const trimmed = text.trim();
      if (!trimmed || trimmed.length < 2) continue;

      // Classify block type by position
      let type = 'text';
      if (line[0].y > pageHeight * 0.88) type = 'header';
      else if (line[0].y < pageHeight * 0.07) type = 'footer';
      else if (line[0].h > 15 && trimmed.length < 100) type = 'heading';

      rawBlocks.push({ type, text: trimmed, page: p, fontSize: line[0].h });
    }
  }

  // Merge into paragraphs with hyphenation fix
  const merged = [];
  let buffer = '';
  let bufferPage = 1;

  for (const block of rawBlocks) {
    if (block.type === 'header' || block.type === 'footer') {
      if (buffer.trim()) {
        merged.push({ type: 'paragraph', text: buffer.trim(), page: bufferPage });
      }
      buffer = '';
      merged.push(block);
      continue;
    }

    if (block.type === 'heading') {
      if (buffer.trim()) {
        merged.push({ type: 'paragraph', text: buffer.trim(), page: bufferPage });
      }
      buffer = '';
      merged.push({ type: 'chapter', text: block.text, page: block.page });
      continue;
    }

    // Join hyphenated words across lines
    if (buffer.endsWith('-')) {
      buffer = buffer.slice(0, -1) + block.text;
    } else if (buffer && !/[.!?":;]$/.test(buffer)) {
      buffer += ' ' + block.text;
    } else {
      if (buffer.trim()) {
        merged.push({ type: 'paragraph', text: buffer.trim(), page: bufferPage });
      }
      buffer = block.text;
      bufferPage = block.page;
    }
  }
  if (buffer.trim()) {
    merged.push({ type: 'paragraph', text: buffer.trim(), page: bufferPage });
  }

  // Auto-clean common split words
  const cleaned = merged
    .filter(b => b.text.length > 3)
    .map(b => {
      if (b.type !== 'paragraph') return b;
      let t = b.text
        .replace(/(\w)\s(tion|sion|ment|ness|ing|ous|ive|ful|less|ence|ance|ity)\b/gi, '$1$2')
        .replace(/\b(in|un|re|pre|dis|mis)\s(\w{3,})/gi, '$1$2')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return { ...b, text: t };
    });

  return { blocks: cleaned, pageImages: pages, pageCount: pdf.numPages };
}
