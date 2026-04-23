// src/components/Player/PlayerBar.jsx
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw } from 'lucide-react';
import { useRef, useState } from 'react';

export default function PlayerBar({ player, onNavigate }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  if (!player.currentBook) return null;

  const ch = player.chapters[player.currentChapterIdx];
  const elapsed = player.chapterElapsed();
  const total = player.chapterDuration || 1;
  const remain = Math.max(0, total - elapsed);
  const pct = Math.min(100, (elapsed / total) * 100);

  // Book overall progress
  const totalBookDur = player.chapters.reduce((t, c) => t + (c.totalDuration || 0), 0);
  const bookElap = player.chapters
    .slice(0, player.currentChapterIdx)
    .reduce((t, c) => t + (c.totalDuration || 0), 0) + elapsed;
  const bookPct = totalBookDur > 0 ? Math.round(bookElap / totalBookDur * 100) : 0;

  function fmt(s) {
    s = Math.max(0, Math.round(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function seekFromEvent(e) {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const p = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    player.seekInChapter(p * total);
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--gl)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--bd)', boxShadow: '0 -4px 20px var(--sh)',
      padding: '0 14px', paddingBottom: 'max(6px, env(safe-area-inset-bottom))'
    }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        {/* chapter label + book progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0 0', fontSize: 11 }}>
          <span
            onClick={() => onNavigate('book', player.currentBook.id)}
            style={{ color: 'var(--ac)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, cursor: 'pointer' }}
          >
            Ch {player.currentChapterIdx + 1}: {ch?.title || ''}
          </span>
          <span style={{ color: 'var(--t2)', flexShrink: 0, marginLeft: 8 }}>
            {bookPct}% · {fmt(totalBookDur - bookElap)} left
          </span>
        </div>

        {/* scrubber (within current chapter) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0 2px' }}>
          <span style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 500, minWidth: 32, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(elapsed)}
          </span>
          <div
            ref={trackRef}
            onMouseDown={(e) => { setDragging(true); seekFromEvent(e); }}
            onMouseMove={(e) => { if (dragging) seekFromEvent(e); }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            onTouchStart={(e) => { setDragging(true); seekFromEvent(e); }}
            onTouchMove={(e) => { if (dragging) seekFromEvent(e); }}
            onTouchEnd={() => setDragging(false)}
            style={{ flex: 1, position: 'relative', height: 28, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}
          >
            <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'var(--pb)' }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--ac)', position: 'relative', width: `${pct}%`, transition: dragging ? 'none' : 'width .12s' }}>
                <div style={{
                  position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
                  width: 16, height: 16, borderRadius: '50%', background: 'var(--ac)',
                  boxShadow: '0 2px 8px var(--acg)'
                }} />
              </div>
            </div>
          </div>
          <span style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 500, minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            -{fmt(remain)}
          </span>
        </div>

        {/* controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '2px 0 5px' }}>
          <button
            onClick={player.playPreviousChapter}
            disabled={player.currentChapterIdx <= 0}
            style={{
              background: 'none', border: 'none', cursor: player.currentChapterIdx > 0 ? 'pointer' : 'default',
              color: player.currentChapterIdx > 0 ? 'var(--t)' : 'var(--t3)',
              padding: 5, display: 'flex', alignItems: 'center'
            }}>
            <SkipBack size={22} />
          </button>

          <button
            onClick={player.skipBackward}
            style={{ position: 'relative', padding: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t)', display: 'flex', alignItems: 'center' }}>
            <RotateCcw size={26} />
            <span style={{ position: 'absolute', fontSize: 8, fontWeight: 700, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', marginTop: 1 }}>15</span>
          </button>

          <button
            onClick={player.toggle}
            style={{
              width: 54, height: 54, borderRadius: '50%', background: 'var(--ac)',
              border: 'none', cursor: 'pointer', color: 'var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 18px var(--acg)', margin: '0 6px'
            }}>
            {player.playing ? <Pause size={26} /> : <Play size={26} style={{ marginLeft: 3 }} />}
          </button>

          <button
            onClick={player.skipForward}
            style={{ position: 'relative', padding: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t)', display: 'flex', alignItems: 'center' }}>
            <RotateCw size={26} />
            <span style={{ position: 'absolute', fontSize: 8, fontWeight: 700, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', marginTop: 1 }}>15</span>
          </button>

          <button
            onClick={player.playNextChapter}
            disabled={player.currentChapterIdx >= player.chapters.length - 1}
            style={{
              background: 'none', border: 'none',
              cursor: player.currentChapterIdx < player.chapters.length - 1 ? 'pointer' : 'default',
              color: player.currentChapterIdx < player.chapters.length - 1 ? 'var(--t)' : 'var(--t3)',
              padding: 5, display: 'flex', alignItems: 'center'
            }}>
            <SkipForward size={22} />
          </button>

          <button
            onClick={player.changeSpeed}
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
  );
}
