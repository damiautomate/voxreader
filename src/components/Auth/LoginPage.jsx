// src/components/Auth/LoginPage.jsx
import { useState } from 'react';
import { Headphones, BookOpen, Mail, Key, LogIn } from 'lucide-react';

export default function LoginPage({ onLoginGoogle, onLoginMemberId, onLoginEmail }) {
  const [tab, setTab] = useState('google'); // google | member | email
  const [memberId, setMemberId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true); setError('');
    try { await onLoginGoogle(); }
    catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleMember = async (e) => {
    e.preventDefault();
    if (!memberId.trim()) return;
    setLoading(true); setError('');
    try { await onLoginMemberId(memberId.trim()); }
    catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true); setError('');
    try { await onLoginEmail(email, password); }
    catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--acl)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Headphones size={30} color="var(--ac)" />
          </div>
          <h1 style={{ fontSize: 26, fontFamily: 'var(--fb)', color: 'var(--ac)', marginBottom: 4 }}>VoxReader</h1>
          <p style={{ fontSize: 13, color: 'var(--t2)' }}>Turn any PDF into an audiobook</p>
        </div>

        {/* Tab selector */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--s)', borderRadius: 10, padding: 3 }}>
          {[['google', 'Google'], ['member', 'Member ID'], ['email', 'Email']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === id ? 'var(--ac)' : 'transparent',
              color: tab === id ? 'var(--bg)' : 'var(--t2)',
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--fu)'
            }}>{label}</button>
          ))}
        </div>

        {/* Google */}
        {tab === 'google' && (
          <button onClick={handleGoogle} disabled={loading} style={{
            width: '100%', padding: 14, borderRadius: 10, border: '1px solid var(--bd)',
            background: 'var(--s)', color: 'var(--t)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 14, fontWeight: 600, fontFamily: 'var(--fu)'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>
        )}

        {/* Member ID */}
        {tab === 'member' && (
          <form onSubmit={handleMember}>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Key size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--t2)' }} />
              <input value={memberId} onChange={e => setMemberId(e.target.value)} placeholder="Enter Member ID"
                style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--s)', color: 'var(--t)', fontSize: 14, fontFamily: 'var(--fu)', outline: 'none' }} />
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: 14, borderRadius: 10, border: 'none',
              background: 'var(--ac)', color: 'var(--bg)', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: 'var(--fu)'
            }}>{loading ? 'Signing in...' : 'Login with Member ID'}</button>
          </form>
        )}

        {/* Email */}
        {tab === 'email' && (
          <form onSubmit={handleEmail}>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--t2)' }} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
                style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--s)', color: 'var(--t)', fontSize: 14, fontFamily: 'var(--fu)', outline: 'none' }} />
            </div>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Key size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--t2)' }} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
                style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--s)', color: 'var(--t)', fontSize: 14, fontFamily: 'var(--fu)', outline: 'none' }} />
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: 14, borderRadius: 10, border: 'none',
              background: 'var(--ac)', color: 'var(--bg)', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: 'var(--fu)'
            }}>{loading ? 'Signing in...' : 'Login'}</button>
          </form>
        )}

        {error && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 10, textAlign: 'center' }}>{error}</p>}
      </div>
    </div>
  );
}
