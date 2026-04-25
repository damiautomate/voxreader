// src/services/pdfProcessor.js
// Calls the /api/process-pdf serverless endpoint to AI-clean a PDF

import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

let cachedAnthropicKey = null;
export async function getAnthropicKey() {
  if (cachedAnthropicKey) return cachedAnthropicKey;
  const snap = await getDoc(doc(db, 'app_settings', 'anthropic'));
  if (snap.exists()) {
    cachedAnthropicKey = snap.data().apiKey;
    return cachedAnthropicKey;
  }
  return null;
}

export async function clearAnthropicKeyCache() { cachedAnthropicKey = null; }

// Convert File to base64 (without data: prefix)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // result is "data:application/pdf;base64,XXXX"
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Process a PDF file: send to API, get back structured chapters
export async function processPDF(file, onProgress) {
  const apiKey = await getAnthropicKey();
  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Ask admin to set it in Settings.');
  }

  if (onProgress) onProgress({ stage: 'reading', message: 'Reading PDF...' });

  const pdfBase64 = await fileToBase64(file);

  if (onProgress) onProgress({ stage: 'uploading', message: 'Uploading to AI processor...' });

  const response = await fetch('/api/process-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64, apiKey })
  });

  if (!response.ok) {
    let errMsg = `Server error (${response.status})`;
    try {
      const errBody = await response.json();
      errMsg = errBody.error || errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  if (onProgress) onProgress({ stage: 'processing', message: 'Cleaning & structuring text...' });

  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Unknown processing error');

  if (onProgress) onProgress({ stage: 'done', message: 'Done!' });

  return {
    chapters: data.chapters,
    pageCount: data.pageCount,
    totalChapters: data.totalChapters,
    totalParagraphs: data.totalParagraphs
  };
}
