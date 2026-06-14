const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomBytes } = require('crypto');
const { CORS, findYtDlp, findFfmpeg, getCookieFile, deleteFile } = require('./utils');

function run(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, opts);
    let stderr = '';
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => reject(Object.assign(err, { stderr })));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.split('\n').filter(Boolean).pop() || `exited ${code}`));
    });
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };

  const url = event.queryStringParameters?.url;
  if (!url) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing url parameter' }),
    };
  }

  const tmpBase = path.join(os.tmpdir(), `yt-${randomBytes(8).toString('hex')}`);
  const tmpMp3 = `${tmpBase}.mp3`;
  let cookieFile = null;

  try {
    const ytDlp = await findYtDlp();
    const ffmpeg = findFfmpeg();
    cookieFile = getCookieFile();

    const args = [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '192K',
      '--ffmpeg-location', path.dirname(ffmpeg),
      '--no-playlist',
      '--no-warnings',
    ];

    if (cookieFile) {
      args.push('--cookies', cookieFile);
    }

    args.push('-o', `${tmpBase}.%(ext)s`, url);

    await run(ytDlp, args);

    const buffer = fs.readFileSync(tmpMp3);
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename="audio.mp3"',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('download error:', err.message);
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    try { fs.unlinkSync(tmpMp3); } catch {}
    deleteFile(cookieFile);
  }
};
