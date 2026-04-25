// src/components/Player/PlayerBar.jsx
import { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw, Bookmark as BookmarkIcon, X } from 'lucide-react';
import { getBookmarks, removeBookmark } from '../../services/bookService';

export default function PlayerBar({ player, onNavigate, user }) {
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);

  // Load bookmarks for current book
  useEffect(() => {
    if (!user || !player.currentBook) {
      queueMicrotask(() => setBookmarks([]));
      return;
    }
    let cancelled = false;
    getBookmarks(user.uid, player.currentBook.id)
      .then(bms => { if (!cancelled) setBookmarks(bms); })
      .catch(() => { if (!cancelled) setBookmarks([]); });
    return () => { cancelled = true; };
  }, [user, player.currentBook?.id, bookmarksOpen]);

  if (!player.currentBook) return null;

  const ch = player.currentChapter;
  const elapsed = player.chapterElapsed();
  const total = ch?.totalDuration || 0;
  const remain = Math.max(0, total - elapsed);
  const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;

  function fmt(s) {
    s = Math.max(0, Math.round(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  async function handleRemoveBookmark(idx) {
    if (!user) return;
    const updated = await removeBookmark(user.uid, player.currentBook.id, idx);
    setBookmarks(updated);
  }

  function jumpToBookmark(bm) {
    setBookmarksOpen(false);
    player.playParagraphAt(bm.chapterIdx, bm.paragraphIdx).catch(console.error);
    // Also navigate the BookPage to that chapter
    onNavigate('book', player.currentBook.id);
  }

  return (
    <>
      {/* Bookmarks slide-up drawer */}
      {bookmarksOpen && (
        <>
          <div onClick={() => setBookmarksOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 110,
            background: 'var(--s)', borderTopLeftRadius: 16, borderTopRightRadius: 16,
            maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            paddingBottom: 'env(safe-area-inset-bottom)',
            animation: 'slideUp .25s ease-out'
          }}>
            <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bd)' }}>
              <h3 style={{ fontSize: 14, fontFamily: 'var(--fb)', color: 'var(--ac)' }}>
                <BookmarkIcon size={14} style={{ display: 'inline', marginRight: 6 }} />
                Bookmarks ({bookmarks.length})
              </h3>
              <button onClick={() => setBookmarksOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 12px' }}>
              {bookmarks.length === 0 && (
                <p style={{ textAlign: 'center', padding: 30, fontSize: 12, color: 'var(--t2)' }}>
                  No bookmarks yet. Tap the bookmark icon next to any paragraph in a book.
                </p>
              )}
              {bookmarks.map((bm, i) => (
                <div key={i}
                  style={{
                    padding: '10px 12px', marginBottom: 4, borderRadius: 8,
                    background: 'var(--bg)', border: '1px solid var(--bd)',
                    display: 'flex', gap: 10, alignItems: 'flex-start'
                  }}>
                  <button onClick={() => jumpToBookmark(bm)}
                    style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--t)' }}>
                    <div style={{ fontSize: 10, color: 'var(--ac)', marginBottom: 4, fontWeight: 600 }}>
                      Ch {bm.chapterIdx + 1}: {bm.chapterTitle}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.4, fontFamily: 'var(--fb)' }}>
                      "{bm.text}{bm.text.length >= 100 ? '…' : ''}"
                    </div>
                  </button>
                  <button onClick={() => handleRemoveBookmark(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 4 }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
          </div>
        </>
      )}

      {/* Main player bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--gl)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--bd)', boxShadow: '0 -4px 20px var(--sh)',
        padding: '0 14px', paddingBottom: 'max(6px, env(safe-area-inset-bottom))'
      }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          {/* Top row: chapter title + book badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0 0', fontSize: 11 }}>
            <span
              onClick={() => onNavigate('book', player.currentBook.id)}
              style={{ color: 'var(--ac)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, cursor: 'pointer' }}
            >
              Ch {player.currentChapterIdx + 1}{ch?.title ? ': ' + ch.title : ''}
            </span>
            <button onClick={() => setBookmarksOpen(true)}
              style={{ position: 'relative', background: 'var(--acl)', border: '1px solid var(--bd)', borderRadius: 8, padding: '3px 8px', cursor: 'pointer', color: 'var(--ac)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <BookmarkIcon size={12} fill={bookmarks.length > 0 ? 'currentColor' : 'none'} />
              {bookmarks.length > 0 && (
                <span style={{ fontSize: 9, fontWeight: 700 }}>{bookmarks.length}</span>
              )}
            </button>
          </div>

          {/* Scrubber */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0 2px' }}>
            <span style={{ fontSize: 10, color: 'var(--t2)', minWidth: 32, fontVariantNumeric: 'tabular-nums' }}>{fmt(elapsed)}</span>
            <div style={{ flex: 1, height: 24, display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'var(--pb)' }}>
                <div style={{ height: '100%', borderRadius: 2, background: 'var(--ac)', width: `${pct}%`, transition: 'width .12s' }} />
              </div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--t2)', minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>-{fmt(remain)}</span>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '2px 0 5px' }}>
            <button
              onClick={player.playPreviousChapter}
              disabled={player.currentChapterIdx <= 0}
              style={{
                background: 'none', border: 'none',
                cursor: player.currentChapterIdx > 0 ? 'pointer' : 'default',
                color: player.currentChapterIdx > 0 ? 'var(--t)' : 'var(--t3)',
                padding: 5, display: 'flex', alignItems: 'center'
              }}>
              <SkipBack size={22} />
            </button>

            <button onClick={player.skipBackward}
              style={{ position: 'relative', padding: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t)', display: 'flex', alignItems: 'center' }}>
              <RotateCcw size={26} />
              <span style={{ position: 'absolute', fontSize: 8, fontWeight: 700, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', marginTop: 1 }}>15</span>
            </button>

            <button onClick={player.toggle}
              style={{
                width: 54, height: 54, borderRadius: '50%', background: 'var(--ac)',
                border: 'none', cursor: 'pointer', color: 'var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 18px var(--acg)', margin: '0 6px'
              }}>
              {player.playing ? <Pause size={26} /> : <Play size={26} style={{ marginLeft: 3 }} />}
            </button>

            <button onClick={player.skipForward}
              style={{ position: 'relative', padding: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t)', display: 'flex', alignItems: 'center' }}>
              <RotateCw size={26} />
              <span style={{ position: 'absolute', fontSize: 8, fontWeight: 700, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', marginTop: 1 }}>15</span>
            </button>

            <button onClick={player.playNextChapter}
              disabled={player.currentChapterIdx >= player.chapterList.length - 1}
              style={{
                background: 'none', border: 'none',
                cursor: player.currentChapterIdx < player.chapterList.length - 1 ? 'pointer' : 'default',
                color: player.currentChapterIdx < player.chapterList.length - 1 ? 'var(--t)' : 'var(--t3)',
                padding: 5, display: 'flex', alignItems: 'center'
              }}>
              <SkipForward size={22} />
            </button>

            <button onClick={player.changeSpeed}
              style={{
                background: 'var(--acl)', border: '1px solid var(--bd)', borderRadius: 12,
                padding: '3px 8px', cursor: 'pointer', color: 'var(--ac)',
                fontSize: 11, fontWeight: 700, minWidth: 32, textAlign: 'center',
                fontFamily: 'var(--fu)', marginLeft: 4
              }}>
              {player.speed}x
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
