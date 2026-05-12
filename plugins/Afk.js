'use strict';

const db = require('../lib/database');

module.exports = {
  commands: ['afk'],

  async execute(ctx) {

    const {
      sock,
      msg,
      remoteJid,
      args,
      sender
    } = ctx;

    try {

      let text = args.join(' ');

      if (!text) {

        const quoted =
          msg.message?.extendedTextMessage
            ?.contextInfo?.quotedMessage;

        const quotedText =
          quoted?.conversation ||
          quoted?.extendedTextMessage?.text;

        if (quotedText) {
          text = quotedText;
        }
      }

      if (!text) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Ejemplo: .afk Estoy ocupado'
        }, { quoted: msg });
      }

      if (text.length < 5) {
        return sock.sendMessage(remoteJid, {
          text: '❌ La razón debe tener mínimo 5 caracteres'
        }, { quoted: msg });
      }

      const user =
        await db.getUser(sender);

      user.afk = Date.now();
      user.afkReason = text;

      await db.save();

      await sock.sendMessage(remoteJid, {
        text:
`╭━━〔 🌙 MODO AFK 〕━━⬣
┃ 👤 Usuario: @${sender.split('@')[0]}
┃ 💬 Razón: ${text}
┃ ⏳ Estado: Ausente
╰━━━━━━━━━━━━━━━━⬣`,
        mentions: [sender]
      }, { quoted: msg });

    } catch (e) {

      console.log(e);

      await sock.sendMessage(remoteJid, {
        text: '❌ Error al activar AFK'
      }, { quoted: msg });
    }
  }
};
