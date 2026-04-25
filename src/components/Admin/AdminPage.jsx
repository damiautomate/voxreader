// src/components/Admin/AdminPage.jsx
import { useState, useEffect } from 'react';
import { ArrowLeft, Key, Trash2, Shield, Volume2, Sparkles } from 'lucide-react';
import { setTTSKey, setAnthropicKey, deleteBook, getLibrary } from '../../services/bookService';
import { testTTSKey, getTTSKey } from '../../services/tts';
import { getAnthropicKey, clearAnthropicKeyCache } from '../../services/pdfProcessor';
import { db } from '../../services/firebase';
import { doc, collection, getDocs, updateDoc } from 'firebase/firestore';

export default function AdminPage({ onNavigate }) {
  const [ttsKey, setTtsKeyVal] = useState('');
  const [anthropicKey, setAnthropicKeyVal] = useState('');
  const [ttsStatus, setTtsStatus] = useState('');
  const [anthropicStatus, setAnthropicStatus] = useState('');
  const [books, setBooks] = useState([]);
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tk, ak, allBooks, usersSnap] = await Promise.all([
          getTTSKey(),
          getAnthropicKey(),
          getLibrary(),
          getDocs(collection(db, 'users'))
        ]);
        if (cancelled) return;
        if (tk) setTtsKeyVal(tk);
        if (ak) setAnthropicKeyVal(ak);
        setBooks(allBooks);
        const adminList = [];
        usersSnap.forEach(d => { const u = d.data(); if (u.role === 'admin') adminList.push({ id: d.id, ...u }); });
        setAdmins(adminList);
      } catch (e) { console.error(e); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function saveTtsKey() {
    if (!ttsKey.trim()) return;
    try { await setTTSKey(ttsKey.trim()); setTtsStatus('saved'); }
    catch (e) { setTtsStatus('error: ' + e.message); }
  }

  async function testTts() {
    setTtsStatus('testing...');
    try {
      const url = await testTTSKey(ttsKey.trim());
      const audio = new Audio(url);
      audio.play().catch(() => {});
      setTtsStatus('✓ Working! Audio playing.');
    } catch (e) { setTtsStatus('✗ ' + e.message); }
  }

  async function saveAnthropic() {
    if (!anthropicKey.trim()) return;
    try {
      await setAnthropicKey(anthropicKey.trim());
      clearAnthropicKeyCache();
      setAnthropicStatus('✓ Saved');
    } catch (e) { setAnthropicStatus('error: ' + e.message); }
  }

  async function handleDeleteBook(id) {
    if (!confirm('Delete this book and all its audio? This cannot be undone.')) return;
    try {
      await deleteBook(id);
      setBooks(books.filter(b => b.id !== id));
    } catch (e) { alert('Error: ' + e.message); }
  }

  async function makeAdmin(email) {
    if (!email) return;
    const usersSnap = await getDocs(collection(db, 'users'));
    let found = false;
    for (const d of usersSnap.docs) {
      if (d.data().email === email) {
        await updateDoc(doc(db, 'users', d.id), { role: 'admin' });
        found = true;
        break;
      }
    }
    if (found) { alert('Admin role granted to ' + email); window.location.reload(); }
    else alert('User not found. They need to sign in first.');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 16px 40px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 16 }}>
        <button onClick={() => onNavigate('library')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--fu)', marginBottom: 20 }}>
          <ArrowLeft size={16} /> Back
        </button>

        <h1 style={{ fontSize: 20, fontFamily: 'var(--fb)', color: 'var(--ac)', marginBottom: 20 }}>Admin Settings</h1>

        {/* Anthropic Key */}
        <div style={{ padding: 14, borderRadius: 10, background: 'var(--s)', border: '1px solid var(--bd)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Sparkles size={16} color="var(--ac)" />
            <h3 style={{ fontSize: 14, fontFamily: 'var(--fb)' }}>Anthropic API Key (PDF cleanup AI)</h3>
          </div>
          <input value={anthropicKey} onChange={e => setAnthropicKeyVal(e.target.value)} placeholder="sk-ant-..."
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--t)', fontSize: 13, fontFamily: 'var(--fu)', outline: 'none', marginBottom: 8 }} />
          <button onClick={saveAnthropic}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--ac)', color: 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--fu)' }}>
            Save Key
          </button>
          {anthropicStatus && <p style={{ fontSize: 11, marginTop: 6, color: anthropicStatus.startsWith('✓') ? '#5cb85c' : 'var(--ac)' }}>{anthropicStatus}</p>}
          <p style={{ fontSize: 10, color: 'var(--t2)', marginTop: 6 }}>
            Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--ac)' }}>console.anthropic.com</a>. Used for PDF text cleanup. ~$0.10–$0.50 per book processed.
          </p>
        </div>

        {/* TTS Key */}
        <div style={{ padding: 14, borderRadius: 10, background: 'var(--s)', border: '1px solid var(--bd)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Key size={16} color="var(--ac)" />
            <h3 style={{ fontSize: 14, fontFamily: 'var(--fb)' }}>Google Cloud TTS API Key (Voice generation)</h3>
          </div>
          <input value={ttsKey} onChange={e => setTtsKeyVal(e.target.value)} placeholder="AIza..."
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--t)', fontSize: 13, fontFamily: 'var(--fu)', outline: 'none', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={saveTtsKey}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--ac)', color: 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--fu)' }}>
              Save
            </button>
            <button onClick={testTts}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--acl)', color: 'var(--ac)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--fu)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Volume2 size={12} /> Test
            </button>
          </div>
          {ttsStatus && <p style={{ fontSize: 11, marginTop: 6, color: ttsStatus.startsWith('✓') ? '#5cb85c' : ttsStatus.startsWith('✗') ? '#e74c3c' : 'var(--ac)' }}>{ttsStatus}</p>}
        </div>

        {/* Admins */}
        <div style={{ padding: 14, borderRadius: 10, background: 'var(--s)', border: '1px solid var(--bd)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Shield size={16} color="var(--ac)" />
            <h3 style={{ fontSize: 14, fontFamily: 'var(--fb)' }}>Admins</h3>
          </div>
          {admins.map(a => (
            <div key={a.id} style={{ fontSize: 12, color: 'var(--t2)', padding: '4px 0' }}>{a.email || a.displayName}</div>
          ))}
          <button onClick={() => {
            const email = prompt('Enter email of user to make admin:');
            if (email) makeAdmin(email);
          }}
            style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--bd)', background: 'var(--acl)', color: 'var(--ac)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--fu)' }}>
            + Add Admin
          </button>
        </div>

        {/* Books */}
        <div style={{ padding: 14, borderRadius: 10, background: 'var(--s)', border: '1px solid var(--bd)' }}>
          <h3 style={{ fontSize: 14, fontFamily: 'var(--fb)', marginBottom: 8 }}>Books ({books.length})</h3>
          {books.length === 0 && <p style={{ fontSize: 12, color: 'var(--t2)' }}>No books yet</p>}
          {books.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{b.title}</div>
                <div style={{ fontSize: 10, color: 'var(--t2)' }}>{b.author} · {b.status} · {b.totalChapters} ch</div>
              </div>
              <button onClick={() => handleDeleteBook(b.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
