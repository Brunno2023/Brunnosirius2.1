'use strict';

module.exports = {
  commands: ['eliminar', 'delete', 'del'],

  async execute({ sock, msg, remoteJid, fromGroup, isBotAdmin, isAdmin }) {
    if (!fromGroup) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Este comando solo funciona en grupos.'
      }, { quoted: msg });
    }

    if (!isAdmin) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Solo los admins pueden usar este comando.'
      }, { quoted: msg });
    }

    if (!isBotAdmin) {
      return sock.sendMessage(remoteJid, {
        text: '❌ El bot necesita ser admin para eliminar mensajes.'
      }, { quoted: msg });
    }

    const quoted = msg.message?.extendedTextMessage?.contextInfo;

    if (!quoted?.stanzaId) {
      return sock.sendMessage(remoteJid, {
        text: '↩️ Responde al mensaje que quieres eliminar.'
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(remoteJid, {
        delete: {
          remoteJid,
          fromMe: false,
          id: quoted.stanzaId,
          participant: quoted.participant
        }
      });
    } catch {
      await sock.sendMessage(remoteJid, {
        text: '❌ No se pudo eliminar el mensaje.'
      }, { quoted: msg });
    }
  }
};
