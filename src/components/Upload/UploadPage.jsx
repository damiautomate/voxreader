// src/components/Upload/UploadPage.jsx
import { useState, useRef } from 'react';
import { ArrowLeft, Upload, BookOpen, Loader } from 'lucide-react';
import { extractPDF } from '../../services/pdfExtract';
import { createBook } from '../../services/bookService';

export default function UploadPage({ user, onNavigate }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [step, setStep] = useState('upload'); // upload | extracting | review | saving
  const [blocks, setBlocks] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef();

  async function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setTitle(f.name.replace('.pdf', '').replace(/[_-]/g, ' '));
    setStep('extracting');
    setError('');

    try {
      const result = await extractPDF(f);
      setBlocks(result.blocks);
      setPageCount(result.pageCount);
      setStep('review');
    } catch (e) {
      setError('Could not read this PDF: ' + e.message);
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
        blocks,
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

  const chapters = blocks.filter(b => b.type === 'chapter');
  const paragraphs = blocks.filter(b => b.type === 'paragraph');
  const words = paragraphs.reduce((t, p) => t + p.text.split(/\s+/).length, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 16px 40px' }}>
      {/* Header */}
      <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 16 }}>
        <button onClick={() => onNavigate('library')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--fu)', marginBottom: 20 }}>
          <ArrowLeft size={16} /> Back to Library
        </button>

        <h1 style={{ fontSize: 22, fontFamily: 'var(--fb)', color: 'var(--ac)', marginBottom: 6 }}>Upload PDF</h1>
        <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 24 }}>Upload a PDF book and we'll turn it into an audiobook</p>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div style={{ textAlign: 'center', padding: '40px 20px', border: '2px dashed var(--bd)', borderRadius: 16, cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}>
            <Upload size={36} color="var(--t2)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Tap to select PDF</p>
            <p style={{ fontSize: 12, color: 'var(--t2)' }}>Max recommended: 500 pages</p>
            <input ref={fileRef} type="file" accept=".pdf" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        )}

        {/* Step: Extracting */}
        {step === 'extracting' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Loader size={32} color="var(--ac)" style={{ animation: 'spin .8s linear infinite', marginBottom: 12 }} />
            <p style={{ fontSize: 14 }}>Extracting text from {file?.name}...</p>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>This may take a moment for large PDFs</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {/* Book cover preview */}
              <div style={{ width: 80, height: 110, borderRadius: 8, background: 'var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookOpen size={28} color="rgba(255,255,255,0.4)" />
              </div>
              <div style={{ flex: 1 }}>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Book Title"
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--s)', color: 'var(--t)', fontSize: 15, fontWeight: 600, fontFamily: 'var(--fb)', outline: 'none', marginBottom: 6 }} />
                <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author"
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--s)', color: 'var(--t)', fontSize: 13, fontFamily: 'var(--fu)', outline: 'none' }} />
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                `${pageCount} pages`,
                `${chapters.length || 1} chapters`,
                `${paragraphs.length} paragraphs`,
                `~${Math.ceil(words / 150)} min listen`
              ].map((s, i) => (
                <span key={i} style={{ padding: '4px 10px', borderRadius: 12, background: 'var(--acl)', fontSize: 11, color: 'var(--ac)', fontWeight: 500 }}>{s}</span>
              ))}
            </div>

            {/* Chapter preview */}
            {chapters.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>Detected Chapters:</h3>
                {chapters.slice(0, 10).map((ch, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--bd)', fontSize: 13, color: 'var(--t)' }}>{ch.text}</div>
                ))}
                {chapters.length > 10 && <p style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4 }}>...and {chapters.length - 10} more</p>}
              </div>
            )}

            {/* Sample text */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>Sample text:</h3>
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--s)', fontSize: 13, lineHeight: 1.6, color: 'var(--t)', fontFamily: 'var(--fb)', maxHeight: 120, overflow: 'auto' }}>
                {paragraphs[0]?.text || 'No text extracted'}
              </div>
            </div>

            <button onClick={handleCreate} style={{
              width: '100%', padding: 14, borderRadius: 10, border: 'none',
              background: 'var(--ac)', color: 'var(--bg)', cursor: 'pointer',
              fontSize: 15, fontWeight: 600, fontFamily: 'var(--fu)'
            }}>Create Audiobook</button>
          </div>
        )}

        {/* Step: Saving */}
        {step === 'saving' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Loader size={32} color="var(--ac)" style={{ animation: 'spin .8s linear infinite', marginBottom: 12 }} />
            <p style={{ fontSize: 14 }}>Saving book to library...</p>
          </div>
        )}

        {error && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 12, textAlign: 'center' }}>{error}</p>}
      </div>
    </div>
  );
}
