'use strict';

module.exports = {
  commands: ['listanum', 'kicknum'],

  async execute({
    sock,
    msg,
    remoteJid,
    args,
    command
  }) {

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
          text: '❌ Solo administradores'
        }, { quoted: msg });
      }

      if (!args[0]) {
        return sock.sendMessage(remoteJid, {
          text: `❌ Ejemplo: .${command} 54`
        }, { quoted: msg });
      }

      if (isNaN(args[0])) {
        return sock.sendMessage(remoteJid, {
          text: '❌ El prefijo debe ser numérico'
        }, { quoted: msg });
      }

      const prefijo =
        args[0].replace(/[+]/g, '');

      const users = metadata.participants
        .map(u => u.id)
        .filter(v =>
          v !== botNumber &&
          v.startsWith(prefijo)
        );

      if (!users.length) {
        return sock.sendMessage(remoteJid, {
          text: `❌ No hay números con prefijo +${prefijo}`
        }, { quoted: msg });
      }

      const numeros = users.map(v =>
        '➤ @' + v.split('@')[0]
      );

      if (command === 'listanum') {

        return sock.sendMessage(remoteJid, {
          text:
`📋 LISTA DE NÚMEROS +${prefijo}

${numeros.join('\n')}`,
          mentions: users
        }, { quoted: msg });
      }

      if (command === 'kicknum') {

        if (!isBotAdmin) {
          return sock.sendMessage(remoteJid, {
            text: '❌ El bot debe ser admin'
          }, { quoted: msg });
        }

        await sock.sendMessage(remoteJid, {
          text:
`⚠️ Eliminando números con prefijo +${prefijo}`
        }, { quoted: msg });

        for (const user of users) {

          try {

            await sock.groupParticipantsUpdate(
              remoteJid,
              [user],
              'remove'
            );

            await new Promise(r =>
              setTimeout(r, 3000)
            );

          } catch (e) {
            console.log(e);
          }
        }

        await sock.sendMessage(remoteJid, {
          text: '✅ Eliminación terminada'
        }, { quoted: msg });
      }

    } catch (err) {

      console.log(err);

      await sock.sendMessage(remoteJid, {
        text: '❌ Error general'
      }, { quoted: msg });
    }
  }
};
