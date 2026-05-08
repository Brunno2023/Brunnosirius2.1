'use strict';

const db = require('../lib/database');

module.exports = {
  commands: ['banchat'],
  description: 'Banea el chat',

  async execute({ sock, remoteJid, msg, isOwner, isAdmin, fromGroup }) {

    // 🔐 Permisos: owner o admin del grupo
    if (!isOwner && (!fromGroup || !isAdmin)) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Solo admins o el owner pueden usar este comando'
      }, { quoted: msg });
    }

    // 🧠 asegurar estructura
    if (!db.data) db.data = {};
    if (!db.data.chats) db.data.chats = {};
    if (!db.data.chats[remoteJid]) {
      db.data.chats[remoteJid] = {};
    }

    db.data.chats[remoteJid].isBanned = true;

    await sock.sendMessage(remoteJid, {
      text: '🚫 Este chat fue baneado'
    }, { quoted: msg });
  }
};
