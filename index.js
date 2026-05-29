'use strict';

require('dotenv').config();

const chalk    = require('chalk');
const figlet   = require('figlet');
const readline = require('readline');
const path     = require('path');
const fs       = require('fs');

const config = require('./config');

// ─── 1. PROCESS GUARD PRO ────────────────────────────────────────────────────
process.on('uncaughtException',  err => console.log(chalk.red('💥 Uncaught Exception:'),  err?.stack || err));
process.on('unhandledRejection', err => console.log(chalk.red('💥 Unhandled Rejection:'), err?.stack || err));
process.on('warning',            w   => console.log(chalk.yellow('⚠️  Warning:'), w.name, w.message));

// ─── 2. GC INTELIGENTE (solo si heap > 200 MB) ───────────────────────────────
setInterval(() => {
  if (global.gc && process.memoryUsage().heapUsed > 200 * 1024 * 1024) {
    global.gc();
  }
}, 120_000);

// ─── 3. MAPS UNIFICADOS + LIMPIEZA ÚNICA (1 interval, menos CPU) ─────────────
const processedMessages = new Map();
const userCooldown      = new Map();

function cleanMap(map, ttl) {
  const now = Date.now();
  for (const [k, v] of map) {
    if (now - v > ttl) map.delete(k);
  }
}

// Un solo interval para ambos maps → menos timers en el event loop
setInterval(() => {
  cleanMap(processedMessages, 60_000);
  cleanMap(userCooldown,      10_000);
}, 60_000);

// ─── 4. COOLDOWN GLOBAL ──────────────────────────────────────────────────────
global.checkCooldown = function (id) {
  const now  = Date.now();
  const last = userCooldown.get(id);
  if (last && now - last < 800) return false;
  userCooldown.set(id, now);
  return true;
};

// ─── 5. QUEUE CON LÍMITE + DELAY ANTI-CPU ────────────────────────────────────
const MAX_QUEUE = 50;
const queue     = [];
let   processing = false;

async function runQueue() {
  if (processing) return;
  processing = true;

  while (queue.length) {
    const job = queue.shift();
    try {
      await job();
      // Pequeña pausa entre jobs → cede CPU a otros procesos de Android
      await new Promise(r => setTimeout(r, 50));
    } catch (e) {
      console.log(chalk.red('Queue error:'), e?.message || e);
    }
  }

  processing = false;
}

global.enqueue = (fn) => {
  if (queue.length >= MAX_QUEUE) return; // descarta si hay overflow
  queue.push(fn);
  runQueue();
};

// ─── 6. MODO LOW POWER ───────────────────────────────────────────────────────
const LOW_POWER = process.env.LOW_POWER === 'true';
global.LOW_POWER       = LOW_POWER;
global.PLUGIN_TIMEOUT  = LOW_POWER ? 15_000 : 30_000;

// ─── 7. DEBUG REAL LOW CPU (10%, no 20%) ─────────────────────────────────────
global.debugLog = (...args) => {
  if (config.debug && Math.random() < 0.1) console.log(...args);
};

// ─── 8. BANNER (figlet solo si NO es sesión remota) ──────────────────────────
function showBanner() {
  // En SSH/tmux sin TTY real el console.clear rompe el buffer → lo saltamos
  if (process.stdout.isTTY) console.clear();

  const botName = config.botName || 'BrunnoBot';

  if (process.stdout.isTTY) {
    figlet.textSync(botName, { font: 'Big' })
      .split('\n')
      .forEach(l => console.log(chalk.cyan.bold(l)));
    console.log('');
  }

  console.log(chalk.gray('  ─────────────────────────────────────────'));
  console.log(chalk.white('  🤖 Bot     : ') + chalk.green(botName));
  console.log(chalk.white('  📦 Versión : ') + chalk.yellow(config.botVersion  || '1.0.0'));
  console.log(chalk.white('  ⚙️  Prefijo : ') + chalk.yellow(config.prefix      || '.'));
  if (LOW_POWER)
    console.log(chalk.white('  ⚡ Modo    : ') + chalk.yellow('LOW POWER'));
  console.log(chalk.gray('  ─────────────────────────────────────────\n'));
}

// ─── UI / READLINE ───────────────────────────────────────────────────────────
function createRL() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, a => resolve(a.trim())));
}

function hasSavedSession() {
  const dir = path.resolve(process.cwd(), config.sessionPath || './session');
  return fs.existsSync(path.join(dir, 'creds.json'));
}

async function askConnectionMethod() {
  if (hasSavedSession()) {
    console.log(chalk.green('  ✅ Sesión encontrada. Conectando automáticamente...\n'));
    return { method: 'saved', phone: null };
  }

  const rl = createRL();

  console.log(chalk.cyan('  ¿Cómo deseas conectar WhatsApp?\n'));
  console.log(chalk.white('  [1] QR'));
  console.log(chalk.white('  [2] Código con número\n'));

  let choice = '';
  while (!['1', '2'].includes(choice)) {
    choice = await ask(rl, chalk.yellow('  → Opción: '));
  }

  if (choice === '1') { rl.close(); return { method: 'qr', phone: null }; }

  const defaultPhone = process.env.DEFAULT_PHONE || config.owner?.[0] || '';
  if (defaultPhone) console.log(chalk.gray('\n  Número por defecto: ' + defaultPhone));

  let phone = await ask(rl, chalk.yellow('  → Presiona ENTER o escribe el número con código de país: '));

  if (!phone) phone = defaultPhone;
  phone = String(phone).replace(/\D/g, '');
  rl.close();

  if (!phone) {
    console.log(chalk.red('\n  ❌ No ingresaste ningún número.\n'));
    process.exit(1);
  }

  return { method: 'code', phone };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  showBanner();

  const { method, phone } = await askConnectionMethod();

  console.log(chalk.cyan('  🚀 Iniciando conexión...\n'));

  try {
    const { startBot } = require('./main');
    await startBot({ method, phone });
  } catch (e) {
    console.error(chalk.red('❌ Error al iniciar el bot:'), e?.message || e);
    process.exit(1);
  }
}

main();
