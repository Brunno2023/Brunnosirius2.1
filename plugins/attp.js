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
          text: '❌ Ejemplo: .attp Hola Mundo'
        }, { quoted: msg });
      }

      // 🔥 CARPETA TEMP
      const tempDir = path.join(__dirname, '../temp');

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const id = Date.now();

      const webp = path.join(
        tempDir,
        `rgb_${id}.webp`
      );

      // 🔥 AUTO FONT SIZE
      const length = text.length;

      let fontSize;

      if (length <= 10) fontSize = 70;
      else if (length <= 20) fontSize = 60;
      else if (length <= 40) fontSize = 50;
      else if (length <= 70) fontSize = 40;
      else if (length <= 120) fontSize = 32;
      else fontSize = 26;

      // 🔥 DIVIDIR TEXTO LARGO
      function breakText(str, max = 12) {
        return str.replace(
          new RegExp(`(.{${max}})`, 'g'),
          '$1\n'
        );
      }

      const formatted = breakText(
        text
          .replace(/"/g, '\\"')
          .replace(/'/g, "\\'")
          .replace(/\n/g, ' ')
      );

      // 🔥 RGB COLORS
      const colors = [
        '#ff0000',
        '#ff8800',
        '#ffff00',
        '#00ff00',
        '#00ffff',
        '#0000ff',
        '#ff00ff'
      ];

      const frames = [];

      // 🔥 CREAR FRAMES RGB
      for (let i = 0; i < colors.length; i++) {

        const frame = path.join(
          tempDir,
          `frame_${id}_${i}.png`
        );

        frames.push(frame);

        const cmd = `
        magick \
        -size 512x512 \
        canvas:none \
        -gravity center \
        -font Helvetica \
        -pointsize ${fontSize} \
        -fill "${colors[i]}" \
        -stroke black \
        -strokewidth 4 \
        -interline-spacing 10 \
        -annotate +0+0 "${formatted}" \
        "${frame}"
        `;

        await new Promise((resolve, reject) => {

          exec(cmd, (err, stdout, stderr) => {

            if (err) {
              console.log('MAGICK ERROR:', stderr);
              reject(err);
            } else {
              resolve();
            }

          });

        });
      }

      // 🔥 ENTRADAS FFMPEG
      const inputs = frames
        .map(f => `-i "${f}"`)
        .join(' ');

      // 🔥 CREAR WEBP RGB ANIMADO
      const ffmpegCmd = `
      ffmpeg -y \
      ${inputs} \
      -filter_complex "concat=n=${frames.length}:v=1:a=0,format=rgba,fps=8,scale=512:512:flags=lanczos" \
      -vcodec libwebp \
      -lossless 0 \
      -q:v 70 \
      -compression_level 6 \
      -loop 0 \
      -preset picture \
      -an \
      "${webp}"
      `;

      exec(ffmpegCmd, async (err, stdout, stderr) => {

        if (err) {

          console.log('FFMPEG ERROR:', stderr);

          return sock.sendMessage(remoteJid, {
            text: '❌ Error creando sticker RGB'
          }, { quoted: msg });
        }

        try {

          const sticker = fs.readFileSync(webp);

          await sock.sendMessage(remoteJid, {
            sticker
          }, { quoted: msg });

        } catch (e) {

          console.log('SEND ERROR:', e);

          await sock.sendMessage(remoteJid, {
            text: '❌ Error enviando sticker'
          }, { quoted: msg });
        }

        // 🔥 LIMPIAR
        [...frames, webp].forEach(file => {

          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }

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
