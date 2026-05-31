'use strict';

const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const yts = require('yt-search');

const execFileAsync = promisify(execFile);

function isYouTubeUrl(text = '') {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(text);
}

async function searchYouTube(query) {
  const res = await yts(query);
  return res.videos?.[0] || null;
}

// Obtener metadata del video sin descargar nada
function getVideoInfo(url) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--no-playlist',
      '--print', '%(title)s\n%(channel)s\n%(duration)s\n%(abr)s\n%(webpage_url)s',
      '-f', 'bestaudio',
      url
    ]);

    let out = '';
    let err = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`yt-dlp info error (${code}): ${err.slice(0, 300)}`));
      const lines = out.trim().split('\n');
      const totalSec = parseInt(lines[2]) || 0;
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      const durStr = secs > 0
        ? `${mins} minuto${mins !== 1 ? 's' : ''} ${secs} segundos`
        : `${mins} minuto${mins !== 1 ? 's' : ''}`;
      resolve({
        title:    lines[0] || 'Sin título',
        channel:  lines[1] || 'Desconocido',
        duration: durStr,
        abr:      parseFloat(lines[3]) || 0,
        url:      lines[4] || url
      });
    });
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
        const errMsg = Buffer.concat(errChunks).toString().slice(0, 500);
        return reject(new Error(`yt-dlp error (${code}): ${errMsg}`));
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

// ffmpeg convierte buffer raw → OGG Opus en RAM
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
        const errMsg = Buffer.concat(errChunks).toString().slice(0, 500);
        return reject(new Error(`ffmpeg error (${code}): ${errMsg}`));
      }
      resolve(Buffer.concat(chunks));
    });

    proc.stdin.end(inputBuffer);
  });
}

module.exports = {
  commands: ['yt', 'play', 'youtube'],

  async execute({ sock, remoteJid, args, msg }) {
    try {
      if (!args.length) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Envía un link o nombre de canción.\n\nEjemplo:\n.play bad bunny'
        }, { quoted: msg });
      }

      const query = args.join(' ');
      let url = query;

      // Si no es URL, buscar primero
      if (!isYouTubeUrl(query)) {
        const video = await searchYouTube(query);
        if (!video) {
          return sock.sendMessage(remoteJid, {
            text: '❌ No se encontraron resultados.'
          }, { quoted: msg });
        }
        url = video.url;
      }

      // Obtener info y descargar EN PARALELO para ahorrar tiempo
      const [info, rawBuffer] = await Promise.all([
        getVideoInfo(url),
        ytdlpToBuffer(url)
      ]);

      // Convertir a OGG
      const audioBuffer = await convertToOggBuffer(rawBuffer);

      if (!audioBuffer || audioBuffer.length < 1000) {
        return sock.sendMessage(remoteJid, {
          text: '❌ No se pudo obtener el audio.'
        }, { quoted: msg });
      }

      const sizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);

      if (parseFloat(sizeMB) > 95) {
        return sock.sendMessage(remoteJid, {
          text: '❌ El audio pesa demasiado para enviarlo.'
        }, { quoted: msg });
      }

      const abrStr = info.abr > 0 ? `${info.abr.toFixed(1)} kbps` : 'Desconocida';

      // Enviar info + audio al mismo tiempo
      await Promise.all([
        sock.sendMessage(remoteJid, {
          text:
`「✦」Descargando *<${info.title}>*

> ✐ Canal » *${info.channel}*
> ⴵ Duracion » *${info.duration}*
> ✰ Calidad: *${abrStr}*
> ❒ Tamaño » *${sizeMB}MB*
> 🜸 Link » ${info.url}`
        }, { quoted: msg }),

        sock.sendMessage(remoteJid, {
          audio: audioBuffer,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: false
        }, { quoted: msg })
      ]);

    } catch (err) {
      console.log('❌ Error en play:', err?.message || err);
      await sock.sendMessage(remoteJid, {
        text: '❌ Error al descargar el audio.'
      }, { quoted: msg });
    }
  }
};
                                
