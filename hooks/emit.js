#!/usr/bin/env node
// Hook di Claude Code: inoltra il payload JSON (stdin) al server Sinapsi.
// Non scrive mai su stdout ed esce sempre con 0, così non può bloccare né alterare Claude.
import http from 'node:http';

const port = Number(process.env.SINAPSI_PORT) || 7420;
const exit = () => process.exit(0);
setTimeout(exit, 1500).unref();

let body = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { body += c; });
process.stdin.on('end', () => {
  if (!body.trim()) return exit();
  const req = http.request({
    host: '127.0.0.1', port, path: '/hook', method: 'POST', timeout: 800,
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
  }, (res) => { res.resume(); res.on('end', exit); });
  req.on('error', exit);
  req.on('timeout', () => { req.destroy(); exit(); });
  req.end(body);
});
