import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import sharp from 'sharp';
import archiver from 'archiver';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 10000;

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype);
    cb(ok ? null : new Error('Only PNG and JPG images are supported.'), ok);
  }
});

function safeName(name) {
  return path.parse(name).name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'image';
}

async function convertToWebp(file, opts) {
  const lossless = opts.mode === 'lossless';
  const quality = Math.max(1, Math.min(100, Number(opts.quality || 100)));
  const effort = Math.max(0, Math.min(6, Number(opts.effort || 6)));
  const img = sharp(file.buffer, { failOn: 'none' }).rotate();
  const output = await img.webp({ lossless, quality, effort, smartSubsample: true }).toBuffer();
  return { filename: `${safeName(file.originalname)}.webp`, buffer: output, originalSize: file.size, convertedSize: output.length };
}

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'WebP Converter Pro' }));

app.post('/api/convert', upload.array('images', 20), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'No images uploaded.' });
    const options = { mode: req.body.mode || 'lossless', quality: req.body.quality || 100, effort: req.body.effort || 6 };
    const converted = [];
    for (const file of req.files) converted.push(await convertToWebp(file, options));

    res.setHeader('X-Conversion-Stats', encodeURIComponent(JSON.stringify(converted.map(x => ({ filename: x.filename, originalSize: x.originalSize, convertedSize: x.convertedSize })))));

    if (converted.length === 1) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Content-Disposition', `attachment; filename="${converted[0].filename}"`);
      return res.end(converted[0].buffer);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="webp-converted-images.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);
    for (const item of converted) archive.append(item.buffer, { name: item.filename });
    await archive.finalize();
  } catch (err) { next(err); }
});

const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));
app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Conversion failed.' });
});

app.listen(PORT, () => console.log(`WebP Converter Pro running on port ${PORT}`));
