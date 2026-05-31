'use strict';

const { execFile, spawn } = require('child_process');
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

// Pipeline en memoria: yt-dlp → stdout → ffmpeg stdin → buffer OGG
// Sin escribir ningún archivo a disco = máxima velocidad
function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {

    // 1. yt-dlp transmite el audio raw por stdout (sin guardar nada)
    const ytdlp = spawn('yt-dlp', [
      '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
      '--no-playlist',
      '--match-filter', 'duration < 600',
      '-o', '-',   // ← stdout en lugar de archivo
      url
    ]);

    // 2. ffmpeg lee desde stdin y escribe OGG Opus a stdout
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',        // leer desde stdin
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-vbr', 'on',
      '-ar', '48000',
      '-ac', '1',
      '-f', 'ogg',
      'pipe:1'               // escribir a stdout
    ]);

    // 3. Conectar yt-dlp stdout → ffmpeg stdin
    ytdlp.stdout.pipe(ffmpeg.stdin);

    // Errores de yt-dlp no deben romper todo
    ytdlp.stderr.on('data', () => {});
    ytdlp.on('error', reject);

    // 4. Acumular chunks del OGG final en memoria
    const chunks = [];
    ffmpeg.stdout.on('data', chunk => chunks.push(chunk));
    ffmpeg.stderr.on('data', () => {});
    ffmpeg.on('error', reject);

    ffmpeg.on('close', code => {
      if (code !== 0) return reject(new Error(`ffmpeg salió con código ${code}`));
      resolve(Buffer.concat(chunks));
    });

    // Si yt-dlp cierra su stdout, cerrar stdin de ffmpeg
    ytdlp.stdout.on('end', () => {
      try { ffmpeg.stdin.end(); } catch {}
    });
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
      let title = 'Audio de YouTube';
      let duration = '';

      if (!isYouTubeUrl(query)) {
        await sock.sendMessage(remoteJid, {
          text: '🔍 Buscando...'
        }, { quoted: msg });

        const video = await searchYouTube(query);

        if (!video) {
          return sock.sendMessage(remoteJid, {
            text: '❌ No se encontraron resultados.'
          }, { quoted: msg });
        }

        url = video.url;
        title = video.title || title;
        duration = video.timestamp || '';
      }

      await sock.sendMessage(remoteJid, {
        text: `🎵 *${title}*${duration ? `\n⏱️ ${duration}` : ''}\n\n⏳ Descargando...`
      }, { quoted: msg });

      // Descargar y convertir todo en memoria (sin tocar el disco)
      const audioBuffer = await downloadToBuffer(url);

      if (!audioBuffer || audioBuffer.length < 1000) {
        return sock.sendMessage(remoteJid, {
          text: '❌ No se pudo obtener el audio.'
        }, { quoted: msg });
      }

      const sizeMB = audioBuffer.length / 1024 / 1024;

      if (sizeMB > 95) {
        return sock.sendMessage(remoteJid, {
          text: '❌ El audio pesa demasiado para enviarlo.'
        }, { quoted: msg });
      }

      // Enviar como audio nativo de WhatsApp
      await sock.sendMessage(remoteJid, {
        audio: audioBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: false   // false = reproductor normal | true = nota de voz
      }, { quoted: msg });

    } catch (err) {
      console.log('❌ Error en play:', err?.message || err);

      await sock.sendMessage(remoteJid, {
        text: '❌ Error al descargar el audio.\nVerifica que tengas instalado yt-dlp y ffmpeg.'
      }, { quoted: msg });
    }
  }
};
  
