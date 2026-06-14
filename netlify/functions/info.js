const { execFile } = require('child_process');
const { promisify } = require('util');
const { CORS, findYtDlp } = require('./utils');

const execFileAsync = promisify(execFile);

async function runYtDlp(bin, args) {
  return execFileAsync(bin, args, { maxBuffer: 50 * 1024 * 1024 });
}

exports.handler = async (event) => {
  const responseHeaders = {
    ...CORS,
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: responseHeaders };

  const url = event.queryStringParameters?.url;
  if (!url) {
    return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing url parameter' }) };
  }

  try {
    const ytDlp = await findYtDlp();
    const { stdout } = await runYtDlp(ytDlp, [
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
      headers: responseHeaders,
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
      headers: responseHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
