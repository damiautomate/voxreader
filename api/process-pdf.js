// api/process-pdf.js
// Vercel serverless function that processes a PDF using Claude AI
// Receives base64 PDF → extracts text → sends to Claude for cleaning → returns structured JSON

import Anthropic from '@anthropic-ai/sdk';
import { PDFParse } from 'pdf-parse';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb' // allow large PDFs
    },
    responseLimit: false,
    maxDuration: 300 // 5 minutes for big books
  }
};

const SYSTEM_PROMPT = `You are a book formatter. Given raw text extracted from a PDF book page, you produce clean structured JSON.

Your job:
1. Identify CHAPTERS (numbered chapters, named chapters, "Chapter 1: Title" patterns)
2. Identify PARTS (Step 1, Part One, Section A — these group multiple chapters)
3. Identify SECTIONS (subheadings within chapters — bold short text breaking up paragraphs)
4. Remove HEADERS, FOOTERS, PAGE NUMBERS, copyright lines, "OceanofPDF.com", URLs, table of contents pages
5. Fix BROKEN WORDS (e.g., "in the way" was extracted as "inthe way" → fix to "in the way", "you 'renot" → "you're not", "in front" not "infront")
6. Merge paragraphs split across line breaks back into proper paragraphs
7. Preserve actual paragraph breaks — don't merge separate paragraphs together
8. Skip blurbs, dedications, copyright pages, table of contents — focus on real book content
9. Keep introductions, prefaces if they contain real reading content

Output a JSON array. Each element is one of:
- {"type": "part", "text": "STEP 1: Believe the Possibility"}
- {"type": "chapter", "text": "Your Beliefs Shape Your Reality", "number": 1}
- {"type": "section", "text": "Revise Your Beliefs"}
- {"type": "paragraph", "text": "..."}

Return ONLY valid JSON array, no markdown, no commentary, no explanation.`;

async function cleanChunk(client, rawText, contextNote = '') {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `${contextNote ? contextNote + '\n\n' : ''}Raw extracted text:\n\n${rawText}`
    }]
  });

  // Get text from response
  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text in Claude response');
  const responseText = textBlock.text.trim();

  // Strip ```json fences if present
  const cleaned = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try to find a JSON array within the response
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]); }
      catch { /* fall through */ }
    }
    console.error('Failed to parse Claude response:', cleaned.slice(0, 500));
    throw new Error('AI returned invalid JSON');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pdfBase64, apiKey } = req.body || {};

  if (!pdfBase64) return res.status(400).json({ error: 'Missing pdfBase64' });
  if (!apiKey) return res.status(400).json({ error: 'Missing apiKey (Anthropic key)' });

  try {
    // Decode PDF
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Extract raw text using pdf-parse v2
    const parser = new PDFParse({ data: pdfBuffer });
    const pdfData = await parser.getText();
    const rawText = pdfData.text;
    const pageCount = pdfData.pages?.length || pdfData.numpages || 0;

    if (!rawText || rawText.length < 100) {
      return res.status(400).json({ error: 'No text could be extracted. PDF may be scanned.' });
    }

    // Initialize Anthropic client
    const client = new Anthropic({ apiKey });

    // Process in chunks (~12k chars each so context stays clean)
    const CHUNK_SIZE = 12000;
    const chunks = [];
    for (let i = 0; i < rawText.length; i += CHUNK_SIZE) {
      // Extend chunk to next paragraph break to avoid splitting mid-sentence
      let end = i + CHUNK_SIZE;
      if (end < rawText.length) {
        const nextBreak = rawText.indexOf('\n\n', end);
        if (nextBreak !== -1 && nextBreak - end < 1500) end = nextBreak;
      }
      chunks.push(rawText.slice(i, end));
    }

    console.log(`Processing ${chunks.length} chunks for ${pageCount}-page PDF`);

    // Process all chunks in parallel (Anthropic SDK handles rate limits)
    const results = await Promise.all(
      chunks.map((chunk, i) => {
        const note = i === 0
          ? 'This is the start of the book. Skip blurbs, copyright, table of contents.'
          : i === chunks.length - 1
          ? 'This is the end of the book. Skip "About the Author", index, references if any.'
          : `This is chunk ${i + 1} of ${chunks.length} from the middle of the book.`;
        return cleanChunk(client, chunk, note).catch(err => {
          console.error(`Chunk ${i} failed:`, err.message);
          return []; // return empty for failed chunks rather than killing the whole job
        });
      })
    );

    // Merge all blocks
    const allBlocks = results.flat();

    // Renumber chapters in order (in case AI got numbers wrong across chunks)
    let chapterNum = 0;
    for (const block of allBlocks) {
      if (block.type === 'chapter') {
        chapterNum++;
        block.number = chapterNum;
      }
    }

    // Build chapters structure
    const chapters = [];
    let currentChapter = null;
    let currentPart = null;

    for (const block of allBlocks) {
      if (block.type === 'part') {
        currentPart = block.text;
        continue;
      }
      if (block.type === 'chapter') {
        currentChapter = {
          title: block.text,
          number: block.number,
          part: currentPart,
          paragraphs: []
        };
        chapters.push(currentChapter);
        continue;
      }
      // Need a chapter to attach content to
      if (!currentChapter) {
        currentChapter = { title: 'Introduction', number: 0, paragraphs: [] };
        chapters.push(currentChapter);
      }
      if (block.type === 'section') {
        currentChapter.paragraphs.push({ type: 'section', text: block.text });
      } else if (block.type === 'paragraph') {
        currentChapter.paragraphs.push({ type: 'paragraph', text: block.text });
      }
    }

    return res.status(200).json({
      success: true,
      pageCount,
      totalChapters: chapters.length,
      totalParagraphs: chapters.reduce((s, c) =>
        s + c.paragraphs.filter(p => p.type === 'paragraph').length, 0),
      chapters
    });

  } catch (error) {
    console.error('process-pdf error:', error);
    return res.status(500).json({
      error: error.message || 'Internal error',
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
  }
}
