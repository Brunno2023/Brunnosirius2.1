'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
  commands: ['attp'],

  async execute(ctx) {
    const { sock, msg, remoteJid, args } = ctx;

    try {
      const text = args.join(' ');

      if (!text) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Ejemplo: .attp Hola mundo'
        }, { quoted: msg });
      }

      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const img = path.join(tempDir, `text_${Date.now()}.png`);
      const webp = path.join(tempDir, `sticker_${Date.now()}.webp`);

      // 🔥 AUTO AJUSTE DE TAMAÑO
      const length = text.length;

      let fontSize;

      if (length <= 10) fontSize = 95;
      else if (length <= 20) fontSize = 75;
      else if (length <= 40) fontSize = 58;
      else if (length <= 70) fontSize = 45;
      else if (length <= 120) fontSize = 35;
      else fontSize = 28;

      // 🔥 ESCAPAR TEXTO
      const safeText = text
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, ' ');

      // 🔥 CREAR TEXTO RGB CENTRADO Y AJUSTADO
      const createImg = `
      magick -size 512x512 xc:none \
      -gravity center \
      -font DejaVu-Sans-Bold \
      -pointsize ${fontSize} \
      -fill "#ffffff" \
      -stroke "#000000" \
      -strokewidth 3 \
      -interline-spacing 8 \
      -kerning 1 \
      -background none \
      -size 440x440 \
      caption:"${safeText}" \
      -gravity center \
      -compose over \
      -composite \
      "${img}"
      `;

      // 🔥 CONVERTIR A WEBP ANIMADO RGB
      const toSticker = `
      ffmpeg -y -loop 1 -i "${img}" \
      -vf "fps=15,scale=512:512:flags=lanczos,hue='H=2*PI*t:s=2'" \
      -t 4 \
      -vcodec libwebp \
      -lossless 0 \
      -compression_level 6 \
      -q:v 70 \
      -loop 0 \
      -preset picture \
      -an \
      "${webp}"
      `;

      exec(createImg, (err1) => {
        if (err1) {
          console.log('IMG ERROR:', err1);

          return sock.sendMessage(remoteJid, {
            text: '❌ Error creando imagen'
          }, { quoted: msg });
        }

        exec(toSticker, async (err2) => {
          if (err2) {
            console.log('WEBP ERROR:', err2);

            return sock.sendMessage(remoteJid, {
              text: '❌ Error creando sticker'
            }, { quoted: msg });
          }

          try {
            const sticker = fs.readFileSync(webp);

            await sock.sendMessage(remoteJid, {
              sticker
            }, { quoted: msg });

          } catch (e) {
            console.log('SEND ERROR:', e);
          }

          // 🔥 BORRAR TEMPORALES
          [img, webp].forEach(file => {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
          });
        });
      });

    } catch (err) {
      console.log('ERROR GENERAL:', err);

      await sock.sendMessage(remoteJid, {
        text: '❌ Error general'
      }, { quoted: msg });
    }
  }
};
