// src/App.jsx
import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { usePlayer } from './hooks/usePlayer';
import LoginPage from './components/Auth/LoginPage';
import LibraryPage from './components/Library/LibraryPage';
import UploadPage from './components/Upload/UploadPage';
import BookPage from './components/BookView/BookPage';
import AdminPage from './components/Admin/AdminPage';
import PlayerBar from './components/Player/PlayerBar';

export default function App() {
  const { user, loading, isAdmin, loginGoogle, loginEmail, loginMemberId, logout } = useAuth();
  const player = usePlayer();
  const [page, setPage] = useState('library');
  const [pageData, setPageData] = useState(null);

  function navigate(target, data) {
    setPage(target);
    setPageData(data || null);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F0F14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#D08C30', fontFamily: "'Literata', serif" }}>VoxReader</div>
        <div style={{ width: 30, height: 30, border: '3px solid rgba(255,255,255,0.05)', borderTopColor: '#D08C30', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginGoogle={loginGoogle} onLoginMemberId={loginMemberId} onLoginEmail={loginEmail} />;
  }

  return (
    <>
      {page === 'library' && <LibraryPage user={user} isAdmin={isAdmin} onLogout={logout} onNavigate={navigate} />}
      {page === 'upload' && <UploadPage user={user} onNavigate={navigate} />}
      {page === 'book' && pageData && <BookPage bookId={pageData} user={user} player={player} onNavigate={navigate} />}
      {page === 'admin' && isAdmin && <AdminPage onNavigate={navigate} />}
      <PlayerBar player={player} user={user} onNavigate={navigate} />
    </>
  );
}
