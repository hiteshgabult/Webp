import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UploadCloud, ShieldCheck, Sparkles, Download, Image as ImageIcon, X, Zap, Archive, SlidersHorizontal, CheckCircle2, Rocket } from 'lucide-react';
import './styles.css';

const API = '/api/convert';
const MAX_FILES = 20;
const MAX_SIZE = 25 * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 2 : 0)} ${sizes[i]}`;
}

function webpName(name) {
  return name.replace(/\.(png|jpe?g)$/i, '') + '.webp';
}

function blobDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function App() {
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState('lossless');
  const [quality, setQuality] = useState(100);
  const [effort, setEffort] = useState(6);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const totalSize = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);
  const convertedCount = useMemo(() => files.filter(item => item.convertedBlob).length, [files]);
  const canDownload = files.length > 0 && convertedCount === files.length && !busy;

  function revokeItem(item) {
    if (item.preview) URL.revokeObjectURL(item.preview);
    if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl);
  }

  function addFiles(list) {
    const incoming = Array.from(list || []);
    const valid = incoming.filter(file => ['image/png', 'image/jpeg', 'image/jpg'].includes(file.type) && file.size <= MAX_SIZE);

    if (!valid.length) {
      setMessage('Only PNG/JPG images up to 25MB are supported.');
      return;
    }

    const mapped = valid.map(file => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      status: 'Ready',
      convertedBlob: null,
      convertedUrl: null,
      convertedSize: null
    }));

    setFiles(prev => [...prev, ...mapped].slice(0, MAX_FILES));
    setProgress(0);
    setMessage('Images selected. Click Convert Images to start.');
  }

  function removeFile(id) {
    setFiles(prev => {
      const found = prev.find(item => item.id === id);
      if (found) revokeItem(found);
      const next = prev.filter(item => item.id !== id);
      if (!next.length) setProgress(0);
      return next;
    });
  }

  function clearFiles() {
    files.forEach(revokeItem);
    setFiles([]);
    setProgress(0);
    setMessage('');
  }

  async function convertOne(item) {
    const body = new FormData();
    body.append('images', item.file);
    body.append('mode', mode);
    body.append('quality', quality);
    body.append('effort', effort);

    const res = await fetch(API, { method: 'POST', body });
    if (!res.ok) {
      let error = 'Conversion failed.';
      try { error = (await res.json()).error || error; } catch {}
      throw new Error(error);
    }
    return await res.blob();
  }

  async function convertAll() {
    if (!files.length || busy) return;
    setBusy(true);
    setProgress(0);
    setMessage('Conversion started...');

    setFiles(prev => prev.map(item => {
      if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl);
      return { ...item, status: 'Waiting', convertedBlob: null, convertedUrl: null, convertedSize: null };
    }));

    try {
      for (let i = 0; i < files.length; i += 1) {
        const current = files[i];
        setFiles(prev => prev.map(item => item.id === current.id ? { ...item, status: 'Converting' } : item));

        const blob = await convertOne(current);
        const convertedUrl = URL.createObjectURL(blob);

        setFiles(prev => prev.map(item => item.id === current.id ? {
          ...item,
          status: 'Done',
          convertedBlob: blob,
          convertedUrl,
          convertedSize: blob.size
        } : item));

        const percent = Math.round(((i + 1) / files.length) * 100);
        setProgress(percent);
        setMessage(`Converted ${i + 1} of ${files.length} images.`);
      }
      setMessage('Conversion complete. Download single files or ZIP.');
    } catch (error) {
      setMessage(error.message || 'Conversion failed.');
      setFiles(prev => prev.map(item => item.status === 'Converting' ? { ...item, status: 'Failed' } : item));
    } finally {
      setBusy(false);
    }
  }

  function downloadSingle(item) {
    if (!item.convertedBlob) return;
    blobDownload(item.convertedBlob, webpName(item.file.name));
  }

  async function downloadZip() {
    if (!files.length || busy) return;
    setBusy(true);
    setMessage('Preparing ZIP download...');
    try {
      const body = new FormData();
      files.forEach(item => body.append('images', item.file));
      body.append('mode', mode);
      body.append('quality', quality);
      body.append('effort', effort);

      const res = await fetch(API, { method: 'POST', body });
      if (!res.ok) throw new Error((await res.json()).error || 'ZIP download failed.');
      const blob = await res.blob();
      blobDownload(blob, files.length === 1 ? webpName(files[0].file.name) : 'webp-converted-images.zip');
      setMessage('ZIP download started.');
    } catch (error) {
      setMessage(error.message || 'ZIP download failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="logo"><Sparkles size={18} /></div>
          <div><strong>WebP Converter Pro</strong><span>High quality PNG/JPG to WebP</span></div>
        </div>
        <div className="security"><ShieldCheck size={16} /> Server-side Sharp Engine</div>
      </header>

      <section className="heroFull">
        <div className="heroText">
          <div className="eyebrow"><Zap size={15} /> Professional image converter</div>
          <h1>Convert PNG & JPG images to premium WebP.</h1>
          <p>Clean full-width interface, progress tracking, single-image downloads, and batch ZIP export.</p>
        </div>
        <div className="heroStats">
          <div><b>{MAX_FILES}</b><span>files/batch</span></div>
          <div><b>25MB</b><span>per image</span></div>
          <div><b>{convertedCount}/{files.length}</b><span>converted</span></div>
        </div>
      </section>

      <section className="workspace">
        <aside className="leftPanel">
          <div
            className={`dropzone ${drag ? 'dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          >
            <input ref={inputRef} type="file" accept="image/png,image/jpeg" multiple hidden onChange={e => addFiles(e.target.files)} />
            <div className="uploadBadge"><UploadCloud size={34} /></div>
            <h2>Upload images</h2>
            <p>Drag & drop PNG/JPG files here or browse from your computer.</p>
            <button className="chooseBtn" type="button" onClick={() => inputRef.current?.click()}>Choose Images</button>
          </div>

          <div className="settingsCard">
            <div className="cardTitle"><SlidersHorizontal size={18} /><strong>Conversion Settings</strong></div>
            <div className="modeGrid">
              <button className={mode === 'lossless' ? 'active' : ''} onClick={() => setMode('lossless')} type="button"><CheckCircle2 size={15} /> Lossless</button>
              <button className={mode === 'quality' ? 'active' : ''} onClick={() => setMode('quality')} type="button">Quality WebP</button>
            </div>
            <label className={mode === 'lossless' ? 'rangeRow muted' : 'rangeRow'}>
              <span>Quality <b>{quality}</b></span>
              <input type="range" min="1" max="100" value={quality} disabled={mode === 'lossless'} onChange={e => setQuality(e.target.value)} />
            </label>
            <label className="rangeRow">
              <span>Compression effort <b>{effort}</b></span>
              <input type="range" min="0" max="6" value={effort} onChange={e => setEffort(e.target.value)} />
            </label>
          </div>
        </aside>

        <section className="rightPanel">
          <div className="toolbar">
            <div>
              <h2>Selected Images</h2>
              <p>{files.length} files • {formatBytes(totalSize)}</p>
            </div>
            <button className="clearBtn" disabled={!files.length || busy} onClick={clearFiles}>Clear All</button>
          </div>

          <div className="progressCard">
            <div className="progressTop"><span>{busy ? 'Converting...' : convertedCount === files.length && files.length ? 'Ready to download' : 'Waiting for conversion'}</span><b>{progress}%</b></div>
            <div className="progressTrack"><div style={{ width: `${progress}%` }} /></div>
            {message && <p>{message}</p>}
          </div>

          <div className="actionBar">
            <button className="convertBtn" disabled={!files.length || busy} onClick={convertAll}><Zap size={18} /> {busy ? 'Converting...' : 'Convert Images'}</button>
            <button className="zipBtn" disabled={!files.length || busy} onClick={downloadZip}><Archive size={18} /> Download ZIP</button>
          </div>

          <div className="fileTable">
            {!files.length && (
              <div className="emptyState"><ImageIcon size={28} /><h3>No images selected</h3><p>Upload images to start WebP conversion.</p></div>
            )}
            {files.map(item => (
              <article className="fileRow" key={item.id}>
                <img src={item.preview} alt="preview" />
                <div className="fileInfo">
                  <strong title={item.file.name}>{item.file.name}</strong>
                  <span>{formatBytes(item.file.size)} {item.convertedSize ? `→ ${formatBytes(item.convertedSize)}` : ''}</span>
                </div>
                <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>
                <button className="singleBtn" disabled={!item.convertedBlob || busy} onClick={() => downloadSingle(item)}><Download size={16} /> Download</button>
                <button className="removeBtn" disabled={busy} onClick={() => removeFile(item.id)}><X size={16} /></button>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="featureStrip">
        <div><Archive size={20} /><b>ZIP Export</b><span>All files in one download</span></div>
        <div><Download size={20} /><b>Single Download</b><span>Download any converted file</span></div>
        <div><ShieldCheck size={20} /><b>Quality First</b><span>Lossless mode available</span></div>
        <div><Rocket size={20} /><b>Render Ready</b><span>Deploy from GitHub</span></div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
