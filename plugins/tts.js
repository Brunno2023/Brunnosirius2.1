'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');

module.exports = {
  command: ['tts'],
  description: 'Texto a voz',

  run: async ({ sock, remoteJid, args, msg }) => {

    if (!args || !args.length) {
      return sock.sendMessage(
        remoteJid,
        {
          text: '❌ Ejemplo:\n.tts Hola mundo'
        },
        { quoted: msg }
      );
    }

    const text = encodeURIComponent(args.join(' '));

    const tmpDir = path.join(__dirname, '../tmp');

    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const mp3 = path.join(tmpDir, `tts_${Date.now()}.mp3`);
    const ogg = path.join(tmpDir, `tts_${Date.now()}.ogg`);

    try {

      // Descargar MP3
      await new Promise((resolve, reject) => {

        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=es&client=tw-ob`;

        const file = fs.createWriteStream(mp3);

        https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        }, (res) => {

          res.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });

        }).on('error', reject);

      });

      // Convertir a opus
      await new Promise((resolve, reject) => {

        exec(
          `ffmpeg -i "${mp3}" -vn -c:a libopus -b:a 128k "${ogg}" -y`,
          (err, stdout, stderr) => {

            if (err) {
              console.log(stderr);
              return reject(err);
            }

            resolve();
          }
        );

      });

      // Enviar audio
      await sock.sendMessage(
        remoteJid,
        {
          audio: fs.readFileSync(ogg),
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        },
        { quoted: msg }
      );

      // Limpiar
      if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
      if (fs.existsSync(ogg)) fs.unlinkSync(ogg);

    } catch (e) {

      console.log('❌ ERROR TTS:', e);

      await sock.sendMessage(
        remoteJid,
        {
          text: '❌ Error generando TTS'
        },
        { quoted: msg }
      );
    }
  }
};    const ogg = path.join(tmpDir, `tts_${Date.now()}.ogg`);

    try {

      // Descargar MP3 desde Google Translate
      await new Promise((resolve, reject) => {

        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=es&client=tw-ob`;

        const file = fs.createWriteStream(mp3);

        https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        }, (res) => {

          res.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });

        }).on('error', (err) => {

          if (fs.existsSync(mp3)) {
            fs.unlinkSync(mp3);
          }

          reject(err);
        });

      });

      // Verificar MP3
      if (!fs.existsSync(mp3)) {
        throw new Error('No se creó el archivo MP3');
      }

      // Convertir a OGG OPUS
      await new Promise((resolve, reject) => {

        exec(
          `ffmpeg -i "${mp3}" -vn -c:a libopus -b:a 128k "${ogg}" -y`,
          (err, stdout, stderr) => {

            if (err) {
              console.log('❌ FFMPEG ERROR:\n', stderr);
              return reject(err);
            }

            resolve();
          }
        );

      });

      // Verificar OGG
      if (!fs.existsSync(ogg)) {
        throw new Error('No se creó el archivo OGG');
      }

      // Enviar audio
      await sock.sendMessage(
        remoteJid,
        {
          audio: fs.readFileSync(ogg),
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        },
        { quoted: msg }
      );

      // Borrar temporales
      if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
      if (fs.existsSync(ogg)) fs.unlinkSync(ogg);

    } catch (e) {

      console.log('❌ ERROR TTS:', e);

      await sock.sendMessage(
        remoteJid,
        {
          text: '❌ Error generando TTS'
        },
        { quoted: msg }
      );
    }
  }
};    try {

      // Descargar MP3
      await new Promise((resolve, reject) => {

        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=es&client=tw-ob`;

        const file = fs.createWriteStream(mp3);

        https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        }, (res) => {

          res.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });

        }).on('error', (err) => {
          reject(err);
        });

      });

      // Convertir a opus
      await new Promise((resolve, reject) => {

        exec(
          `ffmpeg -i "${mp3}" -vn -c:a libopus -b:a 128k "${ogg}" -y`,
          (err, stdout, stderr) => {

            if (err) {
              console.log(stderr);
              return reject(err);
            }

            resolve();
          }
        );

      });

      // Enviar audio
      await sock.sendMessage(
        remoteJid,
        {
          audio: fs.readFileSync(ogg),
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        },
        { quoted: msg }
      );

      // Limpiar
      if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
      if (fs.existsSync(ogg)) fs.unlinkSync(ogg);

    } catch (e) {

      console.log('❌ ERROR TTS:', e);

      await sock.sendMessage(
        remoteJid,
        {
          text: '❌ Error generando TTS'
        },
        { quoted: msg }
      );
    }
  }
};      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=es&client=tw-ob`;

      await new Promise((resolve, reject) => {

        const file = fs.createWriteStream(mp3);

        https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        }, (res) => {

          res.pipe(file);

          file.on('finish', () => {
            file.close(resolve);
          });

        }).on('error', (err) => {
          fs.unlink(mp3, () => {});
          reject(err);
        });

      });

      // 🔥 Verificar MP3
      if (!fs.existsSync(mp3)) {
        throw new Error('No se creó el MP3');
      }

      console.log('✅ MP3 generado');

      // 🔥 Convertir a OGG OPUS
      await new Promise((resolve, reject) => {

        exec(
          `ffmpeg -i "${mp3}" -vn -c:a libopus -b:a 128k "${ogg}" -y`,
          (err, stdout, stderr) => {

            if (err) {
              console.log(stderr);
              return reject(err);
            }

            resolve();
          }
        );

      });

      console.log('✅ OGG generado');

      // 🔥 Enviar audio
      await sock.sendMessage(
        remoteJid,
        {
          audio: fs.readFileSync(ogg),
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        },
        { quoted: msg }
      );

      // 🔥 Borrar temporales
      if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
      if (fs.existsSync(ogg)) fs.unlinkSync(ogg);

    } catch (e) {

      console.log('❌ ERROR TTS:', e);

      await sock.sendMessage(
        remoteJid,
        { text: '❌ Error generando TTS' },
        { quoted: msg }
      );
    }
  }
};    try {
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
