// src/components/Upload/UploadPage.jsx
import { useState, useRef } from 'react';
import { ArrowLeft, Upload, Loader, Sparkles, BookOpen } from 'lucide-react';
import { processPDF } from '../../services/pdfProcessor';
import { createBook } from '../../services/bookService';

export default function UploadPage({ user, onNavigate }) {
  const [, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [step, setStep] = useState('upload'); // upload | processing | review | saving
  const [chapters, setChapters] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef();

  async function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setTitle(f.name.replace('.pdf', '').replace(/[_-]/g, ' '));
    setStep('processing');
    setError('');
    setProgressMsg('Reading PDF...');

    try {
      const result = await processPDF(f, ({ message }) => setProgressMsg(message));
      setChapters(result.chapters);
      setPageCount(result.pageCount);
      setStep('review');
    } catch (e) {
      setError(e.message);
      setStep('upload');
    }
  }

  async function handleCreate() {
    if (!title.trim()) { setError('Enter a title'); return; }
    setStep('saving');
    setError('');
    try {
      const bookId = await createBook({
        title: title.trim(),
        author: author.trim() || 'Unknown Author',
        chapters,
        pageCount,
        userId: user.uid,
        voiceName: 'en-US-Neural2-D'
      });
      onNavigate('book', bookId);
    } catch (e) {
      setError('Failed to save: ' + e.message);
      setStep('review');
    }
  }

  const totalParagraphs = chapters.reduce((t, ch) =>
    t + ch.paragraphs.filter(p => p.type === 'paragraph').length, 0);
  const wordCount = chapters.reduce((t, ch) =>
    t + ch.paragraphs.filter(p => p.type === 'paragraph').reduce((s, p) => s + p.text.split(/\s+/).length, 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 16px 40px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 16 }}>
        <button onClick={() => onNavigate('library')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--fu)', marginBottom: 20 }}>
          <ArrowLeft size={16} /> Back to Library
        </button>

        <h1 style={{ fontSize: 22, fontFamily: 'var(--fb)', color: 'var(--ac)', marginBottom: 6 }}>Upload PDF</h1>
        <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 24 }}>
          AI cleans the text, identifies chapters, and removes junk. Then we'll convert to audio.
        </p>

        {step === 'upload' && (
          <div onClick={() => fileRef.current?.click()}
            style={{ textAlign: 'center', padding: '40px 20px', border: '2px dashed var(--bd)', borderRadius: 16, cursor: 'pointer' }}>
            <Upload size={36} color="var(--t2)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Tap to select PDF</p>
            <p style={{ fontSize: 12, color: 'var(--t2)' }}>Books up to ~500 pages work best</p>
            <input ref={fileRef} type="file" accept=".pdf" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        )}

        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto 16px' }}>
              <Sparkles size={36} color="var(--ac)" style={{ position: 'absolute', top: 12, left: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <Loader size={60} color="var(--ac)" style={{ animation: 'spin 1.2s linear infinite', opacity: 0.4 }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{progressMsg}</p>
            <p style={{ fontSize: 12, color: 'var(--t2)' }}>This can take 1–3 minutes for large books</p>
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
              @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
            `}</style>
          </div>
        )}

        {step === 'review' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 90, height: 120, borderRadius: 10, background: 'var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookOpen size={32} color="rgba(255,255,255,0.4)" />
              </div>
              <div style={{ flex: 1 }}>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Book Title"
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--s)', color: 'var(--t)', fontSize: 15, fontWeight: 600, fontFamily: 'var(--fb)', outline: 'none', marginBottom: 6 }} />
                <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author"
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--s)', color: 'var(--t)', fontSize: 13, fontFamily: 'var(--fu)', outline: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                `${pageCount} pages`,
                `${chapters.length} chapters`,
                `${totalParagraphs} paragraphs`,
                `~${Math.ceil(wordCount / 150)} min listen`
              ].map((s, i) => (
                <span key={i} style={{ padding: '4px 10px', borderRadius: 12, background: 'var(--acl)', fontSize: 11, color: 'var(--ac)', fontWeight: 500 }}>{s}</span>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>AI-detected chapters:</h3>
              <div style={{ maxHeight: 240, overflowY: 'auto', padding: '4px 0' }}>
                {chapters.slice(0, 30).map((ch, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--bd)', fontSize: 13, color: 'var(--t)' }}>
                    {ch.part && <span style={{ fontSize: 10, color: 'var(--t2)', textTransform: 'uppercase', display: 'block' }}>{ch.part}</span>}
                    <span style={{ color: 'var(--ac)', marginRight: 6 }}>{ch.number}.</span>
                    {ch.title}
                  </div>
                ))}
                {chapters.length > 30 && (
                  <p style={{ fontSize: 11, color: 'var(--t2)', marginTop: 6 }}>...and {chapters.length - 30} more</p>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>Sample (first paragraph):</h3>
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--s)', fontSize: 13, lineHeight: 1.6, color: 'var(--t)', fontFamily: 'var(--fb)', maxHeight: 120, overflow: 'auto' }}>
                {chapters[0]?.paragraphs.find(p => p.type === 'paragraph')?.text || 'No text extracted'}
              </div>
            </div>

            <button onClick={handleCreate}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: 'var(--ac)', color: 'var(--bg)', cursor: 'pointer', fontSize: 15, fontWeight: 600, fontFamily: 'var(--fu)' }}>
              Save to Library
            </button>
          </div>
        )}

        {step === 'saving' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Loader size={32} color="var(--ac)" style={{ animation: 'spin .8s linear infinite', marginBottom: 12 }} />
            <p>Saving to library...</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {error && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 12, textAlign: 'center' }}>{error}</p>}
      </div>
    </div>
  );
}
