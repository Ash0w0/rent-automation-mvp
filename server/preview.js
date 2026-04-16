const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(process.cwd(), process.argv[2] || '.web-preview-2');
const port = Number(process.argv[3] || 8081);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
};

function resolveRequestPath(urlPath) {
  const normalized = decodeURIComponent((urlPath || '/').split('?')[0]);
  const requestedPath = normalized === '/' ? '/index.html' : normalized;
  const absolutePath = path.normalize(path.join(rootDir, requestedPath));

  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  return absolutePath;
}

const server = http.createServer((request, response) => {
  const absolutePath = resolveRequestPath(request.url);

  if (!absolutePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.stat(absolutePath, (statError, stats) => {
    if (!statError && stats.isFile()) {
      const extension = path.extname(absolutePath).toLowerCase();
      response.writeHead(200, {
        'Content-Type': contentTypes[extension] || 'application/octet-stream',
      });
      fs.createReadStream(absolutePath).pipe(response);
      return;
    }

    const fallbackFile = path.join(rootDir, 'index.html');
    fs.readFile(fallbackFile, (readError, data) => {
      if (readError) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }

      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
      });
      response.end(data);
    });
  });
});

server.listen(port, () => {
  console.log(`Frontend preview listening on http://127.0.0.1:${port}`);
});
