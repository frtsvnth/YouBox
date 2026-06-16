#!/bin/sh
node -e "
const http = require('http');
http.get('http://localhost:3007/api/health', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      process.exit(j.status === 'ok' ? 0 : j.status === 'degraded' ? 1 : 2);
    } catch { process.exit(2); }
  });
}).on('error', () => process.exit(2));
"
