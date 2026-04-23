// src/components/Library/LibraryPage.jsx
import { useState, useEffect } from 'react';
import { BookOpen, Upload, Headphones, Clock, Search, LogOut, Settings } from 'lucide-react';
import { getLibrary, getUserLibrary } from '../../services/bookService';

export default function LibraryPage({ user, isAdmin, onLogout, onNavigate }) {
  const [books, setBooks] = useState([]);
  const [userProgress, setUserProgress] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [allBooks, userLib] = await Promise.all([
          getLibrary(),
          user ? getUserLibrary(user.uid) : []
        ]);
        if (cancelled) return;
        setBooks(allBooks);
        const prog = {};
        userLib.forEach(p => { prog[p.bookId] = p; });
        setUserProgress(prog);
      } catch (e) { console.error(e); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const filtered = books.filter(b =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.author?.toLowerCase().includes(search.toLowerCase())
  );

  function fmtDur(sec) {
    if (!sec) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--gl)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--bd)', padding: '10px 16px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Headphones size={20} color="var(--ac)" />
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ac)', fontFamily: 'var(--fb)' }}>VoxReader</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => onNavigate('upload')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--ac)', color: 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--fu)' }}>
              <Upload size={14} /> Upload
            </button>
            {isAdmin && (
              <button onClick={() => onNavigate('admin')} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'var(--acl)', color: 'var(--ac)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Settings size={16} />
              </button>
            )}
            <button onClick={onLogout} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'none', color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 16px' }}>
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--t2)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search library..."
            style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--s)', color: 'var(--t)', fontSize: 14, fontFamily: 'var(--fu)', outline: 'none' }} />
        </div>

        {/* Welcome */}
        {user && (
          <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 16 }}>
            Welcome, <strong style={{ color: 'var(--t)' }}>{user.displayName || user.email}</strong> · {books.length} books in library
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--t2)' }}>
            <div style={{ width: 30, height: 30, border: '3px solid var(--bd)', borderTopColor: 'var(--ac)', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
            Loading library...
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Empty */}
        {!loading && books.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <BookOpen size={40} color="var(--t3)" style={{ marginBottom: 12 }} />
            <h3 style={{ fontSize: 16, marginBottom: 6, fontFamily: 'var(--fb)' }}>No books yet</h3>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 16 }}>Upload a PDF to create your first audiobook</p>
            <button onClick={() => onNavigate('upload')} style={{ padding: '10px 20px', borderRadius: 20, border: 'none', background: 'var(--ac)', color: 'var(--bg)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'var(--fu)' }}>
              <Upload size={14} style={{ marginRight: 6 }} /> Upload PDF
            </button>
          </div>
        )}

        {/* Book Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {filtered.map(book => {
            const prog = userProgress[book.id];
            const pct = prog ? Math.round((prog.progress || 0) * 100) : 0;
            return (
              <button key={book.id} onClick={() => onNavigate('book', book.id)} style={{
                textAlign: 'left', padding: 0, border: '1px solid var(--bd)', borderRadius: 12,
                background: 'var(--s)', cursor: 'pointer', overflow: 'hidden', transition: 'transform .15s'
              }}>
                {/* Cover */}
                <div style={{
                  height: 120, background: book.coverColor || 'var(--ac)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative'
                }}>
                  <BookOpen size={32} color="rgba(255,255,255,0.4)" />
                  {book.status === 'complete' && (
                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 6px', fontSize: 9, color: '#5cb85c', fontWeight: 600 }}>READY</div>
                  )}
                  {book.status === 'generating' && (
                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 6px', fontSize: 9, color: 'var(--ac)', fontWeight: 600 }}>GENERATING</div>
                  )}
                </div>
                {/* Info */}
                <div style={{ padding: '10px 10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--fb)' }}>
                    {book.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 6 }}>{book.author}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t2)' }}>
                    <span>{book.totalChapters} ch</span>
                    <span><Clock size={10} style={{ marginRight: 2 }} />{fmtDur(book.totalDuration)}</span>
                  </div>
                  {pct > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ height: 3, borderRadius: 2, background: 'var(--pb)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: 'var(--ac)', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--ac)', marginTop: 2 }}>{pct}% listened</div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
