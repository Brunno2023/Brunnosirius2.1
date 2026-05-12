'use strict';

const db = require('../lib/database');

module.exports = {

  async onMessage({
    sock,
    msg,
    sender,
    remoteJid
  }) {

    try {

      if (!db.data) return;
      if (!db.data.users) return;

      const user =
        db.data.users[sender];

      /*
      ─────────────────────────
      QUITAR AFK
      ─────────────────────────
      */

      if (
        user &&
        typeof user.afk === 'number' &&
        user.afk > 0
      ) {

        const tiempo =
          Math.floor(
            (Date.now() - user.afk) / 1000
          );

        const horas =
          Math.floor(tiempo / 3600);

        const minutos =
          Math.floor((tiempo % 3600) / 60);

        const segundos =
          tiempo % 60;

        let textoTiempo = '';

        if (horas)
          textoTiempo += `${horas}h `;

        if (minutos)
          textoTiempo += `${minutos}m `;

        if (segundos)
          textoTiempo += `${segundos}s`;

        const reason =
          user.afkReason || 'Sin razón';

        user.afk = -1;
        user.afkReason = '';

        await db.save();

        await sock.sendMessage(remoteJid, {
          text:
`╭━━〔 ☀️ AFK DESACTIVADO 〕━━⬣
┃ 👤 @${sender.split('@')[0]}
┃ 💬 ${reason}
┃ ⏳ ${textoTiempo || '0s'} ausente
╰━━━━━━━━━━━━━━━━⬣`,
          mentions: [sender]
        }, { quoted: msg });
      }

      /*
      ─────────────────────────
      DETECTAR MENCIONES
      ─────────────────────────
      */

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

        if (jid === sender) continue;

        const target =
          db.data.users[jid];

        if (!target) continue;

        if (
          typeof target.afk !== 'number' ||
          target.afk < 0
        ) continue;

        const tiempo =
          Math.floor(
            (Date.now() - target.afk) / 1000
          );

        const horas =
          Math.floor(tiempo / 3600);

        const minutos =
          Math.floor((tiempo % 3600) / 60);

        const segundos =
          tiempo % 60;

        let textoTiempo = '';

        if (horas)
          textoTiempo += `${horas}h `;

        if (minutos)
          textoTiempo += `${minutos}m `;

        if (segundos)
          textoTiempo += `${segundos}s`;

        const reason =
          target.afkReason || 'Sin razón';

        await sock.sendMessage(remoteJid, {
          text:
`╭━━〔 🌙 USUARIO AFK 〕━━⬣
┃ 👤 @${jid.split('@')[0]}
┃ 💬 ${reason}
┃ ⏳ ${textoTiempo || '0s'} ausente
╰━━━━━━━━━━━━━━━━⬣`,
          mentions: [jid]
        }, { quoted: msg });
      }

    } catch (e) {
      console.log(e);
    }
  }
};
