'use strict';

const db = require('../lib/database');

module.exports = {
  commands: ['unbanchat'],

  async execute({ sock, remoteJid, msg, isOwner, isAdmin, fromGroup }) {

    // 🔐 Permisos: owner o admin del grupo
    if (!isOwner && (!fromGroup || !isAdmin)) {
      return sock.sendMessage(remoteJid, {
        text: '❌ Solo admins o el owner pueden usar este comando'
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
