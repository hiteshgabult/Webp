import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const MAX_FILES = 20;
const MAX_SIZE = 25 * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function makeWebpName(name) {
  return name.replace(/\.[^/.]+$/, "") + ".webp";
}

function App() {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState("lossless");
  const [quality, setQuality] = useState(100);
  const [effort, setEffort] = useState(6);
  const [isConverting, setIsConverting] = useState(false);
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const totalSize = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);
  const convertedCount = files.filter((f) => f.status === "done").length;
  const overallProgress = files.length ? Math.round(files.reduce((sum, item) => sum + item.progress, 0) / files.length) : 0;
  const canConvert = files.length > 0 && !isConverting;
  const canDownloadZip = convertedCount > 0 && !isConverting;

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    const allowed = incoming.filter((file) => {
      const okType = ["image/png", "image/jpeg", "image/jpg"].includes(file.type);
      const okSize = file.size <= MAX_SIZE;
      return okType && okSize;
    });

    if (!allowed.length) {
      setMessage("Please select valid PNG/JPG files up to 25MB each.");
      return;
    }

    setFiles((current) => {
      const room = MAX_FILES - current.length;
      const selected = allowed.slice(0, Math.max(room, 0)).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        status: "ready",
        progress: 0,
        url: "",
        outputName: makeWebpName(file.name),
        outputSize: 0,
        error: "",
      }));
      if (allowed.length > room) setMessage(`Only ${MAX_FILES} files are allowed per batch.`);
      else setMessage(`${selected.length} file(s) added. Click Convert Images to start.`);
      return [...current, ...selected];
    });
  }

  function removeFile(id) {
    setFiles((current) => {
      const item = current.find((file) => file.id === id);
      if (item?.url) URL.revokeObjectURL(item.url);
      return current.filter((file) => file.id !== id);
    });
  }

  function clearAll() {
    files.forEach((item) => item.url && URL.revokeObjectURL(item.url));
    setFiles([]);
    setMessage("");
  }

  function patchFile(id, patch) {
    setFiles((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function convertOne(item) {
    patchFile(item.id, { status: "converting", progress: 12, error: "" });

    const fakeProgress = setInterval(() => {
      setFiles((current) => current.map((row) => {
        if (row.id !== item.id || row.status !== "converting") return row;
        return { ...row, progress: Math.min(row.progress + 7, 88) };
      }));
    }, 180);

    try {
      const formData = new FormData();
      formData.append("images", item.file);
      formData.append("mode", mode);
      formData.append("quality", String(quality));
      formData.append("effort", String(effort));

      const response = await fetch("/api/convert", { method: "POST", body: formData });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Conversion failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      clearInterval(fakeProgress);
      patchFile(item.id, {
        status: "done",
        progress: 100,
        url,
        outputSize: blob.size,
        outputName: response.headers.get("X-Output-Filename") || makeWebpName(item.file.name),
      });
    } catch (error) {
      clearInterval(fakeProgress);
      patchFile(item.id, { status: "error", progress: 0, error: error.message || "Failed" });
    }
  }

  async function convertAll() {
    if (!files.length) return;
    setIsConverting(true);
    setMessage("Conversion started. Please wait until every file reaches 100%.");

    const queue = files.map((item) => ({ ...item, status: "ready", progress: 0, url: "", error: "" }));
    setFiles(queue);

    for (const item of queue) {
      await convertOne(item);
    }

    setIsConverting(false);
    setMessage("Conversion complete. Download files individually or export a ZIP.");
  }

  function downloadSingle(item) {
    if (!item.url) return;
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.outputName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadZip() {
    if (!convertedCount) return;
    setMessage("Preparing ZIP download...");
    const formData = new FormData();
    files.filter((item) => item.status === "done").forEach((item) => formData.append("images", item.file));
    formData.append("mode", mode);
    formData.append("quality", String(quality));
    formData.append("effort", String(effort));

    const response = await fetch("/api/convert", { method: "POST", body: formData });
    if (!response.ok) {
      setMessage("ZIP download failed. Please try again.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "webp-converted-images.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage("ZIP download started.");
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <nav className="topbar">
          <div className="brand"><span className="brand-mark">W</span><span>WebP Converter Pro</span></div>
          <div className="engine-badge">Server-side Sharp Engine</div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Professional PNG/JPG to WebP converter</span>
            <h1>Convert images to premium WebP.</h1>
            <p>Clean responsive interface, progress tracking, single-image downloads, and batch ZIP export without visual quality compromise.</p>
            <div className="stats-grid">
              <div><strong>{MAX_FILES}</strong><span>files / batch</span></div>
              <div><strong>25MB</strong><span>per image</span></div>
              <div><strong>{convertedCount}/{files.length}</strong><span>converted</span></div>
            </div>
          </div>

          <div
            className={`upload-panel ${dragOver ? "is-drag" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          >
            <div className="upload-icon">+</div>
            <h2>Upload images</h2>
            <p>Drag and drop PNG/JPG files here or browse from your computer.</p>
            <button className="primary-btn" type="button" onClick={() => inputRef.current?.click()}>Choose Images</button>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </div>
        </div>
      </section>

      <section className="workspace">
        <aside className="settings-card">
          <h3>Conversion Settings</h3>
          <div className="mode-toggle">
            <button className={mode === "lossless" ? "active" : ""} onClick={() => setMode("lossless")}>Lossless</button>
            <button className={mode === "quality" ? "active" : ""} onClick={() => setMode("quality")}>Quality WebP</button>
          </div>
          <label className="range-row"><span>Quality</span><b>{quality}</b><input type="range" min="70" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></label>
          <label className="range-row"><span>Compression Effort</span><b>{effort}</b><input type="range" min="0" max="6" value={effort} onChange={(e) => setEffort(Number(e.target.value))} /></label>
          <div className="tips"><b>Quality first:</b> Use lossless for original-quality preservation, or quality 100 for smaller files with excellent visual output.</div>
        </aside>

        <section className="queue-card">
          <div className="queue-header">
            <div>
              <h3>Selected Images</h3>
              <p>{files.length} files • {formatBytes(totalSize)}</p>
            </div>
            <div className="actions">
              <button type="button" onClick={clearAll} disabled={!files.length || isConverting}>Clear</button>
              <button className="convert-btn" type="button" onClick={convertAll} disabled={!canConvert}>Convert Images</button>
              <button className="zip-btn" type="button" onClick={downloadZip} disabled={!canDownloadZip}>Download ZIP</button>
            </div>
          </div>

          <div className="overall-box">
            <div className="overall-label"><span>Overall progress</span><strong>{overallProgress}%</strong></div>
            <div className="progress-track"><span style={{ width: `${overallProgress}%` }} /></div>
          </div>

          {files.length === 0 ? (
            <div className="empty-state">No files selected yet. Upload PNG or JPG images to begin.</div>
          ) : (
            <div className="file-list">
              {files.map((item) => (
                <article className="file-row" key={item.id}>
                  <div className="file-main">
                    <div className="file-name">{item.file.name}</div>
                    <div className="file-meta">
                      <span>{formatBytes(item.file.size)}</span>
                      {item.status === "done" && <span>Output: {formatBytes(item.outputSize)}</span>}
                      {item.status === "error" && <span className="error-text">{item.error}</span>}
                    </div>
                    <div className="file-progress-line"><span style={{ width: `${item.progress}%` }} /></div>
                    <div className="file-status">{item.status === "ready" ? "Ready" : item.status === "converting" ? `Converting ${item.progress}%` : item.status === "done" ? "Completed 100%" : "Failed"}</div>
                  </div>
                  <div className="file-actions">
                    <button onClick={() => downloadSingle(item)} disabled={item.status !== "done"}>Download</button>
                    <button onClick={() => removeFile(item.id)} disabled={isConverting}>Remove</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {message && <div className="status-message">{message}</div>}
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
