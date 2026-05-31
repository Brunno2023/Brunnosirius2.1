'use strict';

const { spawn } = require('child_process');
const yts = require('yt-search');
const https = require('https');
const http = require('http');

function isYouTubeUrl(text = '') {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(text);
}

// Búsqueda mejorada: filtra lives y videos muy largos
async function searchYouTube(query) {
  const res = await yts(query + ' audio');
  const videos = (res.videos || []).filter(v => {
    if (!v.seconds) return false;
    if (v.seconds > 600) return false;     // máx 10 min
    if (v.seconds < 30)  return false;     // descarta cortos raros
    const t = (v.title || '').toLowerCase();
    if (t.includes('live') && !t.includes('official')) return false;
    return true;
  });
  return videos[0] || res.videos?.[0] || null;
}

// Obtener metadata con yt-dlp --print (sin descargar)
function getVideoInfo(url) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--no-playlist',
      '--print', '%(title)s\n%(channel)s\n%(duration)s\n%(abr)s\n%(webpage_url)s\n%(thumbnail)s',
      '-f', 'bestaudio',
      url
    ]);

    let out = '';
    let err = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`yt-dlp info (${code}): ${err.slice(0, 300)}`));
      const lines = out.trim().split('\n');
      const totalSec = parseInt(lines[2]) || 0;
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      const durStr = secs > 0
        ? `${mins} minuto${mins !== 1 ? 's' : ''} ${secs} segundo${secs !== 1 ? 's' : ''}`
        : `${mins} minuto${mins !== 1 ? 's' : ''}`;
      resolve({
        title:     lines[0] || 'Sin título',
        channel:   lines[1] || 'Desconocido',
        duration:  durStr,
        abr:       parseFloat(lines[3]) || 0,
        url:       lines[4] || url,
        thumbnail: lines[5] || ''
      });
    });
  });
}

// Descargar thumbnail como buffer
function fetchThumbnail(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

// yt-dlp → buffer RAM
function ytdlpToBuffer(url) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--no-playlist',
      '-f', 'bestaudio',
      '-o', '-',
      url
    ]);

    const chunks = [];
    const errChunks = [];
    proc.stdout.on('data', d => chunks.push(d));
    proc.stderr.on('data', d => errChunks.push(d));
    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== 0) {
        const e = Buffer.concat(errChunks).toString().slice(0, 500);
        return reject(new Error(`yt-dlp error (${code}): ${e}`));
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

// ffmpeg convierte raw → OGG Opus en RAM
function convertToOggBuffer(inputBuffer) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-vbr', 'on',
      '-ar', '48000',
      '-ac', '1',
      '-f', 'ogg',
      'pipe:1'
    ]);

    const chunks = [];
    const errChunks = [];
    proc.stdout.on('data', d => chunks.push(d));
    proc.stderr.on('data', d => errChunks.push(d));
    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== 0) {
        const e = Buffer.concat(errChunks).toString().slice(0, 500);
        return reject(new Error(`ffmpeg error (${code}): ${e}`));
      }
      resolve(Buffer.concat(chunks));
    });

    proc.stdin.end(inputBuffer);
  });
}

module.exports = {
  commands: ['yt', 'play', 'youtube'],

  // Timeout propio más alto que el handler (5 min)
  timeout: 300_000,

  async execute({ sock, remoteJid, args, msg }) {
    // Timeout interno propio — no depende del handler
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        sock.sendMessage(remoteJid, {
          text: '❌ Tardó demasiado. Intenta con una canción más corta.'
        }, { quoted: msg }).catch(() => {});
      }
    }, 120_000);

    try {
      if (!args.length) {
        clearTimeout(timer);
        return sock.sendMessage(remoteJid, {
          text: '❌ Envía un link o nombre de canción.\n\nEjemplo:\n.play bad bunny'
        }, { quoted: msg });
      }

      const query = args.join(' ');
      let url = query;

      if (!isYouTubeUrl(query)) {
        const video = await searchYouTube(query);
        if (!video) {
          clearTimeout(timer);
          return sock.sendMessage(remoteJid, {
            text: '❌ No se encontraron resultados.'
          }, { quoted: msg });
        }
        url = video.url;
      }

      // Info + descarga EN PARALELO
      const [info, rawBuffer] = await Promise.all([
        getVideoInfo(url),
        ytdlpToBuffer(url)
      ]);

      // Conversión + thumbnail EN PARALELO
      const [audioBuffer, thumbBuffer] = await Promise.all([
        convertToOggBuffer(rawBuffer),
        fetchThumbnail(info.thumbnail)
      ]);

      if (!audioBuffer || audioBuffer.length < 1000) {
        clearTimeout(timer);
        return sock.sendMessage(remoteJid, {
          text: '❌ No se pudo obtener el audio.'
        }, { quoted: msg });
      }

      const sizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);

      if (parseFloat(sizeMB) > 95) {
        clearTimeout(timer);
        return sock.sendMessage(remoteJid, {
          text: '❌ El audio pesa demasiado para enviarlo.'
        }, { quoted: msg });
      }

      const abrStr = info.abr > 0 ? `${info.abr.toFixed(1)} kbps` : 'Desconocida';

      const caption =
`「✦」Descargando *<${info.title}>*

> ✐ Canal » *${info.channel}*
> ⴵ Duracion » *${info.duration}*
> ✰ Calidad: *${abrStr}*
> ❒ Tamaño » *${sizeMB}MB*
> 🜸 Link » ${info.url}`;

      finished = true;
      clearTimeout(timer);

      // Enviar imagen con info + audio al mismo tiempo
      await Promise.all([
        thumbBuffer
          ? sock.sendMessage(remoteJid, {
              image: thumbBuffer,
              caption
            }, { quoted: msg })
          : sock.sendMessage(remoteJid, { text: caption }, { quoted: msg }),

        sock.sendMessage(remoteJid, {
          audio: audioBuffer,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: false
        }, { quoted: msg })
      ]);

    } catch (err) {
      finished = true;
      clearTimeout(timer);
      console.log('❌ Error en play:', err?.message || err);
      await sock.sendMessage(remoteJid, {
        text: '❌ Error al descargar el audio.'
      }, { quoted: msg });
    }
  }
};
