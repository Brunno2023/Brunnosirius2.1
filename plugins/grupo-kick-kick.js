'use strict';

module.exports = {
  commands: ['listanum', 'kicknum'],

  async execute({
    sock,
    msg,
    remoteJid,
    args,
    participants,
    command,
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
          text: '❌ Solo administradores pueden usar este comando'
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

      const prefijo = args[0].replace(/[+]/g, '');

      const users = participants
        .map(u => u.id)
        .filter(v =>
          v !== sock.user.id &&
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
            text: '❌ El bot debe ser administrador'
          }, { quoted: msg });
        }

        await sock.sendMessage(remoteJid, {
          text: `⚠️ Eliminando números con prefijo +${prefijo}`
        }, { quoted: msg });

        for (const user of users) {

          if (user === sock.user.id) continue;

          try {

            await sock.groupParticipantsUpdate(
              remoteJid,
              [user],
              'remove'
            );

            await new Promise(r => setTimeout(r, 3000));

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
