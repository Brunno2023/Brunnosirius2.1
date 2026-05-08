'use strict';

const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
  commands: ['tts'],
  description: 'Texto a voz (nota de voz real)',

  async execute(ctx) {
    const { sock, remoteJid, args, msg } = ctx;

    if (!args.length) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Ejemplo:\n.tts Hola mundo'
      }, { quoted: msg });
    }

    const text = args.join(' ');

    // Crear carpeta tmp automáticamente
    const tempDir = path.join(__dirname, '../tmp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const mp3 = path.join(tempDir, 'tts.mp3');
    const ogg = path.join(tempDir, 'tts.ogg');

    try {

      // Crear MP3
      const tts = new gTTS(text, 'es');

      await new Promise((resolve, reject) => {
        tts.save(mp3, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Convertir a OPUS
      await new Promise((resolve, reject) => {
        exec(
          `ffmpeg -i "${mp3}" -c:a libopus -b:a 128k "${ogg}" -y`,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Leer audio
      const audio = fs.readFileSync(ogg);

      // Enviar nota de voz
      await sock.sendMessage(remoteJid, {
        audio: audio,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true
      }, { quoted: msg });

      // Limpiar archivos
      if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
      if (fs.existsSync(ogg)) fs.unlinkSync(ogg);

    } catch (e) {

      console.log(e);

      await sock.sendMessage(remoteJid, {
        text: '❌ Error en TTS (revisa ffmpeg)'
      }, { quoted: msg });

    }
  }
};
