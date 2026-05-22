'use strict';

const sharp = require('sharp');
const axios = require('axios');

module.exports = {
  commands: ['fakeig'],

  async execute({ sock, msg, remoteJid, pushName, config }) {

    // Parsear el mensaje: .fakeig @usuario nombre | comentario
    const body = msg.message?.extendedTextMessage?.text || msg.message?.conversation || '';
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentioned) {
      await sock.sendMessage(remoteJid, { text: '❌ Debes mencionar a alguien.\nEjemplo: .fakeig @persona brunno_03 | Hola esto es un comentario' }, { quoted: msg });
      return;
    }

    const partes = body.split('|');
    if (partes.length < 2) {
      await sock.sendMessage(remoteJid, { text: '❌ Formato incorrecto.\nEjemplo: .fakeig @persona brunno_03 | Hola esto es un comentario' }, { quoted: msg });
      return;
    }

    // Extraer nombre de usuario (entre el @ y el |)
    const antesDelPipe = partes[0];
    const nombreUsuario = antesDelPipe.replace(/\.fakeig\s*/i, '').replace(/@\S+/g, '').trim();
    const comentario = partes[1].trim();

    if (!nombreUsuario) {
      await sock.sendMessage(remoteJid, { text: '❌ Falta el nombre de usuario.\nEjemplo: .fakeig @persona brunno_03 | comentario' }, { quoted: msg });
      return;
    }

    // Obtener foto de perfil
    let avatarBuffer;
    try {
      const ppUrl = await sock.profilePictureUrl(mentioned, 'image');
      const response = await axios.get(ppUrl, { responseType: 'arraybuffer' });
      avatarBuffer = Buffer.from(response.data);
    } catch {
      // Avatar por defecto si no tiene foto
      avatarBuffer = await sharp({
        create: { width: 100, height: 100, channels: 4, background: { r: 80, g: 80, b: 80, alpha: 1 } }
      }).png().toBuffer();
    }

    // Tiempos y likes aleatorios
    const tiempos = ['1 h', '2 h', '4 h', '1 d', '2 d', '4 d', '1 sem'];
    const tiempo = tiempos[Math.floor(Math.random() * tiempos.length)];
    const likes = Math.floor(Math.random() * 200) + 10;

    // Generar imagen
    const imgBuffer = await generarFakeIG({ avatarBuffer, nombreUsuario, comentario, tiempo, likes });

    await sock.sendMessage(remoteJid, { image: imgBuffer, caption: '' }, { quoted: msg });
  }
};

async function generarFakeIG({ avatarBuffer, nombreUsuario, comentario, tiempo, likes }) {
  const sharp = require('sharp');

  const W = 700;
  const PADDING = 20;
  const AVATAR_SIZE = 80;
  const BG_COLOR = '#1a1a1a';
  const TEXT_COLOR = '#ffffff';
  const GRAY_COLOR = '#8e8e8e';
  const FONT_SIZE_NOMBRE = 26;
  const FONT_SIZE_TEXTO = 24;
  const FONT_SIZE_SMALL = 20;

  // Calcular altura según largo del comentario
  const charsPerLine = 38;
  const lineas = Math.ceil(comentario.length / charsPerLine);
  const H = Math.max(160, 60 + AVATAR_SIZE + (lineas * 30) + 60);

  // Wrap del comentario en líneas
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

  // Construir SVG del texto
  const textoY = PADDING + AVATAR_SIZE / 2 - (lineasTexto.length * 30) / 2 + 10;
  let textoSVG = '';
  lineasTexto.forEach((linea, i) => {
    textoSVG += `<text x="${PADDING + AVATAR_SIZE + 20}" y="${textoY + 35 + (i * 30)}" font-family="Arial" font-size="${FONT_SIZE_TEXTO}" fill="${TEXT_COLOR}">${escaparXML(linea)}</text>`;
  });

  const svgOverlay = `
    <svg width="${W}" height="${H}">
      <!-- Nombre + tiempo -->
      <text x="${PADDING + AVATAR_SIZE + 20}" y="${PADDING + 30}" font-family="Arial" font-weight="bold" font-size="${FONT_SIZE_NOMBRE}" fill="${TEXT_COLOR}">${escaparXML(nombreUsuario)}</text>
      <text x="${PADDING + AVATAR_SIZE + 20 + (nombreUsuario.length * 15)}" y="${PADDING + 30}" font-family="Arial" font-size="${FONT_SIZE_SMALL}" fill="${GRAY_COLOR}"> ${tiempo}</text>
      <text x="${PADDING + AVATAR_SIZE + 20 + (nombreUsuario.length * 15) + 55}" y="${PADDING + 30}" font-family="Arial" font-size="${FONT_SIZE_NOMBRE}" fill="#ff3040">♥</text>

      <!-- Comentario -->
      ${textoSVG}

      <!-- Responder -->
      <text x="${PADDING + AVATAR_SIZE + 20}" y="${H - 25}" font-family="Arial" font-size="${FONT_SIZE_SMALL}" fill="${GRAY_COLOR}" font-weight="bold">Responder</text>

      <!-- Likes -->
      <text x="${W - 55}" y="${H / 2 - 10}" font-family="Arial" font-size="${FONT_SIZE_SMALL}" fill="${GRAY_COLOR}" text-anchor="middle">♡</text>
      <text x="${W - 55}" y="${H / 2 + 15}" font-family="Arial" font-size="${FONT_SIZE_SMALL}" fill="${GRAY_COLOR}" text-anchor="middle">${likes}</text>
    </svg>
  `;

  // Avatar circular
  const avatarCircular = await sharp(avatarBuffer)
    .resize(AVATAR_SIZE, AVATAR_SIZE)
    .composite([{
      input: Buffer.from(`<svg><circle cx="${AVATAR_SIZE / 2}" cy="${AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}" /></svg>`),
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();

  // Imagen base oscura
  const base = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 26, g: 26, b: 26, alpha: 1 } }
  })
    .composite([
      { input: avatarCircular, top: PADDING, left: PADDING },
      { input: Buffer.from(svgOverlay), top: 0, left: 0 }
    ])
    .jpeg({ quality: 95 })
    .toBuffer();

  return base;
}

function escaparXML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
