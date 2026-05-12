'use strict';

const db = require('../lib/database');

module.exports = {
  commands: [],

  async execute(ctx) {

    const {
      sock,
      msg,
      sender,
      remoteJid
    } = ctx;

    try {

      if (!db.data) return;
      if (!db.data.users) return;

      const user =
        db.data.users[sender];

      // QUITAR AFK

      if (user && user.afk) {

        const tiempo =
          Math.floor(
            (Date.now() - user.afk) / 1000
          );

        const reason =
          user.afkReason || 'Sin razón';

        user.afk = 0;
        user.afkReason = '';

        await sock.sendMessage(remoteJid, {
          text:
`╭━━〔 ☀️ AFK DESACTIVADO 〕━━⬣
┃ 👤 @${sender.split('@')[0]}
┃ 💬 ${reason}
┃ ⏳ ${tiempo}s ausente
╰━━━━━━━━━━━━━━━━⬣`,
          mentions: [sender]
        }, { quoted: msg });
      }

      // DETECTAR MENCIONES

      const mentioned =
        msg.message?.extendedTextMessage
          ?.contextInfo?.mentionedJid || [];

      const quoted =
        msg.message?.extendedTextMessage
          ?.contextInfo?.participant;

      const users =
        [...new Set([
          ...mentioned,
          ...(quoted ? [quoted] : [])
        ])];

      for (const jid of users) {

        const target =
          db.data.users[jid];

        if (!target) continue;
        if (!target.afk) continue;

        const tiempo =
          Math.floor(
            (Date.now() - target.afk) / 1000
          );

        const reason =
          target.afkReason || 'Sin razón';

        await sock.sendMessage(remoteJid, {
          text:
`╭━━〔 🌙 USUARIO AFK 〕━━⬣
┃ 👤 @${jid.split('@')[0]}
┃ 💬 ${reason}
┃ ⏳ ${tiempo}s ausente
╰━━━━━━━━━━━━━━━━⬣`,
          mentions: [jid]
        }, { quoted: msg });
      }

    } catch (e) {
      console.log(e);
    }
  }
};
