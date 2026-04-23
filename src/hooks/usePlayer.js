// src/hooks/usePlayer.js
// Centralized audio player state - handles chapter loading, background audio, and media session
import { useState, useRef, useCallback, useEffect } from 'react';
import { generateChapterAudio, getChapters, saveProgress } from '../services/bookService';

export function usePlayer() {
  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }
  const audio = audioRef.current;

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  // Book/chapter/paragraph context
  const [currentBook, setCurrentBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(-1);
  const [currentParaIdx, setCurrentParaIdx] = useState(-1);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0, label: '' });

  // Refs for values that shouldn't trigger re-renders
  const currentBookRef = useRef(null);
  const chaptersRef = useRef([]);
  const currentChapterIdxRef = useRef(-1);
  const currentParaIdxRef = useRef(-1);
  const userIdRef = useRef(null);
  const speedRef = useRef(1);

  // keep refs in sync with state
  useEffect(() => { currentBookRef.current = currentBook; }, [currentBook]);
  useEffect(() => { chaptersRef.current = chapters; }, [chapters]);
  useEffect(() => { currentChapterIdxRef.current = currentChapterIdx; }, [currentChapterIdx]);
  useEffect(() => { currentParaIdxRef.current = currentParaIdx; }, [currentParaIdx]);
  useEffect(() => { speedRef.current = speed; audio.playbackRate = speed; }, [speed]);

  // ── audio event handlers ──
  useEffect(() => {
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = async () => {
      // advance to next paragraph in current chapter
      const ch = chaptersRef.current[currentChapterIdxRef.current];
      if (!ch || !ch.paragraphs) return;
      const nextPara = currentParaIdxRef.current + 1;

      if (nextPara < ch.paragraphs.length && ch.paragraphs[nextPara]?.audioUrl) {
        // play next paragraph in chapter
        setTimeout(() => playParagraph(currentChapterIdxRef.current, nextPara), 250);
      } else {
        // chapter ended - move to next chapter
        const nextCh = currentChapterIdxRef.current + 1;
        if (nextCh < chaptersRef.current.length) {
          setTimeout(() => playChapterIdx(nextCh, 0), 600);
        } else {
          setPlaying(false);
        }
      }
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  // ── media session (lock screen controls) ──
  const updateMediaSession = useCallback(() => {
    if (!('mediaSession' in navigator)) return;
    const book = currentBookRef.current;
    const ch = chaptersRef.current[currentChapterIdxRef.current];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: ch?.title || book?.title || 'VoxReader',
      artist: book?.author || 'VoxReader',
      album: book?.title || ''
    });
    navigator.mediaSession.setActionHandler('play', () => audio.play().catch(() => {}));
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('seekforward', () => skipForward());
    navigator.mediaSession.setActionHandler('seekbackward', () => skipBackward());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousChapter());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNextChapter());
  }, []);

  // ── core play functions ──
  const playParagraph = useCallback((chIdx, paraIdx) => {
    const ch = chaptersRef.current[chIdx];
    if (!ch || !ch.paragraphs || !ch.paragraphs[paraIdx]?.audioUrl) return;

    setCurrentChapterIdx(chIdx);
    setCurrentParaIdx(paraIdx);
    audio.src = ch.paragraphs[paraIdx].audioUrl;
    audio.playbackRate = speedRef.current;
    audio.play().catch(e => console.log('play err:', e));
    updateMediaSession();
  }, [updateMediaSession]);

  // Ensure a chapter is generated, then play it
  const playChapterIdx = useCallback(async (chIdx, startParaIdx = 0) => {
    const book = currentBookRef.current;
    if (!book) return;
    let ch = chaptersRef.current[chIdx];
    if (!ch) return;

    // If chapter not yet generated, generate it
    if (ch.status !== 'complete') {
      setGenerating(true);
      setGenProgress({ done: 0, total: ch.paragraphs?.length || 0, label: ch.title });
      try {
        await generateChapterAudio(book.id, chIdx, (done, total) => {
          setGenProgress({ done, total, label: ch.title });
        });
        // reload chapters from Firestore
        const fresh = await getChapters(book.id);
        setChapters(fresh);
        chaptersRef.current = fresh;
        ch = fresh[chIdx];
      } catch (e) {
        console.error('Chapter generation failed:', e);
        setGenerating(false);
        return;
      }
      setGenerating(false);
    }

    playParagraph(chIdx, startParaIdx);

    // Pre-generate next chapter in background
    if (chIdx + 1 < chaptersRef.current.length &&
        chaptersRef.current[chIdx + 1].status !== 'complete') {
      generateChapterAudio(book.id, chIdx + 1).then(() => {
        getChapters(book.id).then(setChapters);
      }).catch(() => {});
    }
  }, [playParagraph]);

  // ── public controls ──
  const play = useCallback(() => audio.play().catch(() => {}), []);
  const pause = useCallback(() => audio.pause(), []);
  const toggle = useCallback(() => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, []);
  const seekTo = useCallback((time) => { audio.currentTime = time; }, []);
  const skipForward = useCallback(() => {
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
  }, []);
  const skipBackward = useCallback(() => {
    audio.currentTime = Math.max(0, audio.currentTime - 15);
  }, []);

  const playNextChapter = useCallback(() => {
    const next = currentChapterIdxRef.current + 1;
    if (next < chaptersRef.current.length) playChapterIdx(next, 0);
  }, [playChapterIdx]);

  const playPreviousChapter = useCallback(() => {
    const prev = currentChapterIdxRef.current - 1;
    if (prev >= 0) playChapterIdx(prev, 0);
  }, [playChapterIdx]);

  const changeSpeed = useCallback(() => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const idx = speeds.indexOf(speedRef.current);
    const next = speeds[(idx + 1) % speeds.length];
    setSpeed(next);
  }, []);

  // Load a book (call when navigating to a book page)
  const loadBook = useCallback((book, chapters) => {
    setCurrentBook(book);
    setChapters(chapters);
    currentBookRef.current = book;
    chaptersRef.current = chapters;
  }, []);

  const setUserId = useCallback((uid) => { userIdRef.current = uid; }, []);

  // Chapter-based time calculations (Audible-style)
  const chapterElapsed = useCallback(() => {
    const ch = chaptersRef.current[currentChapterIdxRef.current];
    if (!ch || !ch.paragraphs) return 0;
    let total = 0;
    for (let i = 0; i < currentParaIdxRef.current; i++) {
      total += ch.paragraphs[i]?.duration || 0;
    }
    return total + currentTime;
  }, [currentTime]);

  const chapterDuration = chapters[currentChapterIdx]?.totalDuration || 0;

  // Seek within current chapter (not just within current paragraph)
  const seekInChapter = useCallback((targetSec) => {
    const ch = chaptersRef.current[currentChapterIdxRef.current];
    if (!ch || !ch.paragraphs) return;
    let acc = 0;
    for (let i = 0; i < ch.paragraphs.length; i++) {
      const pDur = ch.paragraphs[i]?.duration || 0;
      if (acc + pDur >= targetSec) {
        const offset = targetSec - acc;
        if (i === currentParaIdxRef.current) {
          audio.currentTime = offset;
        } else {
          // switch paragraph
          setCurrentParaIdx(i);
          audio.src = ch.paragraphs[i].audioUrl;
          audio.playbackRate = speedRef.current;
          audio.addEventListener('loadedmetadata', function onLoad() {
            audio.removeEventListener('loadedmetadata', onLoad);
            audio.currentTime = offset;
            audio.play().catch(() => {});
          });
        }
        return;
      }
      acc += pDur;
    }
  }, []);

  // Auto-save progress every 10s
  useEffect(() => {
    if (!userIdRef.current || !currentBookRef.current) return;
    const iv = setInterval(() => {
      const book = currentBookRef.current;
      const ch = chaptersRef.current[currentChapterIdxRef.current];
      if (!book || !ch) return;

      const totalBookDur = chaptersRef.current.reduce((s, c) => s + (c.totalDuration || 0), 0);
      const bookElap = chaptersRef.current
        .slice(0, currentChapterIdxRef.current)
        .reduce((s, c) => s + (c.totalDuration || 0), 0) + chapterElapsed();
      const progress = totalBookDur > 0 ? bookElap / totalBookDur : 0;

      saveProgress(userIdRef.current, book.id, {
        currentChapter: currentChapterIdxRef.current,
        currentPara: currentParaIdxRef.current,
        currentTime: audio.currentTime,
        progress,
        bookTitle: book.title
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(iv);
  }, [playing, chapterElapsed]);

  return {
    // state
    playing, currentTime, duration, speed,
    currentBook, chapters, currentChapterIdx, currentParaIdx,
    generating, genProgress,
    // actions
    loadBook, setUserId,
    playParagraph, playChapterIdx,
    play, pause, toggle,
    seekTo, seekInChapter, skipForward, skipBackward,
    playNextChapter, playPreviousChapter,
    changeSpeed,
    // computed
    chapterElapsed, chapterDuration
  };
}
