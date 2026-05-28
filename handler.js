'use strict';

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const config = require('./config');
const db = require('./lib/database');

const {
  getBody,
  normalizeJid,
  detectPrefix,
  getGroupAdmins
} = require('./lib/utils');

/* ─────────────────────────────
   👤 SENDER NORMALIZADOR
───────────────────────────── */
function normalize(jid = '') {
  return String(jid)
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '');
}

/* ─────────────────────────────
   PLUGINS (SIN CAMBIOS)
───────────────────────────── */
const plugins = new Map();
const messagePlugins = [];

function loadPlugins() {
  const dir = path.join(process.cwd(), 'plugins');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

  plugins.clear();
  messagePlugins.length = 0;

  for (const file of files) {
    try {
      const filepath = path.join(dir, file);
      delete require.cache[require.resolve(filepath)];

      const plugin = require(filepath);

      if (typeof plugin.onMessage === 'function') {
        messagePlugins.push({ ...plugin, file });
      }

      if (typeof plugin.execute === 'function') {
        const cmds = plugin.commands || [];

        for (const cmd of cmds) {
          plugins.set(cmd.toLowerCase(), plugin);
        }
      }

    } catch (e) {
      console.log(chalk.red(`❌ Plugin error ${file}:`), e.message);
    }
  }

  console.log(chalk.green(`✔ Plugins cargados: ${plugins.size}`));
}

global.loadPlugins = loadPlugins;
loadPlugins();

/* ─────────────────────────────
   MAIN HANDLER
───────────────────────────── */
async function messageHandler(sock, msg, store = {}) {
  try {
    if (!msg?.message) return;

    const key = msg.key || {};
    const remoteJid = key.remoteJid;

    if (!remoteJid || remoteJid === 'status@broadcast') return;

    const fromGroup = remoteJid.endsWith('@g.us');

    /* ─────────────────────────────
       🔥 FIX OWNER LID
    ───────────────────────────── */
    let sender = fromGroup
      ? (
          key.participantAlt ||
          key.participant ||
          msg.participant ||
          remoteJid
        )
      : (
          key.remoteJidAlt ||
          key.remoteJid
        );

    const body = getBody(msg);

    /* ─────────────────────────────
       👤 NORMALIZADO FINAL
    ───────────────────────────── */
    const senderNumber = normalize(sender);

    const ownerNumbers = (config.owner || []).map(normalize);

    const isOwner = ownerNumbers.includes(senderNumber);

    const botJid = normalize(sock.user?.id || '');

    /* ─────────────────────────────
       🧠 OWNER DEBUG PRO
    ───────────────────────────── */
    if (config.debug) {

      let reason = 'OK';

      if (!sender) {
        reason = '❌ sender undefined';
      } else if (!senderNumber) {
        reason = '❌ senderNumber vacío';
      } else if (!ownerNumbers.length) {
        reason = '❌ config.owner vacío';
      } else if (!ownerNumbers.includes(senderNumber)) {
        reason = '❌ NO coincide con owner';
      }

      console.log(
        chalk.yellow('\n╔════ OWNER DEBUG PRO ════╗')
      );

      console.log('RAW SENDER       :', sender);
      console.log('CLEAN SENDER     :', senderNumber);
      console.log('OWNERS           :', ownerNumbers);
      console.log('IS OWNER         :', isOwner);
      console.log('REASON           :', reason);

      console.log('\n📦 BAILEYS DATA');
      console.log('participant      :', key.participant);
      console.log('participantAlt   :', key.participantAlt);
      console.log('remoteJid        :', key.remoteJid);
      console.log('remoteJidAlt     :', key.remoteJidAlt);

      console.log(
        '╚═════════════════════════\n'
      );
    }

    /* ─────────────────────────────
       🧩 ONMESSAGE PLUGINS
    ───────────────────────────── */
    for (const plugin of messagePlugins) {
      try {

        await plugin.onMessage?.({
          sock,
          msg,
          sender: senderNumber,
          remoteJid,
          body,
          isOwner,

          reply: (t) =>
            sock.sendMessage(
              remoteJid,
              { text: String(t) },
              { quoted: msg }
            )
        });

      } catch (e) {
        console.log(
          chalk.red('onMessage error:'),
          e.message
        );
      }
    }

    if (!body) return;

    /* ─────────────────────────────
       ⚡ COMMAND PARSER
    ───────────────────────────── */
    const parsed = detectPrefix(
      body,
      config.prefix
    );

    if (!parsed) return;

    const args = parsed.body
      .trim()
      .split(/\s+/);

    const command = args
      .shift()
      ?.toLowerCase();

    const plugin = plugins.get(command);

    if (!plugin) return;

    /* ─────────────────────────────
       🚫 BAN CHECK
    ───────────────────────────── */
    if (!isOwner) {

      const banned = await db.isBanned(
        senderNumber
      );

      if (banned) {

        return sock.sendMessage(
          remoteJid,
          {
            text: '🚫 Estás baneado del bot'
          },
          {
            quoted: msg
          }
        );
      }
    }

    /* ─────────────────────────────
       🚀 EXECUTE
    ───────────────────────────── */
    await plugin.execute?.({

      sock,
      msg,

      sender: senderNumber,

      remoteJid,
      body,
      args,
      command,
      isOwner,

      reply: (t) =>
        sock.sendMessage(
          remoteJid,
          {
            text: String(t)
          },
          {
            quoted: msg
          }
        )
    });

  } catch (err) {

    console.log(
      chalk.red('❌ Handler error:'),
      err.message
    );
  }
}

module.exports = {
  messageHandler,
  loadPlugins,
  plugins,
  messagePlugins
};
