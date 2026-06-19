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
    const valid = Array.from(list).filter(f => ['image/png', 'image/jpeg'].includes(f.type));
    const mapped = valid.slice(0, 20).map(file => ({ file, id: `${file.name}-${file.size}-${crypto.randomUUID()}`, preview: URL.createObjectURL(file) }));
    setFiles(prev => [...prev, ...mapped].slice(0, 20));
    setMessage(valid.length ? '' : 'Only PNG and JPG files are supported.');
  }

  function removeFile(id) {
    setFiles(prev => prev.filter(x => x.id !== id));
  }

  async function convert() {
    if (!files.length) return;
    setBusy(true); setMessage('Converting images with high-quality WebP settings...');
    try {
      const body = new FormData();
      files.forEach(x => body.append('images', x.file));
      body.append('mode', mode);
      body.append('quality', quality);
      body.append('effort', effort);
      const res = await fetch(API, { method: 'POST', body });
      if (!res.ok) throw new Error((await res.json()).error || 'Conversion failed');
      const blob = await res.blob();
      const single = files.length === 1;
      const name = single ? files[0].file.name.replace(/\.(png|jpe?g)$/i, '.webp') : 'webp-converted-images.zip';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setMessage('Done. Download started automatically.');
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  return <main>
    <section className="hero">
      <nav className="nav"><div className="brand"><div className="logo"><Sparkles size={20}/></div><span>WebP Converter Pro</span></div><div className="pill"><ShieldCheck size={16}/> Server-side Sharp Engine</div></nav>
      <div className="heroGrid">
        <div className="copy">
          <div className="eyebrow"><Zap size={16}/> Premium PNG & JPG to WebP converter</div>
          <h1>Convert images to crisp WebP without visual quality compromise.</h1>
          <p>Batch upload, lossless WebP, quality 100 mode, ZIP export and a professional responsive UI ready for GitHub and Render deployment.</p>
          <div className="stats"><div><b>20</b><span>files/batch</span></div><div><b>25MB</b><span>per image</span></div><div><b>100%</b><span>quality option</span></div></div>
        </div>
        <section className="panel">
          <div className={`drop ${drag ? 'active' : ''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files)}} onClick={()=>inputRef.current.click()}>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg" multiple hidden onChange={e=>addFiles(e.target.files)} />
            <div className="uploadIcon"><UploadCloud size={42}/></div>
            <h2>Drop PNG/JPG images here</h2>
            <p>or click to browse files</p>
            <button className="secondary">Choose Images</button>
          </div>

          <div className="settings">
            <h3><SlidersHorizontal size={18}/> Conversion Settings</h3>
            <div className="toggle">
              <button className={mode==='lossless'?'on':''} onClick={()=>setMode('lossless')}><CheckCircle2 size={16}/> Lossless</button>
              <button className={mode==='quality'?'on':''} onClick={()=>setMode('quality')}>Quality WebP</button>
            </div>
            <label>Quality: <b>{quality}</b><input type="range" min="1" max="100" value={quality} onChange={e=>setQuality(e.target.value)} disabled={mode==='lossless'} /></label>
            <label>Compression effort: <b>{effort}</b><input type="range" min="0" max="6" value={effort} onChange={e=>setEffort(e.target.value)} /></label>
          </div>

          <div className="filebar"><span>{files.length} selected</span><span>{formatBytes(totalSize)} total</span></div>
          <div className="list">
            {files.length === 0 && <div className="empty"><ImageIcon/> No files selected yet.</div>}
            {files.map(x => <div className="file" key={x.id}><img src={x.preview}/><div><b>{x.file.name}</b><span>{formatBytes(x.file.size)}</span></div><button onClick={()=>removeFile(x.id)}><X size={16}/></button></div>)}
          </div>
          <button className="primary" disabled={!files.length || busy} onClick={convert}>{busy ? 'Converting...' : <><Download size={18}/> Convert & Download {files.length>1?'ZIP':''}</>}</button>
          {message && <p className="msg">{message}</p>}
        </section>
      </div>
    </section>
    <section className="features">
      <div><Archive/><h3>Batch ZIP Export</h3><p>Multiple files are converted and delivered in one clean ZIP.</p></div>
      <div><ShieldCheck/><h3>Quality First</h3><p>Lossless WebP preserves visual output for premium results.</p></div>
      <div><Rocket/><h3>Render Ready</h3><p>Single Node service serves API and React production build.</p></div>
      <div><Rocket/><h3>GitHub Ready</h3><p>Upload the whole root folder to your repository and deploy.</p></div>
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
