// src/hooks/usePlayer.js
// Audio player with true streaming generation:
// - Generate paragraph N → play it immediately
// - In background, generate N+1, N+2, N+3 in parallel (limited concurrency)
// - When current chapter is half done, start pre-generating next chapter

import { useState, useRef, useCallback, useEffect } from 'react';
import { generateParagraphAudio, getChapter, saveProgress } from '../services/bookService';

export function usePlayer() {
  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }
  const audio = audioRef.current;

  // Public state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [currentBook, setCurrentBook] = useState(null);
  const [chapterList, setChapterList] = useState([]); // light list of all chapters
  const [currentChapter, setCurrentChapter] = useState(null); // full chapter (with paragraphs)
  const [currentChapterIdx, setCurrentChapterIdx] = useState(-1);
  const [currentParaIdx, setCurrentParaIdx] = useState(-1);
  const [generationStatus, setGenerationStatus] = useState({ active: false, label: '' });

  // Internal refs (don't trigger re-renders)
  const currentBookRef = useRef(null);
  const chapterListRef = useRef([]);
  const currentChapterRef = useRef(null);
  const currentChapterIdxRef = useRef(-1);
  const currentParaIdxRef = useRef(-1);
  const userIdRef = useRef(null);
  const speedRef = useRef(1);
  const generatingRef = useRef(new Set()); // tracks "ch_X_p_Y" being generated
  const stoppedRef = useRef(false);

  useEffect(() => { currentBookRef.current = currentBook; }, [currentBook]);
  useEffect(() => { chapterListRef.current = chapterList; }, [chapterList]);
  useEffect(() => { currentChapterRef.current = currentChapter; }, [currentChapter]);
  useEffect(() => { currentChapterIdxRef.current = currentChapterIdx; }, [currentChapterIdx]);
  useEffect(() => { currentParaIdxRef.current = currentParaIdx; }, [currentParaIdx]);
  useEffect(() => { speedRef.current = speed; audio.playbackRate = speed; }, [speed, audio]);

  // ── Audio event handlers ──
  useEffect(() => {
    const onTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      // Move to next playable paragraph in current chapter
      const ch = currentChapterRef.current;
      if (!ch) return;
      let next = currentParaIdxRef.current + 1;
      // Skip non-paragraph items (sections)
      while (next < ch.paragraphs.length && ch.paragraphs[next].type !== 'paragraph') {
        next++;
      }
      if (next < ch.paragraphs.length) {
        playParagraphAt(currentChapterIdxRef.current, next);
      } else {
        // Chapter ended → try next chapter
        const nextChIdx = currentChapterIdxRef.current + 1;
        if (nextChIdx < chapterListRef.current.length) {
          setTimeout(() => loadAndPlayChapter(nextChIdx, 0), 600);
        } else {
          setPlaying(false);
        }
      }
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audio]);

  // ── Media Session (lock screen) ──
  const updateMediaSession = useCallback(() => {
    if (!('mediaSession' in navigator)) return;
    const book = currentBookRef.current;
    const ch = currentChapterRef.current;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: ch?.title || book?.title || 'VoxReader',
      artist: book?.author || 'VoxReader',
      album: book?.title || ''
    });
    navigator.mediaSession.setActionHandler('play', () => audio.play().catch(() => {}));
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('seekforward', () => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
    });
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      audio.currentTime = Math.max(0, audio.currentTime - 15);
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousChapter());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNextChapter());
  }, [audio]);

  // ── Generate a single paragraph (cached + dedupe) ──
  const generatePara = useCallback(async (chIdx, paraIdx) => {
    const book = currentBookRef.current;
    if (!book) return null;

    // Dedupe in-flight generations
    const key = `ch${chIdx}_p${paraIdx}`;
    if (generatingRef.current.has(key)) return null;
    generatingRef.current.add(key);

    try {
      const updatedChapter = await generateParagraphAudio(book.id, chIdx, paraIdx);
      // If this is the chapter we're currently viewing, refresh state
      if (chIdx === currentChapterIdxRef.current) {
        setCurrentChapter(updatedChapter);
        currentChapterRef.current = updatedChapter;
      }
      return updatedChapter.paragraphs[paraIdx];
    } catch (err) {
      console.error('Generation failed:', err);
      return null;
    } finally {
      generatingRef.current.delete(key);
    }
  }, []);

  // ── Pre-generate paragraphs ahead in background ──
  const preGenerateAhead = useCallback(async (chIdx, fromParaIdx, count = 4) => {
    const ch = currentChapterRef.current;
    if (!ch || chIdx !== currentChapterIdxRef.current) return;

    const tasks = [];
    let para = fromParaIdx;
    let done = 0;
    while (para < ch.paragraphs.length && done < count) {
      const p = ch.paragraphs[para];
      if (p.type === 'paragraph' && !p.audioUrl) {
        tasks.push(generatePara(chIdx, para));
        done++;
      }
      para++;
    }
    if (tasks.length === 0) return;

    setGenerationStatus({ active: true, label: `Generating chapter audio...` });
    await Promise.all(tasks);
    setGenerationStatus({ active: false, label: '' });

    // If we're past 60% of the current chapter, pre-generate next chapter's first 3 paragraphs
    if (chIdx === currentChapterIdxRef.current) {
      const totalParas = ch.paragraphs.filter(p => p.type === 'paragraph').length;
      const generated = ch.paragraphs.filter(p => p.type === 'paragraph' && p.audioUrl).length;
      if (generated > totalParas * 0.6) {
        const nextChIdx = chIdx + 1;
        if (nextChIdx < chapterListRef.current.length) {
          // Load next chapter and start generating first few paragraphs in background
          getChapter(currentBookRef.current.id, nextChIdx).then(nextCh => {
            if (!nextCh) return;
            for (let i = 0; i < Math.min(3, nextCh.paragraphs.length); i++) {
              if (nextCh.paragraphs[i].type === 'paragraph' && !nextCh.paragraphs[i].audioUrl) {
                generatePara(nextChIdx, i).catch(() => {});
              }
            }
          }).catch(() => {});
        }
      }
    }
  }, [generatePara]);

  // ── Play a specific paragraph ──
  const playParagraphAt = useCallback(async (chIdx, paraIdx) => {
    if (stoppedRef.current) return;
    const book = currentBookRef.current;
    if (!book) return;

    // If we're on a different chapter, load it
    let ch = currentChapterRef.current;
    if (!ch || chIdx !== currentChapterIdxRef.current) {
      ch = await getChapter(book.id, chIdx);
      if (!ch) return;
      setCurrentChapter(ch);
      setCurrentChapterIdx(chIdx);
      currentChapterRef.current = ch;
      currentChapterIdxRef.current = chIdx;
    }

    // Skip past sections to find next paragraph
    while (paraIdx < ch.paragraphs.length && ch.paragraphs[paraIdx].type !== 'paragraph') {
      paraIdx++;
    }
    if (paraIdx >= ch.paragraphs.length) return;

    let para = ch.paragraphs[paraIdx];

    // If audio not ready, generate it first (and a few ahead)
    if (!para.audioUrl) {
      setGenerationStatus({ active: true, label: 'Generating audio...' });
      await generatePara(chIdx, paraIdx);
      setGenerationStatus({ active: false, label: '' });
      // Refresh local copy
      ch = currentChapterRef.current;
      para = ch.paragraphs[paraIdx];
      if (!para?.audioUrl) {
        // Generation failed — skip to next
        if (paraIdx + 1 < ch.paragraphs.length) {
          return playParagraphAt(chIdx, paraIdx + 1);
        }
        return;
      }
    }

    setCurrentParaIdx(paraIdx);
    currentParaIdxRef.current = paraIdx;

    audio.src = para.audioUrl;
    audio.playbackRate = speedRef.current;
    audio.play().catch(e => console.log('autoplay blocked:', e?.message));
    updateMediaSession();

    // Background: pre-generate next 4 paragraphs
    preGenerateAhead(chIdx, paraIdx + 1, 4);
  }, [audio, generatePara, preGenerateAhead, updateMediaSession]);

  // ── Load and play a chapter (handles cross-chapter transitions) ──
  const loadAndPlayChapter = useCallback(async (chIdx, startParaIdx = 0) => {
    const book = currentBookRef.current;
    if (!book) return;
    stoppedRef.current = false;
    const ch = await getChapter(book.id, chIdx);
    if (!ch) return;
    setCurrentChapter(ch);
    setCurrentChapterIdx(chIdx);
    currentChapterRef.current = ch;
    currentChapterIdxRef.current = chIdx;

    // Find first paragraph at or after startParaIdx
    let para = startParaIdx;
    while (para < ch.paragraphs.length && ch.paragraphs[para].type !== 'paragraph') {
      para++;
    }
    if (para >= ch.paragraphs.length) return;

    playParagraphAt(chIdx, para);
  }, [playParagraphAt]);

  // ── Public API ──
  const play = useCallback(() => audio.play().catch(() => {}), [audio]);
  const pause = useCallback(() => audio.pause(), [audio]);
  const toggle = useCallback(() => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, [audio]);

  const skipForward = useCallback(() => {
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
  }, [audio]);
  const skipBackward = useCallback(() => {
    audio.currentTime = Math.max(0, audio.currentTime - 15);
  }, [audio]);

  const playNextChapter = useCallback(() => {
    const next = currentChapterIdxRef.current + 1;
    if (next < chapterListRef.current.length) loadAndPlayChapter(next, 0);
  }, [loadAndPlayChapter]);

  const playPreviousChapter = useCallback(() => {
    const prev = currentChapterIdxRef.current - 1;
    if (prev >= 0) loadAndPlayChapter(prev, 0);
  }, [loadAndPlayChapter]);

  const changeSpeed = useCallback(() => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const idx = speeds.indexOf(speedRef.current);
    setSpeed(speeds[(idx + 1) % speeds.length]);
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    audio.pause();
    setPlaying(false);
  }, [audio]);

  // Load a book and its chapter list
  const loadBook = useCallback((book, chList) => {
    setCurrentBook(book);
    setChapterList(chList);
    currentBookRef.current = book;
    chapterListRef.current = chList;
  }, []);

  const setUserId = useCallback((uid) => { userIdRef.current = uid; }, []);

  // Calculate total elapsed in current chapter (sum of past para durations + current audio time)
  const chapterElapsed = useCallback(() => {
    const ch = currentChapterRef.current;
    if (!ch) return 0;
    let elapsed = 0;
    for (let i = 0; i < ch.paragraphs.length; i++) {
      if (ch.paragraphs[i].type !== 'paragraph') continue;
      if (i === currentParaIdxRef.current) {
        return elapsed + currentTime;
      }
      if (i < currentParaIdxRef.current) {
        elapsed += ch.paragraphs[i].duration || 0;
      }
    }
    return elapsed + currentTime;
  }, [currentTime]);

  // Auto-save progress every 10s
  useEffect(() => {
    if (!userIdRef.current || !currentBookRef.current) return;
    const iv = setInterval(() => {
      const book = currentBookRef.current;
      const ch = currentChapterRef.current;
      if (!book || !ch) return;
      saveProgress(userIdRef.current, book.id, {
        currentChapter: currentChapterIdxRef.current,
        currentPara: currentParaIdxRef.current,
        currentTime: audio.currentTime,
        bookTitle: book.title
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(iv);
  }, [audio, playing]);

  return {
    // state
    playing, currentTime, speed,
    currentBook, chapterList, currentChapter,
    currentChapterIdx, currentParaIdx,
    generationStatus,
    // actions
    loadBook, setUserId,
    loadAndPlayChapter, playParagraphAt,
    play, pause, toggle, stop,
    skipForward, skipBackward,
    playNextChapter, playPreviousChapter,
    changeSpeed,
    // computed
    chapterElapsed
  };
}
