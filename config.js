'use strict';

require('dotenv').config();

module.exports = {

  // ─────────────────────────────────────────
  // 👤 OWNER
  // ─────────────────────────────────────────
  owner: [
  '5493884332061',
  '5491130850938',
  '22025364050169',
 '245088567455794'
],

  // ─────────────────────────────────────────
  // 🤖 BOT INFO
  // ─────────────────────────────────────────
  botName    : process.env.BOT_NAME    || 'Brunnobot',
  botVersion : process.env.BOT_VERSION || '1.0.0',
  footer     : process.env.BOT_FOOTER  || 'Brunnobot',

  // ─────────────────────────────────────────
  // ⚙️ PREFIJO (🔥 AQUÍ CONTROLAS TODO)
  // ─────────────────────────────────────────
  prefix: '.',

  // ─────────────────────────────────────────
  // 💾 BASE DE DATOS
  // ─────────────────────────────────────────
  mongoUri: process.env.MONGO_URI || '',
  dbPath  : './lib/database.json',

  // ─────────────────────────────────────────
  // 🔌 CONEXIÓN
  // ─────────────────────────────────────────
  sessionPath   : './session',
  readMessages  : true,
  autoReconnect : true,
  reconnectDelay: 3000,

  // ─────────────────────────────────────────
  // ⚡ OPCIONES EXTRA
  // ─────────────────────────────────────────
  debug: true,
  antiSpam: true,
  maxMessagesPerMinute: 20
};
