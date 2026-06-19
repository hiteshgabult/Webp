import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UploadCloud, ShieldCheck, Sparkles, Download, Image as ImageIcon, X, Zap, Archive, SlidersHorizontal, CheckCircle2, Rocket } from 'lucide-react';
import './styles.css';

const API = '/api/convert';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 2 : 0)} ${sizes[i]}`;
}

function webpName(name) {
  return name.replace(/\.(png|jpe?g)$/i, '.webp');
}

function App() {
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState('lossless');
  const [quality, setQuality] = useState(100);
  const [effort, setEffort] = useState(6);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const totalSize = useMemo(() => files.reduce((a, f) => a + f.size, 0), [files]);

  function addFiles(list) {
    const incoming = Array.from(list || []);
    const valid = incoming.filter(f => ['image/png', 'image/jpeg', 'image/jpg'].includes(f.type));
    const mapped = valid.map(file => ({
      file,
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      preview: URL.createObjectURL(file)
    }));
    setFiles(prev => [...prev, ...mapped].slice(0, 20));
    setMessage(valid.length ? '' : 'Only PNG and JPG images are supported.');
  }

  function removeFile(id) {
    setFiles(prev => {
      const item = prev.find(x => x.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter(x => x.id !== id);
    });
  }

  function clearFiles() {
    files.forEach(x => URL.revokeObjectURL(x.preview));
    setFiles([]);
    setMessage('');
  }

  async function requestConversion(items) {
    const body = new FormData();
    items.forEach(x => body.append('images', x.file));
    body.append('mode', mode);
    body.append('quality', quality);
    body.append('effort', effort);

    const res = await fetch(API, { method: 'POST', body });
    if (!res.ok) throw new Error((await res.json()).error || 'Conversion failed');
    return await res.blob();
  }

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 600);
  }

  async function downloadZip() {
    if (!files.length) return;
    setBusy(true);
    setMessage('Creating high-quality WebP ZIP...');
    try {
      const blob = await requestConversion(files);
      saveBlob(blob, files.length === 1 ? webpName(files[0].file.name) : 'webp-converted-images.zip');
      setMessage('Done. ZIP download started.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadSingle(item) {
    setBusy(true);
    setMessage(`Converting ${item.file.name}...`);
    try {
      const blob = await requestConversion([item]);
      saveBlob(blob, webpName(item.file.name));
      setMessage('Done. Single image download started.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadAllSingles() {
    if (!files.length) return;
    setBusy(true);
    setMessage('Downloading each image separately...');
    try {
      for (const item of files) {
        const blob = await requestConversion([item]);
        saveBlob(blob, webpName(item.file.name));
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      setMessage('Done. Individual downloads started.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  return <main>
    <section className="hero">
      <nav className="nav">
        <div className="brand"><div className="logo"><Sparkles size={18}/></div><span>WebP Converter Pro</span></div>
        <div className="pill"><ShieldCheck size={15}/> Sharp powered conversion</div>
      </nav>

      <div className="heroGrid">
        <div className="copy">
          <div className="eyebrow"><Zap size={15}/> Premium PNG/JPG to WebP</div>
          <h1>Convert images to clean, high-quality WebP.</h1>
          <p>Upload PNG or JPG files, choose lossless or quality mode, then download one image, all images separately, or a single ZIP file.</p>
          <div className="stats">
            <div><b>20</b><span>files per batch</span></div>
            <div><b>25MB</b><span>per image</span></div>
            <div><b>ZIP</b><span>or single download</span></div>
          </div>
        </div>

        <section className="panel">
          <div className={`drop ${drag ? 'active' : ''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files)}} onClick={()=>inputRef.current.click()}>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg" multiple hidden onChange={e=>addFiles(e.target.files)} />
            <div className="uploadIcon"><UploadCloud size={34}/></div>
            <h2>Drop images here</h2>
            <p>PNG and JPG supported</p>
            <button className="secondary" type="button">Choose Images</button>
          </div>

          <div className="settings">
            <div className="settingsHead"><h3><SlidersHorizontal size={17}/> Settings</h3><span>{mode === 'lossless' ? 'Maximum quality' : `Quality ${quality}`}</span></div>
            <div className="toggle">
              <button className={mode==='lossless'?'on':''} onClick={()=>setMode('lossless')} type="button"><CheckCircle2 size={15}/> Lossless</button>
              <button className={mode==='quality'?'on':''} onClick={()=>setMode('quality')} type="button">Quality WebP</button>
            </div>
            <label className={mode==='lossless' ? 'disabledLabel' : ''}>Quality <b>{quality}</b><input type="range" min="1" max="100" value={quality} onChange={e=>setQuality(e.target.value)} disabled={mode==='lossless'} /></label>
            <label>Compression effort <b>{effort}</b><input type="range" min="0" max="6" value={effort} onChange={e=>setEffort(e.target.value)} /></label>
          </div>

          <div className="filebar"><span>{files.length} selected</span><span>{formatBytes(totalSize)}</span></div>
          <div className="list">
            {files.length === 0 && <div className="empty"><ImageIcon size={20}/> No files selected yet.</div>}
            {files.map(x => <div className="file" key={x.id}>
              <img src={x.preview} alt="preview"/>
              <div className="fileMeta"><b title={x.file.name}>{x.file.name}</b><span>{formatBytes(x.file.size)}</span></div>
              <button className="miniAction" onClick={()=>downloadSingle(x)} disabled={busy} title="Download this image"><Download size={15}/></button>
              <button className="remove" onClick={()=>removeFile(x.id)} disabled={busy} title="Remove"><X size={15}/></button>
            </div>)}
          </div>

          <div className="actions">
            <button className="primary" disabled={!files.length || busy} onClick={downloadZip}><Archive size={17}/> {busy ? 'Working...' : 'Download ZIP'}</button>
            <button className="ghost" disabled={!files.length || busy} onClick={downloadAllSingles}><Download size={17}/> Download Singles</button>
          </div>
          {files.length > 0 && <button className="clear" onClick={clearFiles} disabled={busy}>Clear all</button>}
          {message && <p className="msg">{message}</p>}
        </section>
      </div>
    </section>

    <section className="features">
      <div><Archive/><h3>ZIP Export</h3><p>Batch convert every selected image and download one clean ZIP file.</p></div>
      <div><Download/><h3>Single Downloads</h3><p>Download any selected image directly as WebP without waiting for a ZIP.</p></div>
      <div><ShieldCheck/><h3>Quality First</h3><p>Lossless mode preserves visual quality for premium output.</p></div>
      <div><Rocket/><h3>Deploy Ready</h3><p>Works on GitHub and Render as one production Node service.</p></div>
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
