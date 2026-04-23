// src/services/bookService.js
import { db } from './firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  addDoc, query, orderBy, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import { generateAndUpload } from './tts';

// ══════ BOOK CRUD ══════

// Create a new book from extracted PDF data
export async function createBook({ title, author, blocks, pageCount, userId, voiceName }) {
  // Build chapters from blocks
  const chapters = [];
  let currentChapter = { title: 'Introduction', paragraphs: [], startPage: 1 };

  const readableBlocks = blocks.filter(b => b.type === 'paragraph' || b.type === 'chapter');

  for (const block of readableBlocks) {
    if (block.type === 'chapter') {
      if (currentChapter.paragraphs.length > 0) {
        chapters.push(currentChapter);
      }
      currentChapter = { title: block.text, paragraphs: [], startPage: block.page || 1 };
    } else {
      currentChapter.paragraphs.push({
        text: block.text,
        page: block.page || 1,
        audioUrl: null,
        duration: 0
      });
    }
  }
  if (currentChapter.paragraphs.length > 0) chapters.push(currentChapter);

  // Calculate word count
  const wordCount = chapters.reduce((total, ch) =>
    total + ch.paragraphs.reduce((t, p) => t + p.text.split(/\s+/).length, 0), 0);

  // Create book document
  const bookRef = await addDoc(collection(db, 'books'), {
    title: title || 'Untitled Book',
    author: author || 'Unknown Author',
    uploadedBy: userId,
    createdAt: serverTimestamp(),
    totalChapters: chapters.length,
    totalDuration: 0,
    wordCount,
    pageCount: pageCount || 0,
    voiceName: voiceName || 'en-US-Neural2-D',
    status: 'pending', // pending | generating | complete
    coverColor: getRandomColor()
  });

  // Save chapters as subcollection
  for (let i = 0; i < chapters.length; i++) {
    await setDoc(doc(db, 'books', bookRef.id, 'chapters', `ch_${i}`), {
      title: chapters[i].title,
      index: i,
      paragraphs: chapters[i].paragraphs,
      startPage: chapters[i].startPage,
      totalDuration: 0,
      status: 'pending'
    });
  }

  return bookRef.id;
}

// Generate audio for a specific chapter
export async function generateChapterAudio(bookId, chapterIdx, onProgress) {
  const chRef = doc(db, 'books', bookId, 'chapters', `ch_${chapterIdx}`);
  const chSnap = await getDoc(chRef);
  if (!chSnap.exists()) throw new Error('Chapter not found');

  const chapter = chSnap.data();
  if (chapter.status === 'complete') return chapter; // already done

  // Get book's voice preference
  const bookSnap = await getDoc(doc(db, 'books', bookId));
  const voiceName = bookSnap.data()?.voiceName || 'en-US-Neural2-D';

  const paragraphs = [...chapter.paragraphs];
  let totalDuration = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].audioUrl) {
      // Already generated
      totalDuration += paragraphs[i].duration || 0;
      if (onProgress) onProgress(i + 1, paragraphs.length);
      continue;
    }

    try {
      const result = await generateAndUpload(
        paragraphs[i].text, bookId, chapterIdx, i, voiceName
      );
      paragraphs[i].audioUrl = result.url;
      paragraphs[i].duration = result.duration;
      totalDuration += result.duration;

      // Save progress after each paragraph
      await updateDoc(chRef, { paragraphs, totalDuration });
    } catch (err) {
      console.error(`Error generating p${i}:`, err);
      paragraphs[i].audioUrl = null;
      paragraphs[i].duration = 0;
    }

    if (onProgress) onProgress(i + 1, paragraphs.length);
  }

  // Mark chapter complete
  await updateDoc(chRef, {
    paragraphs,
    totalDuration,
    status: 'complete'
  });

  // Update book total duration
  await updateBookDuration(bookId);

  return { ...chapter, paragraphs, totalDuration, status: 'complete' };
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

// Get all chapters for a book
export async function getChapters(bookId) {
  const snap = await getDocs(
    query(collection(db, 'books', bookId, 'chapters'), orderBy('index'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ══════ USER PROGRESS ══════

// Save user's listening progress
export async function saveProgress(userId, bookId, data) {
  await setDoc(doc(db, 'users', userId, 'library', bookId), {
    ...data,
    lastListened: serverTimestamp()
  }, { merge: true });
}

// Get user's progress for a book
export async function getProgress(userId, bookId) {
  const snap = await getDoc(doc(db, 'users', userId, 'library', bookId));
  return snap.exists() ? snap.data() : null;
}

// Get user's full library (books they've listened to)
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
  existing.push({ ...bookmark, createdAt: Date.now() });
  await setDoc(ref, { bookmarks: existing }, { merge: true });
}

export async function removeBookmark(userId, bookId, index) {
  const ref = doc(db, 'users', userId, 'library', bookId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const bm = snap.data().bookmarks || [];
  bm.splice(index, 1);
  await updateDoc(ref, { bookmarks: bm });
}

// ══════ ADMIN ══════

export async function setTTSKey(apiKey) {
  await setDoc(doc(db, 'app_settings', 'tts'), { apiKey });
}

export async function deleteBook(bookId) {
  // Delete chapters subcollection
  const chaps = await getDocs(collection(db, 'books', bookId, 'chapters'));
  for (const ch of chaps.docs) await deleteDoc(ch.ref);
  await deleteDoc(doc(db, 'books', bookId));
}

// ══════ HELPERS ══════

function getRandomColor() {
  const colors = ['#D08C30', '#5B8C5A', '#8B5CF6', '#E74C3C', '#3498DB', '#1ABC9C', '#E67E22', '#9B59B6'];
  return colors[Math.floor(Math.random() * colors.length)];
}
