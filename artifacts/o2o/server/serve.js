/**
 * Standalone production server for React Native Web builds.
 *
 * Serves the Vite build output from ./dist/ as a single-page application:
 * - Static files served with proper MIME types
 * - All non-file routes fall through to index.html (SPA routing)
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "dist");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return false;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(content);
  return true;
}

function serveIndex(res) {
  const indexPath = path.join(STATIC_ROOT, "index.html");
  if (!fs.existsSync(indexPath)) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found — run `npm run build:web` first.");
    return;
  }
  const content = fs.readFileSync(indexPath, "utf-8");
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(content);
}

if (!fs.existsSync(STATIC_ROOT)) {
  console.error(`Error: dist/ directory not found at ${STATIC_ROOT}`);
  console.error("Run `npm run build:web` first to create the web bundle.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Try to serve the file directly
  if (pathname !== "/" && serveStaticFile(pathname, res)) {
    return;
  }

  // SPA fallback — serve index.html for all other routes
  serveIndex(res);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving web build on http://localhost:${port}`);
});
