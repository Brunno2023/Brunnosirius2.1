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
      return sock.sendMessage(
        remoteJid,
        {
          text: '❌ Ejemplo:\n.tts Hola mundo'
        },
        { quoted: msg }
      );
    }

    const text = args.join(' ');

    // 🔥 Crear carpeta tmp si no existe
    const tmpDir = path.join(__dirname, '../tmp');

    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const mp3 = path.join(tmpDir, `tts_${Date.now()}.mp3`);
    const ogg = path.join(tmpDir, `tts_${Date.now()}.ogg`);

    try {
      // 🔥 Crear MP3
      const tts = new gTTS(text, 'es');

      await new Promise((resolve, reject) => {
        tts.save(mp3, (err) => {
          if (err) {
            console.log('❌ GTTS ERROR:', err);
            return reject(err);
          }

          console.log('✅ MP3 generado');
          resolve();
        });
      });

      // 🔥 Verificar existencia
      console.log('MP3 EXISTS:', fs.existsSync(mp3));

      if (!fs.existsSync(mp3)) {
        throw new Error('No se creó el archivo MP3');
      }

      // 🔥 Convertir a OPUS/OGG
      await new Promise((resolve, reject) => {
        exec(
          `ffmpeg -i "${mp3}" -vn -c:a libopus -b:a 128k "${ogg}" -y`,
          (err, stdout, stderr) => {

            if (err) {
              console.log('❌ FFMPEG STDERR:\n', stderr);
              console.log('❌ FFMPEG ERROR:\n', err);
              return reject(err);
            }

            console.log('✅ OGG generado');
            resolve();
          }
        );
      });

      // 🔥 Enviar nota de voz
      await sock.sendMessage(
        remoteJid,
        {
          audio: fs.readFileSync(ogg),
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        },
        { quoted: msg }
      );

      // 🔥 Eliminar archivos
      if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
      if (fs.existsSync(ogg)) fs.unlinkSync(ogg);

    } catch (e) {
      console.log('❌ Error en TTS:', e);

      await sock.sendMessage(
        remoteJid,
        {
          text: '❌ Error en TTS (revisa ffmpeg o gtts)'
        },
        { quoted: msg }
      );
    }
  }
};
