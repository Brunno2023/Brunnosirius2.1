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
          text: '❌ Ejemplo: .attp hola mundo'
        }, { quoted: msg });
      }

      const tempDir = path.join(__dirname, '../temp');

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const id = Date.now();

      const webp = path.join(tempDir, `${id}.webp`);

      // 🔥 AUTO FONT SIZE
      const length = text.length;

      let fontSize;

      if (length <= 10) fontSize = 70;
      else if (length <= 20) fontSize = 60;
      else if (length <= 40) fontSize = 50;
      else if (length <= 70) fontSize = 40;
      else fontSize = 30;

      // 🔥 PARTIR TEXTO LARGO
      function breakText(str, max = 12) {
        return str.replace(
          new RegExp(`(.{${max}})`, 'g'),
          '$1\n'
        );
      }

      const formatted = breakText(
        text
          .replace(/"/g, '\\"')
          .replace(/\n/g, ' ')
      );

      // 🔥 COLORES RGB
      const colors = [
        '#ff0000',
        '#ff9900',
        '#ffff00',
        '#00ff00',
        '#00ffff',
        '#0000ff',
        '#ff00ff'
      ];

      const frames = [];

      // 🔥 CREAR FRAMES RGB
      for (let i = 0; i < colors.length; i++) {
        const frame = path.join(tempDir, `frame_${id}_${i}.png`);

        frames.push(frame);

        const cmd = `
        magick -size 512x512 xc:none \
        -gravity center \
        -font DejaVu-Sans-Bold \
        -pointsize ${fontSize} \
        -fill "${colors[i]}" \
        -stroke black \
        -strokewidth 3 \
        -interline-spacing 6 \
        -annotate +0+0 "${formatted}" \
        "${frame}"
        `;

        await new Promise((resolve, reject) => {
          exec(cmd, err => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // 🔥 CREAR WEBP ANIMADO
      const frameInputs = frames.map(f => `-i "${f}"`).join(' ');

      const ffmpegCmd = `
      ffmpeg -y \
      ${frameInputs} \
      -filter_complex "concat=n=${frames.length}:v=1:a=0,format=rgba,fps=8,scale=512:512" \
      -loop 0 \
      -vcodec libwebp \
      -lossless 0 \
      -q:v 60 \
      -compression_level 6 \
      "${webp}"
      `;

      exec(ffmpegCmd, async (err) => {

        if (err) {
          console.log(err);

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
          console.log(e);
        }

        // 🔥 LIMPIAR
        [...frames, webp].forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });

      });

    } catch (err) {
      console.log(err);

      await sock.sendMessage(remoteJid, {
        text: '❌ Error general'
      }, { quoted: msg });
    }
  }
};
