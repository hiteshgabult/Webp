import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = '/api/convert';
const MAX_FILES = 20;
const MAX_SIZE = 25 * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 2 : 0)} ${units[index]}`;
}

function webpName(name) {
  return name.replace(/\.(png|jpe?g)$/i, '') + '.webp';
}

function makeItem(file) {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    name: file.name,
    size: file.size,
    status: 'ready',
    progress: 0,
    outputUrl: '',
    outputName: webpName(file.name),
    outputSize: 0,
    error: ''
  };
}

function App() {
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState('lossless');
  const [quality, setQuality] = useState(100);
  const [effort, setEffort] = useState(6);
  const [busy, setBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const stats = useMemo(() => {
    const total = items.reduce((sum, item) => sum + item.size, 0);
    const done = items.filter(item => item.status === 'done').length;
    const avg = items.length ? Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length) : 0;
    return { total, done, avg };
  }, [items]);

  function updateItem(id, patch) {
    setItems(previous => previous.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    const accepted = [];
    const rejected = [];

    for (const file of incoming) {
      const isImage = ['image/png', 'image/jpeg', 'image/jpg'].includes(file.type);
      if (!isImage) rejected.push(`${file.name}: only PNG/JPG supported`);
      else if (file.size > MAX_SIZE) rejected.push(`${file.name}: maximum 25MB`);
      else accepted.push(file);
    }

    if (accepted.length) {
      setItems(previous => [...previous, ...accepted.map(makeItem)].slice(0, MAX_FILES));
    }

    if (rejected.length) setNotice(rejected.slice(0, 2).join(' • '));
    else if (incoming.length) setNotice('Images added. Click Convert Images to start.');
  }

  function clearAll() {
    for (const item of items) {
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    }
    setItems([]);
    setNotice('');
  }

  function removeItem(id) {
    const target = items.find(item => item.id === id);
    if (target?.outputUrl) URL.revokeObjectURL(target.outputUrl);
    setItems(previous => previous.filter(item => item.id !== id));
  }

  async function convertOne(item) {
    updateItem(item.id, { status: 'converting', progress: 12, error: '', outputUrl: '', outputSize: 0 });

    const body = new FormData();
    body.append('images', item.file);
    body.append('mode', mode);
    body.append('quality', String(quality));
    body.append('effort', String(effort));

    updateItem(item.id, { progress: 38 });
    const response = await fetch(API, { method: 'POST', body });
    updateItem(item.id, { progress: 78 });

    if (!response.ok) {
      let message = 'Conversion failed';
      try { message = (await response.json()).error || message; } catch (_) {}
      throw new Error(message);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    updateItem(item.id, {
      status: 'done',
      progress: 100,
      outputUrl: url,
      outputName: webpName(item.name),
      outputSize: blob.size
    });
  }

  async function convertImages() {
    if (!items.length || busy) return;
    setBusy(true);
    setNotice('Conversion started. Please wait until all files reach 100%.');

    for (const item of items) {
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      try {
        await convertOne(item);
      } catch (error) {
        updateItem(item.id, { status: 'error', progress: 0, error: error.message || 'Conversion failed' });
      }
    }

    setBusy(false);
    setNotice('Conversion complete. Download single files or export all as ZIP.');
  }

  async function downloadZip() {
    if (!items.length || zipBusy) return;
    setZipBusy(true);
    setNotice('Preparing ZIP file...');

    try {
      const body = new FormData();
      items.forEach(item => body.append('images', item.file));
      body.append('mode', mode);
      body.append('quality', String(quality));
      body.append('effort', String(effort));

      const response = await fetch(API, { method: 'POST', body });
      if (!response.ok) {
        let message = 'ZIP export failed';
        try { message = (await response.json()).error || message; } catch (_) {}
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = items.length === 1 ? webpName(items[0].name) : 'webp-converted-images.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice('ZIP download started.');
    } catch (error) {
      setNotice(error.message || 'ZIP export failed.');
    } finally {
      setZipBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="brand-mark">W</span>
          <span>
            <strong>WebP Converter Pro</strong>
            <small>High quality PNG/JPG to WebP</small>
          </span>
        </button>
        <div className="security-badge">Server-side Sharp Engine</div>
      </header>

      <section className="hero-card">
        <div className="hero-copy">
          <span className="mini-label">Professional image converter</span>
          <h1>Convert PNG & JPG images to premium WebP.</h1>
          <p>Full-width clean interface, upload queue, per-file progress, single-image downloads, and one-click ZIP export.</p>
          <div className="hero-stats">
            <div><strong>20</strong><span>files per batch</span></div>
            <div><strong>25MB</strong><span>per image</span></div>
            <div><strong>{stats.done}/{items.length}</strong><span>converted</span></div>
          </div>
        </div>
      </section>

      <section className="workspace">
        <div
          className={`upload-zone ${dragging ? 'is-dragging' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
        >
          <input ref={inputRef} type="file" accept="image/png,image/jpeg" multiple hidden onChange={(event) => addFiles(event.target.files)} />
          <div className="upload-symbol">+</div>
          <div>
            <h2>Upload images</h2>
            <p>Drag & drop PNG/JPG files here or browse from your computer.</p>
          </div>
          <button className="button button-light" type="button" onClick={() => inputRef.current?.click()}>Choose Images</button>
        </div>

        <div className="settings-grid">
          <div className="setting-card">
            <div className="setting-title">Conversion Mode</div>
            <div className="segmented">
              <button type="button" className={mode === 'lossless' ? 'active' : ''} onClick={() => setMode('lossless')}>Lossless</button>
              <button type="button" className={mode === 'quality' ? 'active' : ''} onClick={() => setMode('quality')}>Quality WebP</button>
            </div>
          </div>
          <label className="setting-card range-card">
            <span>Quality <b>{quality}</b></span>
            <input type="range" min="1" max="100" value={quality} disabled={mode === 'lossless'} onChange={(event) => setQuality(Number(event.target.value))} />
          </label>
          <label className="setting-card range-card">
            <span>Compression Effort <b>{effort}</b></span>
            <input type="range" min="0" max="6" value={effort} onChange={(event) => setEffort(Number(event.target.value))} />
          </label>
        </div>

        <div className="queue-card">
          <div className="queue-head">
            <div>
              <h2>Selected Images</h2>
              <p>{items.length} files • {formatBytes(stats.total)}</p>
            </div>
            <div className="queue-actions">
              <button className="button button-muted" type="button" disabled={!items.length || busy} onClick={clearAll}>Clear All</button>
              <button className="button button-primary" type="button" disabled={!items.length || busy} onClick={convertImages}>{busy ? 'Converting...' : 'Convert Images'}</button>
              <button className="button button-dark" type="button" disabled={!items.length || busy || zipBusy} onClick={downloadZip}>{zipBusy ? 'Preparing...' : 'Download ZIP'}</button>
            </div>
          </div>

          <div className="overall-progress" aria-label="overall conversion progress">
            <span style={{ width: `${stats.avg}%` }} />
          </div>
          <div className="overall-text">Overall progress: {stats.avg}%</div>

          {items.length === 0 ? (
            <div className="empty-state">
              <strong>No images selected yet.</strong>
              <span>Upload PNG/JPG files to begin conversion.</span>
            </div>
          ) : (
            <div className="file-list">
              {items.map(item => (
                <article className="file-row" key={item.id}>
                  <div className="file-info">
                    <div className="file-icon">IMG</div>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{formatBytes(item.size)} {item.outputSize ? `→ ${formatBytes(item.outputSize)}` : ''}</span>
                    </div>
                  </div>

                  <div className="file-progress-wrap">
                    <div className="file-progress"><span style={{ width: `${item.progress}%` }} /></div>
                    <small>{item.status === 'ready' ? 'Ready' : item.status === 'converting' ? `Converting ${item.progress}%` : item.status === 'done' ? 'Converted 100%' : item.error}</small>
                  </div>

                  <div className="file-actions">
                    {item.status === 'done' && item.outputUrl ? (
                      <a className="button button-download" href={item.outputUrl} download={item.outputName}>Download</a>
                    ) : (
                      <button className="button button-disabled" type="button" disabled>Download</button>
                    )}
                    <button className="remove-btn" type="button" disabled={busy} onClick={() => removeItem(item.id)}>Remove</button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {notice && <div className="notice">{notice}</div>}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
