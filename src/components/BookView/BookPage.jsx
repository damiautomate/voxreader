// src/components/BookView/BookPage.jsx
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Pause, ChevronDown, ChevronUp, Loader, Bookmark as BookmarkIcon } from 'lucide-react';
import { getBook, getChapters, getProgress, saveBookmark, removeBookmark } from '../../services/bookService';

export default function BookPage({ bookId, user, player, onNavigate }) {
  const [book, setBook] = useState(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [showChapters, setShowChapters] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [error, setError] = useState('');
  const paraRefs = useRef({});

  // Load book + progress
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingBook(true);
      try {
        const [b, chs, prog] = await Promise.all([
          getBook(bookId),
          getChapters(bookId),
          user ? getProgress(user.uid, bookId) : null
        ]);
        if (cancelled) return;
        setBook(b);
        player.loadBook(b, chs);
        player.setUserId(user?.uid);
        if (prog?.bookmarks) setBookmarks(prog.bookmarks);
      } catch (e) { setError(e.message); }
      setLoadingBook(false);
    })();
    return () => { cancelled = true; };
  }, [bookId, user?.uid]);

  // Auto-scroll active paragraph
  useEffect(() => {
    if (player.currentBook?.id !== bookId) return;
    if (player.currentChapterIdx < 0 || player.currentParaIdx < 0) return;
    const key = `${player.currentChapterIdx}-${player.currentParaIdx}`;
    const el = paraRefs.current[key];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [player.currentChapterIdx, player.currentParaIdx, bookId, player.currentBook]);

  function playChapter(chIdx) {
    setError('');
    player.playChapterIdx(chIdx, 0).catch(e => setError(e.message));
  }

  function playParagraphIfReady(chIdx, paraIdx) {
    const ch = player.chapters[chIdx];
    if (!ch) return;
    if (ch.status !== 'complete') {
      // generate chapter then start at this paragraph
      player.playChapterIdx(chIdx, paraIdx).catch(e => setError(e.message));
    } else {
      player.playParagraph(chIdx, paraIdx);
    }
  }

  async function toggleBookmark(chIdx, paraIdx, text) {
    if (!user) return;
    const existing = bookmarks.findIndex(b => b.chIdx === chIdx && b.paraIdx === paraIdx);
    if (existing >= 0) {
      await removeBookmark(user.uid, bookId, existing);
      setBookmarks(bookmarks.filter((_, i) => i !== existing));
    } else {
      const timestamp = new Date().getTime();
      const bm = { chIdx, paraIdx, text: text.slice(0, 80), createdAt: timestamp };
      await saveBookmark(user.uid, bookId, bm);
      setBookmarks([...bookmarks, bm]);
    }
  }

  const isBookmarked = (chIdx, paraIdx) =>
    bookmarks.some(b => b.chIdx === chIdx && b.paraIdx === paraIdx);

  function fmtDur(s) {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
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

  const isThisBookPlaying = player.currentBook?.id === bookId;
  const chapters = isThisBookPlaying ? player.chapters : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: player.currentBook ? 200 : 40 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--gl)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--bd)', padding: '10px 16px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => onNavigate('library')} style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--fb)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
            <div style={{ fontSize: 11, color: 'var(--t2)' }}>{book.author}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px' }}>
        {/* Book cover header */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 90, height: 120, borderRadius: 10, flexShrink: 0,
            background: book.coverColor || 'var(--ac)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px var(--sh)'
          }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--fb)', textAlign: 'center', padding: 8 }}>
              {book.title?.slice(0, 20)}
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 style={{ fontSize: 18, fontFamily: 'var(--fb)', marginBottom: 4 }}>{book.title}</h1>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 8 }}>{book.author}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 8px', borderRadius: 10, background: 'var(--acl)', fontSize: 10, color: 'var(--ac)' }}>
                {book.totalChapters} ch
              </span>
              {book.totalDuration > 0 && (
                <span style={{ padding: '3px 8px', borderRadius: 10, background: 'var(--acl)', fontSize: 10, color: 'var(--ac)' }}>
                  {Math.round(book.totalDuration / 60)} min
                </span>
              )}
              <span style={{ padding: '3px 8px', borderRadius: 10, background: book.status === 'complete' ? 'rgba(92,184,92,.1)' : 'var(--acl)', fontSize: 10, color: book.status === 'complete' ? '#5cb85c' : 'var(--ac)' }}>
                {book.status === 'complete' ? 'Ready' : 'Generate on play'}
              </span>
            </div>
          </div>
        </div>

        {/* Play button */}
        {!isThisBookPlaying && chapters.length === 0 && (
          <button onClick={() => playChapter(0)} style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
            background: 'var(--ac)', color: 'var(--bg)', cursor: 'pointer',
            fontSize: 15, fontWeight: 600, fontFamily: 'var(--fu)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginBottom: 16
          }}>
            <Play size={18} /> Start Listening
          </button>
        )}

        {/* Generation progress */}
        {player.generating && player.currentBook?.id === bookId && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--acl)', border: '1px solid var(--bd)', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>
              <span>Generating: {player.genProgress.label}</span>
              <span>{player.genProgress.total > 0 ? Math.round(player.genProgress.done / player.genProgress.total * 100) : 0}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--pb)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--ac)', width: player.genProgress.total > 0 ? `${player.genProgress.done / player.genProgress.total * 100}%` : '0%', transition: 'width .3s' }} />
            </div>
          </div>
        )}

        {/* Chapter list toggle */}
        {isThisBookPlaying && chapters.length > 0 && (
          <>
            <button onClick={() => setShowChapters(!showChapters)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', borderRadius: 10, border: '1px solid var(--bd)',
              background: 'var(--s)', cursor: 'pointer', color: 'var(--t)',
              marginBottom: 12, fontFamily: 'var(--fu)', fontSize: 13
            }}>
              <span style={{ fontWeight: 600 }}>Chapters ({chapters.length})</span>
              {showChapters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showChapters && (
              <div style={{ marginBottom: 16 }}>
                {chapters.map((ch, i) => {
                  const isCur = player.currentChapterIdx === i;
                  return (
                    <button key={i} onClick={() => playChapter(i)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                      padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: isCur ? 'var(--acl)' : 'transparent', marginBottom: 2,
                      color: 'var(--t)', transition: 'background .15s'
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCur ? 'var(--ac)' : 'var(--s)', flexShrink: 0 }}>
                        {isCur && player.playing
                          ? <Pause size={12} color="var(--bg)" />
                          : <Play size={12} color={isCur ? 'var(--bg)' : 'var(--t2)'} style={{ marginLeft: 2 }} />
                        }
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: isCur ? 600 : 400, color: isCur ? 'var(--ac)' : 'var(--t)', fontFamily: 'var(--fb)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ch.title}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                          {ch.status === 'complete' ? fmtDur(ch.totalDuration) : 'Not generated'} · {ch.paragraphs?.length || 0} para
                        </div>
                      </div>
                      {ch.status !== 'complete' && <span style={{ fontSize: 9, color: 'var(--ac)', background: 'var(--acl)', padding: '2px 6px', borderRadius: 4 }}>GEN</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Text content - all chapters & paragraphs */}
            {chapters.map((ch, chIdx) => (
              <div key={chIdx}>
                <div onClick={() => playChapter(chIdx)} style={{
                  margin: '28px 0 10px', padding: '10px 0',
                  borderBottom: '2px solid var(--ac)',
                  cursor: 'pointer',
                  background: player.currentChapterIdx === chIdx ? 'var(--hla)' : 'transparent',
                  borderRadius: player.currentChapterIdx === chIdx ? 6 : 0,
                  paddingLeft: player.currentChapterIdx === chIdx ? 10 : 0
                }}>
                  <h2 style={{ fontSize: 'calc(var(--fs) + 4px)', fontWeight: 600, fontFamily: 'var(--fb)', color: 'var(--ch)' }}>
                    {ch.title}
                  </h2>
                </div>

                {ch.paragraphs?.map((para, pIdx) => {
                  const isActive = player.currentChapterIdx === chIdx && player.currentParaIdx === pIdx;
                  const bm = isBookmarked(chIdx, pIdx);
                  return (
                    <div key={pIdx}
                      ref={el => paraRefs.current[`${chIdx}-${pIdx}`] = el}
                      onClick={() => playParagraphIfReady(chIdx, pIdx)}
                      style={{
                        position: 'relative',
                        padding: '8px 12px 8px 14px', margin: '2px 0', borderRadius: 6,
                        borderLeft: `3px solid ${isActive ? 'var(--ac)' : 'transparent'}`,
                        background: isActive ? 'var(--hla)' : 'transparent',
                        cursor: 'pointer', transition: 'all .25s',
                        boxShadow: isActive ? '0 2px 8px var(--sh)' : 'none'
                      }}>
                      <p style={{ fontSize: 'var(--fs)', lineHeight: 'var(--lh)', fontFamily: 'var(--fb)', margin: 0 }}>
                        {para.text}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBookmark(chIdx, pIdx, para.text); }}
                        style={{
                          position: 'absolute', top: 6, right: 4,
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 4, color: bm ? 'var(--ac)' : 'var(--t3)',
                          opacity: bm ? 1 : 0.3
                        }}>
                        <BookmarkIcon size={14} fill={bm ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}

        {error && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 16, textAlign: 'center' }}>{error}</p>}
      </div>
    </div>
  );
}
