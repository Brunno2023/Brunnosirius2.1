'use strict';

module.exports = {
  commands: ['kick', 'echar', 'sacar', 'ban'],

  async execute({
    sock,
    msg,
    remoteJid,
    mentionedJid,
    isAdmin,
    isBotAdmin
  }) {

    try {

      if (!remoteJid.endsWith('@g.us')) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Este comando solo funciona en grupos'
        }, { quoted: msg });
      }

      if (!isAdmin) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Solo admins pueden usar este comando'
        }, { quoted: msg });
      }

      if (!isBotAdmin) {
        return sock.sendMessage(remoteJid, {
          text: '❌ El bot debe ser admin'
        }, { quoted: msg });
      }

      let user;

      if (mentionedJid && mentionedJid[0]) {
        user = mentionedJid[0];
      }

      else if (
        msg.message?.extendedTextMessage?.contextInfo?.participant
      ) {
        user =
          msg.message.extendedTextMessage.contextInfo.participant;
      }

      if (!user) {
        return sock.sendMessage(remoteJid, {
          text: '❌ Etiqueta o responde a un usuario'
        }, { quoted: msg });
      }

      if (user === sock.user.id) return;

      await sock.groupParticipantsUpdate(
        remoteJid,
        [user],
        'remove'
      );

      await sock.sendMessage(remoteJid, {
        text: '✅ Usuario eliminado'
      }, { quoted: msg });

    } catch (err) {
      console.log(err);

      await sock.sendMessage(remoteJid, {
        text: '❌ Error al expulsar'
      }, { quoted: msg });
    }
  }
};
