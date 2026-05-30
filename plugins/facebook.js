'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const db = require('../lib/database');

let events = null;
try {
  events = require('../lib/events');
} catch {}

const execFileAsync = promisify(execFile);
const TEMP_DIR = path.join(process.cwd(), 'temp');

function ensureTemp() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function isFacebookUrl(url = '') {
  return /(facebook\.com|fb\.watch)/i.test(url);
}

async function downloadFacebook(url, output) {
  await execFileAsync('yt-dlp', [
    '-f', 'best',           // ✅ 'best' funciona mejor con Facebook que 'mp4/best'
    '--no-playlist',
    '--add-header', 'user-agent:Mozilla/5.0',
    '--merge-output-format', 'mp4',  // ✅ fuerza salida MP4 sin recodificar
    '-o', output,
    url
  ]);
}

module.exports = {
  commands: ['facebook', 'fb', 'fbdl'],

  async execute({ sock, remoteJid, args, sender, msg }) {
    let videoFile = null;

    try {
      if (!args.length) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Envía un link de Facebook.\n\nEjemplo:\n.fb https://...'
        }, { quoted: msg });
      }

      const url = args[0];

      if (!isFacebookUrl(url)) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Link inválido de Facebook.'
        }, { quoted: msg });
      }

      ensureTemp();

      await sock.sendMessage(remoteJid, {
        text: '⏳ Descargando video de Facebook...'
      }, { quoted: msg });

      const id = `${Date.now()}_${Math.floor(Math.random() * 9999)}`;
      videoFile = path.join(TEMP_DIR, `fb_${id}.mp4`);

      console.log('[FB] Descargando...');
      await downloadFacebook(url, videoFile);
      console.log('[FB] Descarga completada');

      if (!fs.existsSync(videoFile)) {
        return sock.sendMessage(remoteJid, {
          text: '❌ No se pudo descargar el video.'
        }, { quoted: msg });
      }

      const sizeMB = fs.statSync(videoFile).size / 1024 / 1024;
      console.log(`[FB] Tamaño: ${sizeMB.toFixed(2)} MB`);

      if (sizeMB > 30) {
        return sock.sendMessage(remoteJid, {
          text: `⚠️ Video muy pesado (${sizeMB.toFixed(1)} MB). Límite: 30 MB.`
        }, { quoted: msg });
      }

      console.log('[FB] Enviando a WhatsApp...');

      await sock.sendMessage(remoteJid, {
        video: fs.readFileSync(videoFile),
        mimetype: 'video/mp4',
        caption: '📘 Descargado desde Facebook'
      }, { quoted: msg });

      console.log('[FB] Envío completado');

      let xp = Math.floor(Math.random() * 15) + 5;
      if (events?.getState?.()?.type === 'double') xp *= 2;
      await db.addXP(sender, xp);

    } catch (err) {
      console.log('❌ Error en facebook:', err?.stack || err);

      await sock.sendMessage(remoteJid, {
        text: '❌ Error al descargar el video.\nVerifica que el link sea válido y público.'
      }, { quoted: msg });

    } finally {
      try {
        if (videoFile && fs.existsSync(videoFile)) fs.unlinkSync(videoFile);
      } catch {}
    }
  }
};
