'use strict';

const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');

module.exports = {
  commands: ['fakeig'],

  async execute({ sock, msg, remoteJid, args }) {

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentioned) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Debes mencionar a alguien.\nEjemplo: .fakeig @persona brunno_03 | comentario'
      }, { quoted: msg });
    }

    const fullText = args.join(' ');
    const partes = fullText.split('|');

    if (partes.length < 2) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Formato incorrecto.\nEjemplo: .fakeig @persona brunno_03 | comentario'
      }, { quoted: msg });
    }

    const nombreUsuario = partes[0]
      .replace(/@\S+/g, '')
      .trim();

    const comentario = partes[1].trim();

    if (!nombreUsuario || !comentario) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Faltan datos.'
      }, { quoted: msg });
    }

    let avatar;

    try {
      const ppUrl = await sock.profilePictureUrl(mentioned, 'image');

      const response = await axios.get(ppUrl, {
        responseType: 'arraybuffer'
      });

      avatar = await loadImage(Buffer.from(response.data));

    } catch {
      const tempCanvas = createCanvas(80, 80);
      const tempCtx = tempCanvas.getContext('2d');

      tempCtx.fillStyle = '#555';
      tempCtx.beginPath();
      tempCtx.arc(40, 40, 40, 0, Math.PI * 2);
      tempCtx.fill();

      avatar = await loadImage(tempCanvas.toBuffer());
    }

    const canvas = createCanvas(700, 230);
    const ctx = canvas.getContext('2d');

    // Fondo
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Avatar circular
    ctx.save();
    ctx.beginPath();
    ctx.arc(60, 60, 40, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(avatar, 20, 20, 80, 80);
    ctx.restore();

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Sans';
    ctx.fillText(nombreUsuario, 120, 45);

    // Tiempo
    const tiempos = ['1 h', '2 h', '4 h', '1 d', '2 d', '4 d'];
    const tiempo = tiempos[Math.floor(Math.random() * tiempos.length)];

    ctx.fillStyle = '#999999';
    ctx.font = '20px Sans';

    const userWidth = ctx.measureText(nombreUsuario).width;

    ctx.fillText(tiempo, 130 + userWidth, 45);

    // Corazón
    ctx.fillStyle = '#ff3040';
    ctx.font = '24px Sans';
    ctx.fillText('♥', 200 + userWidth, 45);

    // Comentario
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Sans';

    const lineas = wrapText(ctx, comentario, 520);

    let y = 95;

    for (const linea of lineas) {
      ctx.fillText(linea, 120, y);
      y += 32;
    }

    // Responder
    ctx.fillStyle = '#8e8e8e';
    ctx.font = 'bold 20px Sans';
    ctx.fillText('Responder', 120, 200);

    // Likes
    const likes = Math.floor(Math.random() * 200) + 10;

    ctx.fillStyle = '#8e8e8e';
    ctx.font = '20px Sans';
    ctx.fillText('♡', 650, 100);
    ctx.fillText(String(likes), 645, 130);

    const buffer = canvas.toBuffer('image/jpeg');

    await sock.sendMessage(remoteJid, {
      image: buffer,
      caption: ''
    }, { quoted: msg });
  }
};

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];

  let line = '';

  for (const word of words) {

    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && line !== '') {
      lines.push(line.trim());
      line = word + ' ';
    } else {
      line = testLine;
    }
  }

  lines.push(line.trim());

  return lines;
}
