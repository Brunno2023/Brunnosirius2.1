'use strict';

module.exports = {
  commands: ['kick', 'echar', 'sacar', 'ban'],

  async execute(ctx) {

    const {
      sock,
      msg,
      remoteJid
    } = ctx;

    try {

      if (!remoteJid.endsWith('@g.us')) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Solo funciona en grupos'
        }, { quoted: msg });
      }

      const metadata =
        await sock.groupMetadata(remoteJid);

      const senderLid =
        msg.key.participant;

      const senderData =
        metadata.participants.find(
          p =>
            p.id === senderLid ||
            p.lid === senderLid
        );

      const botData =
        metadata.participants.find(
          p =>
            p.jid === sock.user.id ||
            p.jid?.startsWith(
              sock.user.id.split(':')[0]
            )
        );

      const isAdmin =
        senderData?.admin === 'admin' ||
        senderData?.admin === 'superadmin';

      const isBotAdmin =
        botData?.admin === 'admin' ||
        botData?.admin === 'superadmin';

      if (!isAdmin) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Solo admins'
        }, { quoted: msg });
      }

      if (!isBotAdmin) {
        return sock.sendMessage(remoteJid, {
          text: '❌ El bot debe ser admin'
        }, { quoted: msg });
      }

      const mentioned =
        msg.message?.extendedTextMessage
          ?.contextInfo?.mentionedJid?.[0];

      const quoted =
        msg.message?.extendedTextMessage
          ?.contextInfo?.participant;

      const user = mentioned || quoted;

      if (!user) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Etiqueta o responde a alguien'
        }, { quoted: msg });
      }

      const target =
        metadata.participants.find(
          p =>
            p.jid === user ||
            p.id === user ||
            p.lid === user
        );

      if (!target) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Usuario no encontrado'
        }, { quoted: msg });
      }

      if (
        target.jid === sock.user.id ||
        target.jid?.startsWith(
          sock.user.id.split(':')[0]
        )
      ) return;

      await sock.groupParticipantsUpdate(
        remoteJid,
        [target.jid],
        'remove'
      );

      await sock.sendMessage(remoteJid, {
  text:
`╭━━〔 🚫 EXPULSIÓN 〕━━⬣
┃ 👤 Usuario eliminado
┃ 📛 @${target.jid.split('@')[0]}
┃ ⚡ Acción realizada correctamente
╰━━━━━━━━━━━━━━━━⬣`,
  mentions: [target.jid]
}, { quoted: msg });

    } catch (e) {

      console.log(e);

      await sock.sendMessage(remoteJid, {
        text: '❌ Error al expulsar'
      }, { quoted: msg });
    }
  }
};
