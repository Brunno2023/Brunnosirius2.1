'use strict';

const db = require('../lib/database');

const afkCooldown = new Map();

setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, ts] of afkCooldown) {
    if (ts < cutoff) afkCooldown.delete(key);
  }
}, 60_000);

module.exports = {

  async onMessage(ctx) {

    try {

      const {
        sock,
        msg,
        sender,
        remoteJid,
        body
      } = ctx;

      if (!sender) return;

      if (!db.data) db.data = {};
      if (!db.data.users) db.data.users = {};

      if (!db.data.users[sender]) {
        db.data.users[sender] = {
          afk: -1,
          afkReason: ''
        };
      }

      const user = db.data.users[sender];

      const text =
        body ||
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        '';

      const hasMessage =
        !!msg.message?.conversation ||
        !!msg.message?.extendedTextMessage?.text ||
        !!msg.message?.imageMessage ||
        !!msg.message?.videoMessage ||
        !!msg.message?.audioMessage ||
        !!msg.message?.stickerMessage ||
        !!msg.message?.documentMessage;

      if (!hasMessage) return;

      const isCommand    = /^[./#!]/.test(text.trim());
      const isAfkCommand = /^([./#!])afk\b/i.test(text.trim());

      /*
      ─────────────────────────
      QUITAR AFK
      ─────────────────────────
      */

      if (
        !isCommand &&
        !isAfkCommand &&
        typeof user.afk === 'number' &&
        user.afk > 0
      ) {

        const tiempo   = Math.floor((Date.now() - user.afk) / 1000);
        const horas    = Math.floor(tiempo / 3600);
        const minutos  = Math.floor((tiempo % 3600) / 60);
        const segundos = tiempo % 60;

        let textoTiempo = '';
        if (horas)    textoTiempo += `${horas}h `;
        if (minutos)  textoTiempo += `${minutos}m `;
        if (segundos) textoTiempo += `${segundos}s`;

        const reason = user.afkReason || 'Sin razón';

        user.afk = -1;
        user.afkReason = '';

        await sock.sendMessage(remoteJid, {
          text:
`╭━━〔 ☀️ AFK DESACTIVADO 〕━━⬣
┃ 👤 @${sender.split('@')[0]}
┃ 💬 ${reason}
┃ ⏳ ${textoTiempo || '0s'} ausente
╰━━━━━━━━━━━━━━━━⬣`,
          mentions: [sender]
        }, { quoted: msg });

        return;
      }

      /*
      ─────────────────────────
      DETECTAR MENCIONES
      ─────────────────────────
      */

      const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo ||
        msg.message?.documentMessage?.contextInfo ||
        {};

      const mentioned = contextInfo.mentionedJid || [];
      const quoted    = contextInfo.participant;

      const users = [
        ...new Set([
          ...mentioned,
          ...(quoted ? [quoted] : [])
        ])
      ];

      // ✅ Dedup global: evita que Baileys re-dispare el mismo mensaje
      if (msg._afkDone) return;
      msg._afkDone = true;

      for (const jid of users) {

        if (jid === sender) continue;
        if (!db.data.users[jid]) continue;

        const target = db.data.users[jid];
        if (typeof target.afk !== 'number' || target.afk < 0) continue;

        // ✅ Cooldown anti-spam por usuario + chat
        const key = `${jid}:${remoteJid}`;
        const now = Date.now();
        if (afkCooldown.has(key) && now - afkCooldown.get(key) < 60_000) continue;
        afkCooldown.set(key, now);

        const tiempo   = Math.floor((Date.now() - target.afk) / 1000);
        const horas    = Math.floor(tiempo / 3600);
        const minutos  = Math.floor((tiempo % 3600) / 60);
        const segundos = tiempo % 60;

        let textoTiempo = '';
        if (horas)    textoTiempo += `${horas}h `;
        if (minutos)  textoTiempo += `${minutos}m `;
        if (segundos) textoTiempo += `${segundos}s`;

        const reason = target.afkReason || 'Sin razón';

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
      console.log('AFK ERROR:', e);
    }
  }
};
