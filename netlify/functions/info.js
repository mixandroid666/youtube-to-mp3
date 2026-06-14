const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execFileAsync = promisify(execFile);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

function findBin(name) {
  const candidates = [
    path.join(__dirname, name),
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
    name,
  ];
  for (const c of candidates) {
    try { fs.accessSync(c, fs.constants.X_OK); return c; } catch {}
  }
  return name;
}

async function runYtDlp(args) {
  const bin = findBin('yt-dlp');
  return execFileAsync(bin, args, { maxBuffer: 50 * 1024 * 1024 });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };

  const url = event.queryStringParameters?.url;
  if (!url) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing url parameter' }) };
  }

  try {
    const { stdout } = await runYtDlp([
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      url,
    ]);

    const meta = JSON.parse(stdout);
    const thumbnail =
      meta.thumbnails?.slice().reverse().find((t) => t.url)?.url ?? meta.thumbnail ?? '';

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        title: meta.title,
        author: meta.uploader || meta.channel || '',
        duration: meta.duration ?? 0,
        thumbnail,
      }),
    };
  } catch (err) {
    console.error('info error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
