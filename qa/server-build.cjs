'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = 4176;
const ADDRESS = `http://${HOST}:${PORT}`;
const APP_ID = 'maquina-de-brindes-local-v1';
const ROOT = fs.realpathSync(path.join(__dirname, '..', 'dist'));
const SHOULD_OPEN = process.argv.includes('--open');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function isInsideRoot(filePath) {
  const relativePath = path.relative(ROOT, filePath);
  return relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
}

function isPublicPath(filePath) {
  const segments = path.relative(ROOT, filePath).split(path.sep);
  if (segments.some((part) => part.startsWith('.') || /^(?:tests?|__tests__|work|node_modules)$/i.test(part))) return false;
  const name = path.basename(filePath);
  if (/^(?:server\.cjs|iniciar\.cmd|leia-me\.md|readme(?:\.[^.]+)?|package(?:-lock)?\.json)$/i.test(name)) return false;
  if (/(?:^|[._-])(?:test|spec)(?:[._-]|$)/i.test(name)) return false;
  return Object.hasOwn(MIME_TYPES, path.extname(filePath).toLowerCase());
}

function reply(request, response, statusCode, body, type = 'text/plain; charset=utf-8') {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(statusCode, {
    'Content-Type': type,
    'Content-Length': bytes.length,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  response.end(request.method === 'HEAD' ? undefined : bytes);
}

async function serve(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    reply(request, response, 405, 'Método não permitido.');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, ADDRESS).pathname);
  } catch {
    reply(request, response, 400, 'Endereço inválido.');
    return;
  }

  if (pathname === '/__maquina_health') {
    reply(request, response, 200, JSON.stringify({ app: APP_ID }), MIME_TYPES['.json']);
    return;
  }
  if (/[\\\x00-\x1f\x7f]/.test(pathname)) {
    reply(request, response, 403, 'Acesso não permitido.');
    return;
  }

  const requestedPath = path.resolve(ROOT, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!isInsideRoot(requestedPath) || !isPublicPath(requestedPath)) {
    reply(request, response, 404, 'Arquivo não encontrado.');
    return;
  }

  try {
    const realPath = await fs.promises.realpath(requestedPath);
    if (!isInsideRoot(realPath) || !isPublicPath(realPath)) {
      reply(request, response, 404, 'Arquivo não encontrado.');
      return;
    }
    const info = await fs.promises.stat(realPath);
    if (!info.isFile()) {
      reply(request, response, 404, 'Arquivo não encontrado.');
      return;
    }
    const contents = await fs.promises.readFile(realPath);
    reply(request, response, 200, contents, MIME_TYPES[path.extname(realPath).toLowerCase()]);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'EACCES') {
      reply(request, response, 404, 'Arquivo não encontrado.');
    } else {
      console.error('Não foi possível ler o arquivo solicitado:', error.message);
      reply(request, response, 500, 'Não foi possível abrir este arquivo.');
    }
  }
}

function openBrowser() {
  let child;
  if (process.platform === 'win32') {
    child = spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${ADDRESS}"`], {
      detached: true, stdio: 'ignore', windowsHide: true,
    });
  } else {
    child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [ADDRESS], {
      detached: true, stdio: 'ignore',
    });
  }
  child.on('error', () => console.log(`Abra este endereço no navegador: ${ADDRESS}`));
  child.unref();
}

function isExistingMachine() {
  return new Promise((resolve) => {
    const request = http.get(`${ADDRESS}/__maquina_health`, { timeout: 1500 }, (response) => {
      let contents = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        contents += chunk;
        if (contents.length > 4096) response.destroy();
      });
      response.on('end', () => {
        try {
          resolve(response.statusCode === 200 && JSON.parse(contents).app === APP_ID);
        } catch {
          resolve(false);
        }
      });
      response.on('error', () => resolve(false));
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

const server = http.createServer((request, response) => {
  serve(request, response).catch((error) => {
    console.error('Não foi possível responder à solicitação:', error.message);
    if (!response.headersSent) reply(request, response, 500, 'Erro ao abrir a máquina.');
    else response.destroy();
  });
});

server.on('error', async (error) => {
  if (error.code === 'EADDRINUSE' && await isExistingMachine()) {
    console.log(`A Máquina de Brindes já está aberta em ${ADDRESS}`);
    if (SHOULD_OPEN) openBrowser();
    return;
  }
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} está sendo usada por outro programa.`);
    console.error('Feche o outro programa e execute iniciar.cmd novamente.');
    console.error(`O endereço deve continuar ${ADDRESS} para manter o mesmo cadastro.`);
  } else {
    console.error(`Não foi possível iniciar a Máquina de Brindes: ${error.message}`);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Máquina de Brindes: ${ADDRESS}`);
  console.log('Mantenha esta janela aberta enquanto usa a máquina.');
  console.log('Para encerrar, pressione Ctrl+C.');
  if (SHOULD_OPEN) openBrowser();
});

function shutdown() {
  console.log('\nEncerrando a Máquina de Brindes...');
  server.close();
  server.closeIdleConnections?.();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

