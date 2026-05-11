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
          {
            text: '❌ Usa: .attp Hola Mundo'
          },
          { quoted: msg }
        );
      }

      // 🔥 TEMP
      const tempDir = path.join(__dirname, '../temp');

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const id = Date.now();

      const webp = path.join(
        tempDir,
        `rgb_${id}.webp`
      );

      // 🔥 AUTO SIZE
      let fontSize = 60;

      if (text.length > 15) fontSize = 50;
      if (text.length > 30) fontSize = 40;
      if (text.length > 60) fontSize = 30;

      // 🔥 ESCAPAR TEXTO
     const ffmpegCmd = `
ffmpeg -y \
-f lavfi -i color=c=white@0.0:s=512x512:d=4:r=15 \
-vf "
format=rgba,
drawtext=
text='${safeText}':
fontfile=/system/fonts/Roboto-Bold.ttf:
fontsize=${fontSize}:
fontcolor_expr=ff0000+random(1)*ffffff:
x=(w-text_w)/2:
y=(h-text_h)/2:
borderw=4:
bordercolor=black
" \
-vcodec libwebp \
-lossless 1 \
-pix_fmt yuva420p \
-loop 0 \
-an \
"${webp}"
`;

      exec(ffmpegCmd, async (err, stdout, stderr) => {

        if (err) {

          console.log(stderr);

          return sock.sendMessage(
            remoteJid,
            {
              text: '❌ Error creando sticker'
            },
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

          console.log(e);

          return sock.sendMessage(
            remoteJid,
            {
              text: '❌ Error enviando sticker'
            },
            { quoted: msg }
          );
        }

        // 🔥 LIMPIAR
        if (fs.existsSync(webp)) {
          fs.unlinkSync(webp);
        }

      });

    } catch (err) {

      console.log(err);

      await sock.sendMessage(
        remoteJid,
        {
          text: '❌ Error general'
        },
        { quoted: msg }
      );
    }
  }
};
