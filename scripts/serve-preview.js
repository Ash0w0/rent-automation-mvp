const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 8102);
const host = process.argv[4] || '127.0.0.1';

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendFile(targetPath, response) {
  fs.readFile(targetPath, (error, data) => {
    if (error) {
      response.statusCode = 404;
      response.end('Not found');
      return;
    }

    response.statusCode = 200;
    response.setHeader(
      'Content-Type',
      mime[path.extname(targetPath).toLowerCase()] || 'application/octet-stream',
    );
    response.end(data);
  });
}

const server = http.createServer((request, response) => {
  const urlPath = decodeURIComponent((request.url || '/').split('?')[0]);
  const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const targetPath = path.join(root, relativePath);

  if (!targetPath.startsWith(root)) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }

  fs.stat(targetPath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(targetPath, response);
      return;
    }

    sendFile(path.join(root, 'index.html'), response);
  });
});

server.listen(port, host, () => {
  console.log(`Preview server running at http://${host}:${port}`);
});
