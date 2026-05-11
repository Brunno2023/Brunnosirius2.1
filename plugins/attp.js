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
        return sock.sendMessage(
          remoteJid,
          { text: '❌ Usa: .attp Hola Mundo' },
          { quoted: msg }
        );
      }

      const tempDir = path.join(__dirname, '../temp');

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const id = Date.now();

      const webp = path.join(tempDir, `${id}.webp`);

      // 🔥 AUTO SIZE
      let fontSize = 60;

      if (text.length > 15) fontSize = 50;
      if (text.length > 30) fontSize = 40;
      if (text.length > 60) fontSize = 30;

      // 🔥 DIVIDIR TEXTO
      function breakText(str, max = 10) {

        let result = '';

        for (let i = 0; i < str.length; i += max) {
          result += str.substring(i, i + max) + '\n';
        }

        return result;
      }

      const formatted = breakText(
        text
          .replace(/"/g, '\\"')
          .replace(/\n/g, ' ')
      );

      // 🔥 RGB
      const colors = [
        'red',
        'orange',
        'yellow',
        'lime',
        'cyan',
        'blue',
        'magenta'
      ];

      const frames = [];

      // 🔥 CREAR FRAMES
      for (let i = 0; i < colors.length; i++) {

        const frame = path.join(
          tempDir,
          `frame_${id}_${i}.png`
        );

        frames.push(frame);

        const cmd =
`magick \
-size 512x512 \
xc:none \
-gravity center \
-font DejaVu-Sans \
-pointsize ${fontSize} \
-fill "${colors[i]}" \
-stroke black \
-strokewidth 3 \
-annotate +0+0 "${formatted}" \
"${frame}"`;

        await new Promise((resolve, reject) => {

          exec(cmd, (err, stdout, stderr) => {

            if (err) {
              console.log('MAGICK:', stderr);
              reject(err);
            } else {
              resolve();
            }

          });

        });
      }

      // 🔥 INPUTS
      const inputs = frames
        .map(f => `-i "${f}"`)
        .join(' ');

      // 🔥 WEBP
      const ffmpegCmd =
`ffmpeg -y \
${inputs} \
-filter_complex "concat=n=${frames.length}:v=1:a=0,fps=8" \
-vcodec libwebp \
-loop 0 \
-lossless 0 \
-q:v 70 \
"${webp}"`;

      exec(ffmpegCmd, async (err, stdout, stderr) => {

        if (err) {

          console.log('FFMPEG:', stderr);

          return sock.sendMessage(
            remoteJid,
            { text: '❌ Error creando sticker' },
            { quoted: msg }
          );
        }

        try {

          const sticker = fs.readFileSync(webp);

          await sock.sendMessage(
            remoteJid,
            { sticker },
            { quoted: msg }
          );

        } catch (e) {

          console.log('SEND:', e);

        }

        // 🔥 BORRAR
        [...frames, webp].forEach(file => {

          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }

        });

      });

    } catch (err) {

      console.log('GENERAL:', err);

      await sock.sendMessage(
        remoteJid,
        { text: '❌ Error general' },
        { quoted: msg }
      );
    }
  }
};
