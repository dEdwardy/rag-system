import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve("dist");
const textExtensions = new Set([".html", ".js", ".css", ".json", ".svg", ".txt", ".xml", ".mjs"]);

const mimeByExt = {
  ".html": "text/html; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".svg": "image/svg+xml; charset=UTF-8",
  ".txt": "text/plain; charset=UTF-8",
  ".xml": "application/xml; charset=UTF-8",
  ".mjs": "application/javascript; charset=UTF-8"
};

function cacheFor(file) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const isHashedAsset = rel.startsWith("assets/") && /-[A-Za-z0-9]{6,}\./.test(path.basename(file));
  return isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache, no-store, must-revalidate";
}

function resolveFile(reqPath) {
  let rel = decodeURIComponent(reqPath);
  if (rel.endsWith("/")) rel += "index.html";

  let file = path.join(root, rel);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;

  if (!path.extname(file)) {
    const html = path.join(root, rel, "index.html");
    if (fs.existsSync(html) && fs.statSync(html).isFile()) return html;
  }

  return path.join(root, "index.html");
}

function proxyApiRequest(req, res, pathname) {
  const targetPath = pathname.slice("/api".length) || "/";
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: 3000,
      method: req.method,
      path: `${targetPath}${new URL(req.url, "http://127.0.0.1").search}`,
      headers: {
        ...req.headers,
        host: "localhost:3000"
      }
    },
    upstreamRes => {
      const headers = { ...upstreamRes.headers };
      delete headers["transfer-encoding"];
      delete headers["content-length"];
      res.writeHead(upstreamRes.statusCode ?? 502, headers);
      upstreamRes.pipe(res);
    }
  );

  upstream.on("error", error => {
    res.writeHead(502, {
      "Content-Type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(JSON.stringify({ message: `API proxy failed: ${error.message}` }));
  });

  req.pipe(upstream);
}

function applyBaseHeaders(headers) {
  headers["Access-Control-Allow-Origin"] = "*";
  headers["Access-Control-Allow-Methods"] = "GET,HEAD,OPTIONS";
  headers["Access-Control-Allow-Headers"] = "*";
}

http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;

    if (pathname.startsWith("/api/")) {
      proxyApiRequest(req, res, pathname);
      return;
    }

    if (req.method === "OPTIONS") {
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "no-store"
      };
      res.writeHead(204, headers);
      res.end();
      return;
    }

    const file = resolveFile(pathname);
    const ext = path.extname(file);
    const raw = fs.readFileSync(file);
    const ae = (req.headers["accept-encoding"] || "").toLowerCase();
    const headers = {
      "Cache-Control": cacheFor(file),
      "Content-Type": mimeByExt[ext] || "application/octet-stream"
    };
    applyBaseHeaders(headers);

    if (textExtensions.has(ext)) {
      if (ae.includes("br")) {
        const body = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } });
        headers["Content-Encoding"] = "br";
        headers["Vary"] = "Accept-Encoding";
        headers["Content-Length"] = body.length;
        res.writeHead(200, headers);
        res.end(body);
        return;
      }

      if (ae.includes("gzip")) {
        const body = zlib.gzipSync(raw, { level: 6 });
        headers["Content-Encoding"] = "gzip";
        headers["Vary"] = "Accept-Encoding";
        headers["Content-Length"] = body.length;
        res.writeHead(200, headers);
        res.end(body);
        return;
      }
    }

    headers["Content-Length"] = raw.length;
    res.writeHead(200, headers);
    res.end(raw);
  })
  .listen(5174, "0.0.0.0", () => console.log("ready on 5174 with CORS"));
