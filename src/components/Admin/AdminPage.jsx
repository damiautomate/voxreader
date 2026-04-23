// src/components/Admin/AdminPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Key, Trash2, Shield, Volume2 } from 'lucide-react';
import { setTTSKey, deleteBook, getLibrary } from '../../services/bookService';
import { testTTSKey, getTTSKey } from '../../services/tts';
import { db } from '../../services/firebase';
import { doc, collection, getDocs, updateDoc } from 'firebase/firestore';

export default function AdminPage({ onNavigate }) {
  const [apiKey, setApiKey] = useState('');
  const [keyStatus, setKeyStatus] = useState('');
  const [books, setBooks] = useState([]);
  const [admins, setAdmins] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const currentKey = await getTTSKey();
      if (currentKey) setApiKey(currentKey);
      const allBooks = await getLibrary();
      setBooks(allBooks);
      const usersSnap = await getDocs(collection(db, 'users'));
      const adminList = [];
      usersSnap.forEach(d => { const u = d.data(); if (u.role === 'admin') adminList.push({ id: d.id, ...u }); });
      setAdmins(adminList);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const currentKey = await getTTSKey();
        if (cancelled) return;
        if (currentKey) setApiKey(currentKey);
        const allBooks = await getLibrary();
        if (cancelled) return;
        setBooks(allBooks);
        const usersSnap = await getDocs(collection(db, 'users'));
        if (cancelled) return;
        const adminList = [];
        usersSnap.forEach(d => { const u = d.data(); if (u.role === 'admin') adminList.push({ id: d.id, ...u }); });
        setAdmins(adminList);
      } catch (e) { console.error(e); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function saveKey() {
    if (!apiKey.trim()) return;
    try {
      await setTTSKey(apiKey.trim());
      setKeyStatus('saved');
    } catch (e) { setKeyStatus('error: ' + e.message); }
  }

  async function testKey() {
    setKeyStatus('testing...');
    try {
      const url = await testTTSKey(apiKey.trim());
      const audio = new Audio(url);
      audio.play().catch(() => {});
      setKeyStatus('✓ Working! Audio playing.');
    } catch (e) { setKeyStatus('✗ ' + e.message); }
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
    if (found) { alert('Admin role granted to ' + email); loadData(); }
    else alert('User not found. They need to sign in first.');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 16px 40px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 16 }}>
        <button onClick={() => onNavigate('library')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--fu)', marginBottom: 20 }}>
          <ArrowLeft size={16} /> Back
        </button>

        <h1 style={{ fontSize: 20, fontFamily: 'var(--fb)', color: 'var(--ac)', marginBottom: 20 }}>Admin Settings</h1>

        {/* TTS Key */}
        <div style={{ padding: 14, borderRadius: 10, background: 'var(--s)', border: '1px solid var(--bd)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Key size={16} color="var(--ac)" />
            <h3 style={{ fontSize: 14, fontFamily: 'var(--fb)' }}>Google Cloud TTS API Key</h3>
          </div>
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIza..."
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--t)', fontSize: 13, fontFamily: 'var(--fu)', outline: 'none', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={saveKey} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--ac)', color: 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--fu)' }}>Save Key</button>
            <button onClick={testKey} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--acl)', color: 'var(--ac)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--fu)' }}>
              <Volume2 size={12} style={{ marginRight: 4 }} /> Test
            </button>
          </div>
          {keyStatus && <p style={{ fontSize: 11, marginTop: 6, color: keyStatus.includes('✓') ? '#5cb85c' : keyStatus.includes('✗') ? '#e74c3c' : 'var(--ac)' }}>{keyStatus}</p>}
          <p style={{ fontSize: 10, color: 'var(--t2)', marginTop: 6 }}>This key is stored in Firestore and used by all users. Keep it restricted to Cloud Text-to-Speech API only.</p>
        </div>

        {/* Admin management */}
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
          }} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--bd)', background: 'var(--acl)', color: 'var(--ac)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--fu)' }}>
            + Add Admin
          </button>
        </div>

        {/* Book management */}
        <div style={{ padding: 14, borderRadius: 10, background: 'var(--s)', border: '1px solid var(--bd)' }}>
          <h3 style={{ fontSize: 14, fontFamily: 'var(--fb)', marginBottom: 8 }}>Books ({books.length})</h3>
          {books.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{b.title}</div>
                <div style={{ fontSize: 10, color: 'var(--t2)' }}>{b.author} · {b.status}</div>
              </div>
              <button onClick={() => handleDeleteBook(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
