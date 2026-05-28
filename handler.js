'use strict';

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const config = require('./config');
const db = require('./lib/database');

const {
  getBody,
  detectPrefix
} = require('./lib/utils');

/* ─────────────────────────────
   👤 NORMALIZADOR
───────────────────────────── */
function normalize(jid = '') {
  return String(jid)
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '');
}

/* ─────────────────────────────
   PLUGINS
───────────────────────────── */
const plugins = new Map();
const messagePlugins = [];

function loadPlugins() {

  const dir = path.join(process.cwd(), 'plugins');

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'));

  plugins.clear();
  messagePlugins.length = 0;

  for (const file of files) {

    try {

      const filepath = path.join(dir, file);

      delete require.cache[
        require.resolve(filepath)
      ];

      const plugin = require(filepath);

      if (typeof plugin.onMessage === 'function') {
        messagePlugins.push({
          ...plugin,
          file
        });
      }

      if (typeof plugin.execute === 'function') {

        const cmds = plugin.commands || [];

        for (const cmd of cmds) {
          plugins.set(
            cmd.toLowerCase(),
            plugin
          );
        }
      }

    } catch (e) {

      console.log(
        chalk.red(`❌ Plugin error ${file}:`),
        e.message
      );
    }
  }

  console.log(
    chalk.green(`✔ Plugins cargados: ${plugins.size}`)
  );
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

    if (
      !remoteJid ||
      remoteJid === 'status@broadcast'
    ) return;

    const fromGroup =
      remoteJid.endsWith('@g.us');

    /* ─────────────────────────────
       🔥 FIX DEFINITIVO OWNER
    ───────────────────────────── */
    let sender;

    if (fromGroup) {

      sender =
        key.participantPn ||
        key.participantAlt ||
        key.participant ||
        msg.participant ||
        remoteJid;

    } else {

      sender =
        key.remoteJidAlt ||
        key.remoteJid;
    }

    const body = getBody(msg);

    /* ─────────────────────────────
       👤 OWNER
    ───────────────────────────── */
    const senderNumber =
      normalize(sender);

    const ownerNumbers =
      (config.owner || [])
      .map(normalize);

    const isOwner =
      ownerNumbers.includes(senderNumber);

    /* ─────────────────────────────
       DEBUG
    ───────────────────────────── */
    if (config.debug) {

      console.log(
        chalk.yellow('\n╔════ OWNER DEBUG ════╗')
      );

      console.log(
        'sender            :',
        sender
      );

      console.log(
        'senderNumber      :',
        senderNumber
      );

      console.log(
        'ownerNumbers      :',
        ownerNumbers
      );

      console.log(
        'isOwner           :',
        isOwner
      );

      console.log('\n📦 RAW');

      console.log(
        'participant        :',
        key.participant
      );

      console.log(
        'participantAlt     :',
        key.participantAlt
      );

      console.log(
        'participantPn      :',
        key.participantPn
      );

      console.log(
        'remoteJid          :',
        key.remoteJid
      );

      console.log(
        'remoteJidAlt       :',
        key.remoteJidAlt
      );

      console.log(
        '╚══════════════════╝\n'
      );
    }

    /* ─────────────────────────────
       ON MESSAGE
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
              {
                text: String(t)
              },
              {
                quoted: msg
              }
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
       COMMAND PARSER
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

    const plugin =
      plugins.get(command);

    if (!plugin) return;

    /* ─────────────────────────────
       BAN CHECK
    ───────────────────────────── */
    if (!isOwner) {

      const banned =
        await db.isBanned(senderNumber);

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
       EXECUTE
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
      err
    );
  }
}

module.exports = {
  messageHandler,
  loadPlugins,
  plugins,
  messagePlugins
};
