'use strict';

const db = require('../lib/database');

function cleanJid(jid = '') {
  return String(jid)
    .split(':')[0]
    .replace(/@lid/g, '')
    .replace(/@s\.whatsapp\.net/g, '')
    .replace(/@g\.us/g, '');
}

module.exports = {
  commands: ['addxp'],
  description: 'Añadir XP a un usuario (Owner)',

  async execute(ctx) {
    const {
      sock,
      remoteJid,
      msg,
      args,
      isOwner
    } = ctx;

    if (!isOwner) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Solo el owner puede usar este comando.'
      }, { quoted: msg });
    }

    let target;

    // Respuesta
    if (
      msg.message?.extendedTextMessage
        ?.contextInfo?.participant
    ) {

      target =
        msg.message
          .extendedTextMessage
          .contextInfo
          .participant;
    }

    // Mención
    else if (
      msg.message?.extendedTextMessage
        ?.contextInfo?.mentionedJid?.length
    ) {

      target =
        msg.message
          .extendedTextMessage
          .contextInfo
          .mentionedJid[0];
    }

    if (!target) {
      return sock.sendMessage(remoteJid, {
        text:
          '❌ Debes mencionar o responder a alguien.'
      }, { quoted: msg });
    }

    target = cleanJid(target);

    const amount = parseInt(
      args.find(a => /^\d+$/.test(a))
    );

    if (!amount || amount <= 0) {

      return sock.sendMessage(remoteJid, {
        text:
`❌ Debes indicar una cantidad válida.

Ejemplo:
.addxp @usuario 1000`
      }, { quoted: msg });
    }

    const userId = target.split('@')[0];

await db.addXP(userId, amount);

    const user =
      await db.getUser(target);

    const number =
      target.split('@')[0];

    await sock.sendMessage(remoteJid, {
      text:
`✅ XP añadida correctamente

👤 Usuario: @${number}
⭐ XP actual: ${user.xp}
📈 Nivel actual: ${user.level}`,
      mentions: [target]
    }, { quoted: msg });
  }
};
