'use strict';

const db = require('../lib/database');

module.exports = {
  commands: ['banchat'],
  description: 'Banea el chat',

  async execute(ctx) {
    const { sock, remoteJid, sender, msg } = ctx;

    // ⚠️ opcional: restringir a owner
    const owner = 'TU_NUMERO@s.whatsapp.net';
    if (sender !== owner) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Solo el owner puede usar este comando'
      }, { quoted: msg });
    }

    // 🧠 asegurar estructura
    if (!db.data.chats) db.data.chats = {};
    if (!db.data.chats[remoteJid]) {
      db.data.chats[remoteJid] = {};
    }

    db.data.chats[remoteJid].isBanned = true;

    await sock.sendMessage(remoteJid, {
      text: '│‼️│THIS CHAT WAS SUCCESSFULLY BANNED🗝'
    }, { quoted: msg });
  }
};
