'use strict';

const db = require('../lib/database');

module.exports = {
  commands: ['unbanchat'],

  async execute({ sock, remoteJid, sender, msg, isOwner }) {

    if (!isOwner) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Solo el owner puede usar este comando'
      }, { quoted: msg });
    }

    if (!db.data) db.data = {};
    if (!db.data.chats) db.data.chats = {};
    if (!db.data.chats[remoteJid]) {
      db.data.chats[remoteJid] = {};
    }

    db.data.chats[remoteJid].isBanned = false;

    await sock.sendMessage(remoteJid, {
      text: '✅ Este chat fue desbaneado correctamente'
    }, { quoted: msg });
  }
};
