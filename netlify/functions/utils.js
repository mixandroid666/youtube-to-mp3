const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (targetUrl) => {
      https.get(targetUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location);
        } else if (res.statusCode === 200) {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        } else {
          reject(new Error(`Failed to download: status ${res.statusCode}`));
        }
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    get(url);
  });
}

function findFfmpeg() {
  try {
    return require('@ffmpeg-installer/ffmpeg').path;
  } catch (err) {
    // Fallback search in path
    const isWin = process.platform === 'win32';
    return isWin ? 'ffmpeg.exe' : 'ffmpeg';
  }
}

async function findYtDlp() {
  const isWin = process.platform === 'win32';
  const ext = isWin ? '.exe' : '';
  const binaryName = `yt-dlp${ext}`;

  // 1. Try local function folder and system temp folder
  const candidates = [
    path.join(__dirname, binaryName),
    path.join(os.tmpdir(), binaryName),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }

  // 2. Try system PATH
  try {
    const whichCmd = isWin ? 'where.exe' : 'which';
    require('child_process').execSync(`${whichCmd} yt-dlp`, { stdio: 'ignore' });
    return 'yt-dlp';
  } catch {}

  // 3. Download to temp directory
  const tempPath = path.join(os.tmpdir(), binaryName);
  const downloadUrl = isWin
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  console.log(`yt-dlp not found. Downloading to ${tempPath}...`);
  await downloadFile(downloadUrl, tempPath);
  
  if (!isWin) {
    fs.chmodSync(tempPath, 0o755);
  }
  
  console.log('yt-dlp download complete.');
  return tempPath;
}

module.exports = {
  CORS,
  findFfmpeg,
  findYtDlp,
};
