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

      const metadata = await sock.groupMetadata(remoteJid);

      const sender =
        msg.key.participant || msg.key.remoteJid;

      const botNumber =
        sock.user.id.split(':')[0] + '@s.whatsapp.net';

      const senderData =
        metadata.participants.find(
          p => p.id === sender
        );

      const botData =
        metadata.participants.find(
          p => p.id === botNumber
        );

      const isAdmin = !!senderData?.admin;
      const isBotAdmin = !!botData?.admin;

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
        msg.message?.extendedTextMessage?.contextInfo
          ?.mentionedJid?.[0];

      const quoted =
        msg.message?.extendedTextMessage?.contextInfo
          ?.participant;

      const user = mentioned || quoted;

      if (!user) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Etiqueta o responde a alguien'
        }, { quoted: msg });
      }

      if (user === botNumber) return;

      await sock.groupParticipantsUpdate(
        remoteJid,
        [user],
        'remove'
      );

      await sock.sendMessage(remoteJid, {
        text: '✅ Usuario eliminado'
      }, { quoted: msg });

    } catch (e) {

      console.log(e);

      await sock.sendMessage(remoteJid, {
        text: '❌ Error al expulsar'
      }, { quoted: msg });
    }
  }
};
