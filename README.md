# WebP Converter Pro

Premium PNG/JPG to WebP converter with React UI and Express + Sharp backend.

## GitHub upload

Upload/push the entire root folder to GitHub:

```text
webp-converter-pro/
├── client/
├── server/
├── package.json
├── render.yaml
├── README.md
└── .gitignore
```

Do not upload only `client` or only `server`.

## Render settings

Create a **Web Service** and connect your GitHub repo.

- Build Command: `npm run build`
- Start Command: `npm start`
- Environment: `Node`
- Root Directory: leave blank if these files are in repo root

Or use Render Blueprint because `render.yaml` is included.

## Local run

```bash
npm run install-all
npm run build
npm start
```

Open `http://localhost:10000`.

## Quality notes

Default mode is Lossless WebP. This preserves visual quality, but file size may not always be smaller than JPEG. Use Quality WebP with Quality 90-100 when you want smaller files with very high visual quality.
