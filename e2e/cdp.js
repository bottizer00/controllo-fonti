/*
 * Mini-driver per Chrome/Edge via DevTools Protocol, senza dipendenze: apre una pagina, esegue JavaScript,
 * scatta screenshot e raccoglie gli errori della console. Serve a e2e/run.js.
 */
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function trovaBrowser() {
  const candidati = [process.env.CHROME_PATH,
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'];
  return candidati.find(p => p && fs.existsSync(p)) || null;
}

async function avviaBrowser() {
  const exe = trovaBrowser();
  if (!exe) throw new Error('Nessun Chrome o Edge trovato: imposta CHROME_PATH.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-e2e-'));
  const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--remote-debugging-port=0',
    '--user-data-dir=' + dir, 'about:blank'], { stdio: 'ignore' });
  const file = path.join(dir, 'DevToolsActivePort');
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(file)) {
      const porta = +fs.readFileSync(file, 'utf8').split('\n')[0];
      if (porta) return { proc, porta, dir };
    }
    await sleep(150);
  }
  proc.kill();
  throw new Error('Il browser non risponde.');
}

async function sessione(porta, url) {
  const r = await fetch('http://127.0.0.1:' + porta + '/json/new?' + encodeURI(url), { method: 'PUT' });
  const tab = await r.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  let id = 0; const attese = new Map(); const log = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && attese.has(m.id)) { attese.get(m.id)(m); attese.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') log.push('ECCEZIONE: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) log.push('console.' + m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    else if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) log.push('LOG ' + m.params.entry.level + ': ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; attese.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('DOM.enable');
  return {
    log, send,
    async vai(u) { await send('Page.navigate', { url: u }); await sleep(900); },
    async js(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result.exceptionDetails) throw new Error('Errore nella pagina: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
      return r.result.result.value;
    },
    async misura(w, h, mobile) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile }); await sleep(250); },
    async tema(valore) { await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: valore }] }); },
    async file(selettore, percorsi) {
      const doc = await send('DOM.getDocument', {});
      const n = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: selettore });
      await send('DOM.setFileInputFiles', { nodeId: n.result.nodeId, files: percorsi });
    },
    async scatta(file, intera) {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!intera });
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    },
    chiudi() { ws.close(); }
  };
}

module.exports = { avviaBrowser, sessione, sleep, trovaBrowser };
