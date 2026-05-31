'use strict';

module.exports = {
  commands: ['listanum', 'kicknum'],

  async execute(ctx) {

    const {
      sock,
      msg,
      remoteJid,
      args,
      command
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

      const users =
        metadata.participants.filter(
          p =>
            p.jid &&
            p.jid !== sock.user.id &&
            p.jid.startsWith(prefijo)
        );

      if (!users.length) {
        return sock.sendMessage(remoteJid, {
          text:
`❌ No hay números con prefijo +${prefijo}`
        }, { quoted: msg });
      }

      const mentions =
        users.map(u => u.jid);

      const numeros =
        users.map(
          u => `➤ @${u.jid.split('@')[0]}`
        );

      if (command === 'listanum') {

        return sock.sendMessage(remoteJid, {
          text:
`╭━━〔 📋 LISTA DE NÚMEROS 〕━━⬣
┃ 🌎 Prefijo: +${prefijo}
┃ 👥 Total: ${users.length}
╰━━━━━━━━━━━━━━━━⬣

${numeros.join('\n')}`,
          mentions
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
`╭━━〔 ⚠️ ELIMINACIÓN MASIVA 〕━━⬣
┃ 🌎 Prefijo: +${prefijo}
┃ 👥 Usuarios: ${users.length}
┃ 🚫 Iniciando expulsión...
╰━━━━━━━━━━━━━━━━⬣`
        }, { quoted: msg });

        let eliminados = 0;

        for (const user of users) {

          try {

            await sock.groupParticipantsUpdate(
              remoteJid,
              [user.jid],
              'remove'
            );

            eliminados++;

            await new Promise(r =>
              setTimeout(r, 3000)
            );

          } catch (e) {
            console.log(e);
          }
        }

        await sock.sendMessage(remoteJid, {
          text:
`╭━━〔 ✅ ELIMINACIÓN COMPLETADA 〕━━⬣
┃ 🚫 Usuarios eliminados: ${eliminados}
┃ 🌎 Prefijo: +${prefijo}
╰━━━━━━━━━━━━━━━━⬣`
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
