// src/services/bookService.js
// Firestore operations for books, chapters, user progress, bookmarks

import { db } from './firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  addDoc, query, orderBy, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import { generateAndUpload } from './tts';

// ══════ BOOK CRUD ══════

// Create a new book from AI-processed chapter data
export async function createBook({ title, author, chapters, pageCount, userId, voiceName }) {
  // Calculate stats
  const wordCount = chapters.reduce((total, ch) =>
    total + ch.paragraphs
      .filter(p => p.type === 'paragraph')
      .reduce((t, p) => t + p.text.split(/\s+/).length, 0), 0);

  const totalParagraphs = chapters.reduce((t, ch) =>
    t + ch.paragraphs.filter(p => p.type === 'paragraph').length, 0);

  // Create the book document
  const bookRef = await addDoc(collection(db, 'books'), {
    title: title || 'Untitled Book',
    author: author || 'Unknown Author',
    uploadedBy: userId,
    createdAt: serverTimestamp(),
    totalChapters: chapters.length,
    totalParagraphs,
    totalDuration: 0,
    wordCount,
    pageCount: pageCount || 0,
    voiceName: voiceName || 'en-US-Neural2-D',
    status: 'pending', // pending | generating | complete
    coverColor: getRandomColor()
  });

  // Save chapters as subcollection — note: paragraphs include type "paragraph" or "section"
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    // Initialize each paragraph with empty audio fields
    const paragraphsWithAudio = ch.paragraphs.map(p => ({
      type: p.type,
      text: p.text,
      audioUrl: null,
      duration: 0
    }));

    await setDoc(doc(db, 'books', bookRef.id, 'chapters', `ch_${i}`), {
      title: ch.title,
      number: ch.number || i + 1,
      part: ch.part || null,
      index: i,
      paragraphs: paragraphsWithAudio,
      totalDuration: 0,
      status: 'pending'
    });
  }

  return bookRef.id;
}

// Generate audio for a single paragraph in a chapter
// Returns the updated chapter
export async function generateParagraphAudio(bookId, chapterIdx, paraIdx) {
  const chRef = doc(db, 'books', bookId, 'chapters', `ch_${chapterIdx}`);
  const chSnap = await getDoc(chRef);
  if (!chSnap.exists()) throw new Error('Chapter not found');

  const chapter = chSnap.data();
  const para = chapter.paragraphs[paraIdx];

  // Skip non-paragraphs and already-generated paragraphs
  if (!para || para.type !== 'paragraph') return chapter;
  if (para.audioUrl) return chapter;

  // Get book's voice
  const bookSnap = await getDoc(doc(db, 'books', bookId));
  const voiceName = bookSnap.data()?.voiceName || 'en-US-Neural2-D';

  // Generate
  try {
    const result = await generateAndUpload(para.text, bookId, chapterIdx, paraIdx, voiceName);
    chapter.paragraphs[paraIdx].audioUrl = result.url;
    chapter.paragraphs[paraIdx].duration = result.duration;

    // Update chapter doc
    await updateDoc(chRef, {
      paragraphs: chapter.paragraphs,
      totalDuration: chapter.paragraphs.reduce((s, p) => s + (p.duration || 0), 0)
    });

    // Check if chapter is now complete
    const allDone = chapter.paragraphs.every(p =>
      p.type !== 'paragraph' || p.audioUrl
    );
    if (allDone && chapter.status !== 'complete') {
      await updateDoc(chRef, { status: 'complete' });
      await updateBookDuration(bookId);
    }
  } catch (err) {
    console.error(`TTS failed for ch${chapterIdx}p${paraIdx}:`, err);
    throw err;
  }

  return chapter;
}

// Recalculate total book duration
async function updateBookDuration(bookId) {
  const chaptersSnap = await getDocs(
    query(collection(db, 'books', bookId, 'chapters'), orderBy('index'))
  );
  let totalDuration = 0;
  let allComplete = true;

  chaptersSnap.forEach(snap => {
    const ch = snap.data();
    totalDuration += ch.totalDuration || 0;
    if (ch.status !== 'complete') allComplete = false;
  });

  await updateDoc(doc(db, 'books', bookId), {
    totalDuration,
    status: allComplete ? 'complete' : 'generating'
  });
}

// Get all books in the library
export async function getLibrary() {
  const snap = await getDocs(
    query(collection(db, 'books'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Get a single book
export async function getBook(bookId) {
  const snap = await getDoc(doc(db, 'books', bookId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// Get all chapters for a book (lightweight - just titles, no paragraphs)
export async function getChapterList(bookId) {
  const snap = await getDocs(
    query(collection(db, 'books', bookId, 'chapters'), orderBy('index'))
  );
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      index: data.index,
      title: data.title,
      number: data.number,
      part: data.part,
      totalDuration: data.totalDuration || 0,
      status: data.status,
      paragraphCount: (data.paragraphs || []).filter(p => p.type === 'paragraph').length
    };
  });
}

// Get a single chapter with full paragraph content
export async function getChapter(bookId, chapterIdx) {
  const snap = await getDoc(doc(db, 'books', bookId, 'chapters', `ch_${chapterIdx}`));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// Mark book status as generating
export async function setBookGenerating(bookId) {
  await updateDoc(doc(db, 'books', bookId), { status: 'generating' });
}

// ══════ USER PROGRESS ══════

export async function saveProgress(userId, bookId, data) {
  await setDoc(doc(db, 'users', userId, 'library', bookId), {
    ...data,
    lastListened: serverTimestamp()
  }, { merge: true });
}

export async function getProgress(userId, bookId) {
  const snap = await getDoc(doc(db, 'users', userId, 'library', bookId));
  return snap.exists() ? snap.data() : null;
}

export async function getUserLibrary(userId) {
  const snap = await getDocs(
    query(collection(db, 'users', userId, 'library'), orderBy('lastListened', 'desc'))
  );
  return snap.docs.map(d => ({ bookId: d.id, ...d.data() }));
}

// ══════ BOOKMARKS ══════

export async function saveBookmark(userId, bookId, bookmark) {
  const ref = doc(db, 'users', userId, 'library', bookId);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data().bookmarks || []) : [];
  existing.push({ ...bookmark, createdAt: new Date().getTime() });
  await setDoc(ref, { bookmarks: existing, lastListened: serverTimestamp() }, { merge: true });
  return existing;
}

export async function removeBookmark(userId, bookId, index) {
  const ref = doc(db, 'users', userId, 'library', bookId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const bm = snap.data().bookmarks || [];
  bm.splice(index, 1);
  await updateDoc(ref, { bookmarks: bm });
  return bm;
}

export async function getBookmarks(userId, bookId) {
  const ref = doc(db, 'users', userId, 'library', bookId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return snap.data().bookmarks || [];
}

// ══════ ADMIN ══════

export async function setTTSKey(apiKey) {
  await setDoc(doc(db, 'app_settings', 'tts'), { apiKey });
}

export async function setAnthropicKey(apiKey) {
  await setDoc(doc(db, 'app_settings', 'anthropic'), { apiKey });
}

export async function deleteBook(bookId) {
  const chaps = await getDocs(collection(db, 'books', bookId, 'chapters'));
  for (const ch of chaps.docs) await deleteDoc(ch.ref);
  await deleteDoc(doc(db, 'books', bookId));
}

// ══════ HELPERS ══════

function getRandomColor() {
  const colors = ['#D08C30', '#5B8C5A', '#8B5CF6', '#E74C3C', '#3498DB', '#1ABC9C', '#E67E22', '#9B59B6'];
  return colors[Math.floor(Math.random() * colors.length)];
}
