'use strict';

const sharp = require('sharp');
const axios = require('axios');

module.exports = {
  commands: ['fakeig'],

  async execute({ sock, msg, remoteJid, args }) {

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentioned) {
      return await sock.sendMessage(remoteJid, {
        text: '❌ Debes mencionar a alguien.\nEjemplo: .fakeig @persona brunno_03 | comentario'
      }, { quoted: msg });
    }

    const fullText = args.join(' ');
    const partes = fullText.split('|');

    if (partes.length < 2) {
      return await sock.sendMessage(remoteJid, {
        text: '❌ Formato incorrecto.\nEjemplo: .fakeig @persona brunno_03 | comentario'
      }, { quoted: msg });
    }

    const nombreUsuario = partes[0].replace(/@\S+/g, '').trim();
    const comentario = partes[1].trim();

    if (!nombreUsuario || !comentario) {
      return await sock.sendMessage(remoteJid, {
        text: '❌ Faltan datos.\nEjemplo: .fakeig @persona brunno_03 | comentario'
      }, { quoted: msg });
    }

    let avatarBuffer;
    try {
      const ppUrl = await sock.profilePictureUrl(mentioned, 'image');
      const response = await axios.get(ppUrl, { responseType: 'arraybuffer' });
      avatarBuffer = Buffer.from(response.data);
    } catch {
      avatarBuffer = await sharp({
        create: { width: 100, height: 100, channels: 4, background: { r: 80, g: 80, b: 80, alpha: 1 } }
      }).png().toBuffer();
    }

    const tiempos = ['1 h', '2 h', '4 h', '1 d', '2 d', '4 d', '1 sem'];
    const tiempo = tiempos[Math.floor(Math.random() * tiempos.length)];
    const likes = Math.floor(Math.random() * 200) + 10;

    const imgBuffer = await generarFakeIG({ avatarBuffer, nombreUsuario, comentario, tiempo, likes });

    await sock.sendMessage(remoteJid, { image: imgBuffer, caption: '' }, { quoted: msg });
  }
};

async function generarFakeIG({ avatarBuffer, nombreUsuario, comentario, tiempo, likes }) {
  const W = 700;
  const PADDING = 20;
  const AVATAR_SIZE = 80;

  const charsPerLine = 38;
  const palabras = comentario.split(' ');
  let lineasTexto = [];
  let lineaActual = '';

  for (const palabra of palabras) {
    if ((lineaActual + ' ' + palabra).trim().length > charsPerLine) {
      lineasTexto.push(lineaActual.trim());
      lineaActual = palabra;
    } else {
      lineaActual += ' ' + palabra;
    }
  }
  if (lineaActual.trim()) lineasTexto.push(lineaActual.trim());

  const H = Math.max(160, PADDING * 2 + AVATAR_SIZE + (lineasTexto.length * 32) + 60);

  const textoBaseY = PADDING + 38;
  let textoSVG = '';
  lineasTexto.forEach((linea, i) => {
    textoSVG += `<text x="${PADDING + AVATAR_SIZE + 20}" y="${textoBaseY + 10 + (i * 32)}" font-family="Arial" font-size="24" fill="#ffffff">${escaparXML(linea)}</text>`;
  });

  const svgOverlay = `
    <svg width="${W}" height="${H}">
      <text x="${PADDING + AVATAR_SIZE + 20}" y="${PADDING + 28}" font-family="Arial" font-weight="bold" font-size="26" fill="#ffffff">${escaparXML(nombreUsuario)}</text>
      <text x="${PADDING + AVATAR_SIZE + 20 + nombreUsuario.length * 15}" y="${PADDING + 28}" font-family="Arial" font-size="20" fill="#8e8e8e"> ${tiempo}</text>
      <text x="${PADDING + AVATAR_SIZE + 20 + nombreUsuario.length * 15 + 55}" y="${PADDING + 28}" font-family="Arial" font-size="26" fill="#ff3040">♥</text>
      ${textoSVG}
      <text x="${PADDING + AVATAR_SIZE + 20}" y="${H - 20}" font-family="Arial" font-size="20" fill="#8e8e8e" font-weight="bold">Responder</text>
      <text x="${W - 55}" y="${H / 2 - 10}" font-family="Arial" font-size="20" fill="#8e8e8e" text-anchor="middle">♡</text>
      <text x="${W - 55}" y="${H / 2 + 15}" font-family="Arial" font-size="20" fill="#8e8e8e" text-anchor="middle">${likes}</text>
    </svg>
  `;

  const avatarCircular = await sharp(avatarBuffer)
    .resize(AVATAR_SIZE, AVATAR_SIZE)
    .composite([{
      input: Buffer.from(`<svg><circle cx="${AVATAR_SIZE / 2}" cy="${AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}" /></svg>`),
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();

  return await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 26, g: 26, b: 26, alpha: 1 } }
  })
    .composite([
      { input: avatarCircular, top: PADDING, left: PADDING },
      { input: Buffer.from(svgOverlay), top: 0, left: 0 }
    ])
    .jpeg({ quality: 95 })
    .toBuffer();
}

function escaparXML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
