// src/components/BookView/BookPage.jsx
// One-chapter-per-page reader with sticky chapter selector, prev/next nav, bookmarks
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Play, Pause, ChevronDown,
  Bookmark as BookmarkIcon, Loader
} from 'lucide-react';
import { getBook, getChapter, getChapterList, getProgress, saveBookmark, removeBookmark, getBookmarks } from '../../services/bookService';

export default function BookPage({ bookId, user, player, onNavigate }) {
  const [book, setBook] = useState(null);
  const [chList, setChList] = useState([]);
  const [chapter, setChapter] = useState(null); // current chapter being viewed (full)
  const [viewIdx, setViewIdx] = useState(0); // chapter the user is viewing (may differ from playing)
  const [bookmarks, setBookmarks] = useState([]);
  const [loadingBook, setLoadingBook] = useState(true);
  const [loadingCh, setLoadingCh] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const paraRefs = useRef({});

  // Load book + chapter list + progress
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, list, prog, bms] = await Promise.all([
          getBook(bookId),
          getChapterList(bookId),
          user ? getProgress(user.uid, bookId) : null,
          user ? getBookmarks(user.uid, bookId) : []
        ]);
        if (cancelled) return;
        setBook(b);
        setChList(list);
        setBookmarks(bms);
        player.loadBook(b, list);
        player.setUserId(user?.uid);

        // Resume where left off, or start at chapter 0
        const startIdx = prog?.currentChapter ?? 0;
        setViewIdx(startIdx);
      } catch (e) { setError(e.message); }
      if (!cancelled) setLoadingBook(false);
    })();
    return () => { cancelled = true; };
  }, [bookId, user?.uid]);

  // When viewIdx changes, load that chapter's full content (with paragraphs)
  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    (async () => {
      setLoadingCh(true);
      try {
        const ch = await getChapter(bookId, viewIdx);
        if (cancelled) return;
        setChapter(ch);
      } catch (e) { if (!cancelled) setError(e.message); }
      if (!cancelled) setLoadingCh(false);
    })();
    return () => { cancelled = true; };
  }, [bookId, viewIdx, book]);

  // When user is currently listening to this book, sync viewIdx to playing chapter
  useEffect(() => {
    if (!book || player.currentBook?.id !== bookId) return;
    if (player.currentChapterIdx >= 0 && player.currentChapterIdx !== viewIdx) {
      // Use queueMicrotask to defer setState out of the effect's synchronous body
      queueMicrotask(() => setViewIdx(player.currentChapterIdx));
    }
  }, [player.currentChapterIdx, player.currentBook, bookId, book, viewIdx]);

  // When playing this chapter, refresh from player's chapter (which has updated audioUrls)
  useEffect(() => {
    if (player.currentBook?.id !== bookId) return;
    if (player.currentChapterIdx === viewIdx && player.currentChapter) {
      queueMicrotask(() => setChapter(player.currentChapter));
    }
  }, [player.currentChapter, player.currentChapterIdx, player.currentBook, bookId, viewIdx]);

  // Auto-scroll active paragraph
  useEffect(() => {
    if (player.currentBook?.id !== bookId) return;
    if (player.currentChapterIdx !== viewIdx) return;
    if (player.currentParaIdx < 0) return;
    const el = paraRefs.current[player.currentParaIdx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [player.currentParaIdx, player.currentChapterIdx, player.currentBook, bookId, viewIdx]);

  // Play this chapter from a specific paragraph (or start)
  const playFromHere = useCallback(async (paraIdx = 0) => {
    setError('');
    try {
      await player.loadAndPlayChapter(viewIdx, paraIdx);
    } catch (e) { setError(e.message); }
  }, [player, viewIdx]);

  const playParagraph = useCallback((paraIdx) => {
    setError('');
    player.playParagraphAt(viewIdx, paraIdx).catch(e => setError(e.message));
  }, [player, viewIdx]);

  async function toggleBookmark(paraIdx, text) {
    if (!user) return;
    const existingIdx = bookmarks.findIndex(b => b.chapterIdx === viewIdx && b.paragraphIdx === paraIdx);
    if (existingIdx >= 0) {
      const updated = await removeBookmark(user.uid, bookId, existingIdx);
      setBookmarks(updated);
    } else {
      const bm = {
        chapterIdx: viewIdx,
        paragraphIdx: paraIdx,
        chapterTitle: chapter?.title || `Chapter ${viewIdx + 1}`,
        text: text.slice(0, 100)
      };
      const updated = await saveBookmark(user.uid, bookId, bm);
      setBookmarks(updated);
    }
  }

  const isBookmarked = (paraIdx) =>
    bookmarks.some(b => b.chapterIdx === viewIdx && b.paragraphIdx === paraIdx);

  function jumpToChapter(idx) {
    setViewIdx(idx);
    setChapterPickerOpen(false);
  }

  function fmtDur(s) {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    return `${m} min`;
  }

  if (loadingBook) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader size={28} color="var(--ac)" style={{ animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!book) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 40, textAlign: 'center' }}>
      <p style={{ color: 'var(--t2)' }}>Book not found</p>
      <button onClick={() => onNavigate('library')} style={{ marginTop: 12, color: 'var(--ac)', background: 'none', border: 'none', cursor: 'pointer' }}>Back</button>
    </div>
  );

  const isPlayingThisBook = player.currentBook?.id === bookId;
  const isPlayingThisChapter = isPlayingThisBook && player.currentChapterIdx === viewIdx;
  const isFirstChapter = viewIdx === 0;
  const isLastChapter = viewIdx === chList.length - 1;
  const currentChMeta = chList[viewIdx];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: player.currentBook ? 200 : 80 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--gl)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--bd)', padding: '10px 16px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => onNavigate('library')}
            style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--fb)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
            <div style={{ fontSize: 10, color: 'var(--t2)' }}>{book.author}</div>
          </div>
          <button onClick={() => setChapterPickerOpen(!chapterPickerOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--s)', color: 'var(--t)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--fu)' }}>
            <span>Ch {viewIdx + 1}/{chList.length}</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Chapter Picker Dropdown */}
      {chapterPickerOpen && (
        <div style={{ position: 'sticky', top: 47, zIndex: 49, background: 'var(--s)', borderBottom: '1px solid var(--bd)', maxHeight: 360, overflowY: 'auto' }}>
          <div style={{ maxWidth: 700, margin: '0 auto', padding: 8 }}>
            {chList.map((ch, i) => (
              <button key={i} onClick={() => jumpToChapter(i)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                  border: 'none', cursor: 'pointer',
                  background: i === viewIdx ? 'var(--acl)' : 'transparent',
                  marginBottom: 2, color: 'var(--t)', fontFamily: 'var(--fu)',
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: i === viewIdx ? 'var(--ac)' : 'var(--bg)',
                  color: i === viewIdx ? 'var(--bg)' : 'var(--t2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700
                }}>{ch.number || i + 1}</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {ch.part && <div style={{ fontSize: 9, color: 'var(--t2)', textTransform: 'uppercase' }}>{ch.part}</div>}
                  <div style={{ fontSize: 13, fontFamily: 'var(--fb)', color: i === viewIdx ? 'var(--ac)' : 'var(--t)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title}</div>
                  <div style={{ fontSize: 9, color: 'var(--t2)' }}>
                    {ch.paragraphCount} para · {ch.totalDuration > 0 ? fmtDur(ch.totalDuration) : 'not generated'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chapter content */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 18px' }}>
        {/* Part label */}
        {currentChMeta?.part && (
          <div style={{ fontSize: 10, color: 'var(--t2)', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase', textAlign: 'center' }}>
            {currentChMeta.part}
          </div>
        )}

        {/* Chapter heading */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: 'var(--ac)', fontWeight: 600, letterSpacing: 3, marginBottom: 8 }}>
            CHAPTER {currentChMeta?.number || viewIdx + 1}
          </div>
          <h1 style={{ fontSize: 24, fontFamily: 'var(--fb)', color: 'var(--ch)', lineHeight: 1.3, padding: '0 12px' }}>
            {chapter?.title || currentChMeta?.title || ''}
          </h1>
          {/* Chapter play button */}
          <div style={{ marginTop: 16 }}>
            <button onClick={() => isPlayingThisChapter ? player.toggle() : playFromHere(0)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 20, border: 'none',
                background: 'var(--ac)', color: 'var(--bg)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--fu)'
              }}>
              {isPlayingThisChapter && player.playing
                ? (<><Pause size={14} /> Pause</>)
                : (<><Play size={14} /> {isPlayingThisChapter ? 'Resume' : 'Play Chapter'}</>)
              }
            </button>
          </div>
        </div>

        {/* Loading indicator while fetching chapter */}
        {loadingCh && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Loader size={20} color="var(--ac)" style={{ animation: 'spin .8s linear infinite' }} />
          </div>
        )}

        {/* Generation status */}
        {player.generationStatus.active && isPlayingThisChapter && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--acl)', border: '1px solid var(--bd)', marginBottom: 16, fontSize: 11, color: 'var(--ac)', textAlign: 'center' }}>
            ✨ {player.generationStatus.label}
          </div>
        )}

        {/* Paragraphs and sections */}
        {chapter?.paragraphs?.map((p, i) => {
          if (p.type === 'section') {
            return (
              <h2 key={i} style={{
                fontSize: 18, fontFamily: 'var(--fb)', fontWeight: 600,
                color: 'var(--ac)', marginTop: 32, marginBottom: 12,
                paddingBottom: 6, borderBottom: '1px solid var(--bd)'
              }}>
                {p.text}
              </h2>
            );
          }

          // paragraph
          const isActive = isPlayingThisChapter && player.currentParaIdx === i;
          const bookmarked = isBookmarked(i);
          const hasAudio = !!p.audioUrl;

          return (
            <div key={i}
              ref={el => paraRefs.current[i] = el}
              style={{
                position: 'relative',
                padding: '10px 14px 10px 16px',
                margin: '6px 0',
                borderRadius: 8,
                borderLeft: `3px solid ${isActive ? 'var(--ac)' : 'transparent'}`,
                background: isActive ? 'var(--hla)' : 'transparent',
                transition: 'all .25s'
              }}>
              <p
                onClick={() => playParagraph(i)}
                style={{
                  fontSize: 'var(--fs)', lineHeight: 'var(--lh)',
                  fontFamily: 'var(--fb)', margin: 0,
                  cursor: 'pointer'
                }}>
                {p.text}
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <button
                  onClick={() => playParagraph(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--t2)', fontSize: 10, padding: 0
                  }}>
                  <Play size={10} /> Play
                </button>
                <button
                  onClick={() => toggleBookmark(i, p.text)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: bookmarked ? 'var(--ac)' : 'var(--t2)', fontSize: 10, padding: 0
                  }}>
                  <BookmarkIcon size={10} fill={bookmarked ? 'currentColor' : 'none'} />
                  {bookmarked ? 'Bookmarked' : 'Bookmark'}
                </button>
                {hasAudio && (
                  <span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 'auto' }}>♪ ready</span>
                )}
              </div>
            </div>
          );
        })}

        {error && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 16, textAlign: 'center' }}>{error}</p>}

        {/* Prev/Next chapter nav */}
        <div style={{ display: 'flex', gap: 8, marginTop: 40, marginBottom: 20 }}>
          <button onClick={() => !isFirstChapter && setViewIdx(viewIdx - 1)} disabled={isFirstChapter}
            style={{
              flex: 1, padding: '12px 10px', borderRadius: 10,
              border: '1px solid var(--bd)',
              background: isFirstChapter ? 'transparent' : 'var(--s)',
              color: isFirstChapter ? 'var(--t3)' : 'var(--t)',
              cursor: isFirstChapter ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12, fontFamily: 'var(--fu)', fontWeight: 500
            }}>
            <ChevronLeft size={14} /> Previous
          </button>
          <button onClick={() => !isLastChapter && setViewIdx(viewIdx + 1)} disabled={isLastChapter}
            style={{
              flex: 1, padding: '12px 10px', borderRadius: 10,
              border: '1px solid var(--bd)',
              background: isLastChapter ? 'transparent' : 'var(--s)',
              color: isLastChapter ? 'var(--t3)' : 'var(--t)',
              cursor: isLastChapter ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12, fontFamily: 'var(--fu)', fontWeight: 500
            }}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
