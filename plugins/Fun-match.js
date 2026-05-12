'use strict';

// ─── MATEMÁTICAS / MATH ───────────────────────────────────────────────────────
// Comandos: math, mates, matematicas
// Uso: .math <dificultad>
// Solo una pregunta activa por chat a la vez.
// El primero en responder correctamente gana los puntos.

const activeQuestions = new Map(); // chatJid → question

const MODES = {
  noob:       { range: [-3,  3,   -3,  3],   ops: '+-',   time: 15_000, bonus: 30,   label: '😴 Noob'       },
  facil:      { range: [-10, 10,  -10, 10],  ops: '+-',   time: 20_000, bonus: 50,   label: '😊 Fácil'      },
  medio:      { range: [-40, 40,  -20, 20],  ops: '*/+-', time: 30_000, bonus: 200,  label: '🧐 Medio'      },
  dificil:    { range: [-100,100, -70, 70],  ops: '*/+-', time: 40_000, bonus: 500,  label: '😤 Difícil'    },
  extremo:    { range: [-9999,9999,-9999,9999], ops: '*/', time: 45_000, bonus: 2500, label: '🔥 Extremo'   },
  imposible:  { range: [-999999,999999,-999999,999999], ops: '*/', time: 55_000, bonus: 8500, label: '💀 Imposible' }
};

const OPERATORS = { '+': '+', '-': '-', '*': '×', '/': '÷' };

function mention(jid = '') {
  return '@' + jid.split('@')[0];
}

function randomInt(min, max) {
  if (min > max) [min, max] = [max, min];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateQuestion(mode) {
  const cfg = MODES[mode];
  const [a1, a2, b1, b2] = cfg.range;
  const ops = [...new Set(cfg.ops.split(''))];
  const op  = pickRandom(ops);

  let a = randomInt(a1, a2);
  let b = randomInt(b1, b2);

  // Para división: a = resultado, b = divisor, pregunta a*b
  if (op === '/') {
    if (b === 0) b = 1;
    const result = a;
    a = a * b;
    return {
      str:    `${a} ${OPERATORS[op]} ${b}`,
      result: result,
      time:   cfg.time,
      bonus:  cfg.bonus,
      label:  cfg.label
    };
  }

  // eslint-disable-next-line no-new-func
  const result = new Function(`return ${a} ${op} ${b}`)();

  return {
    str:    `${a} ${OPERATORS[op]} ${b}`,
    result: Math.round(result * 1000) / 1000,
    time:   cfg.time,
    bonus:  cfg.bonus,
    label:  cfg.label
  };
}

module.exports = {
  commands: ['math', 'mates', 'matematicas', 'matemáticas'],

  async execute(ctx) {
    const { sock, msg, remoteJid, args } = ctx;

    const modeList = Object.keys(MODES)
      .map(k => `• *.math ${k}* — ${MODES[k].label} (+${MODES[k].bonus} pts, ${MODES[k].time/1000}s)`)
      .join('\n');

    // Sin argumento → ayuda
    if (!args[0]) {
      return sock.sendMessage(remoteJid, {
        text:
`🧮 *MATEMÁTICAS*

Elige una dificultad:
${modeList}

🏆 El primero en responder correctamente gana los puntos.`
      }, { quoted: msg });
    }

    const mode = args[0].toLowerCase();

    if (!(mode in MODES)) {
      return sock.sendMessage(remoteJid, {
        text: `❌ Dificultad inválida.\nOpciones: *${Object.keys(MODES).join(', ')}*`
      }, { quoted: msg });
    }

    // ¿Ya hay pregunta activa en este chat?
    if (activeQuestions.has(remoteJid)) {
      const q = activeQuestions.get(remoteJid);
      return sock.sendMessage(remoteJid, {
        text: `⚠️ Ya hay una pregunta activa en este chat.\n¿Cuánto es *${q.str}*? ⏳`
      }, { quoted: msg });
    }

    // Generar pregunta
    const question = generateQuestion(mode);

    // Guardar en el mapa
    activeQuestions.set(remoteJid, question);

    // Timer para expirar
    question.timer = setTimeout(async () => {
      if (!activeQuestions.has(remoteJid)) return;
      activeQuestions.delete(remoteJid);
      await sock.sendMessage(remoteJid, {
        text:
`⏰ *¡Tiempo!*

La respuesta correcta era: *${question.result}*
Nadie ganó los *${question.bonus} pts* esta vez.`
      });
    }, question.time);

    return sock.sendMessage(remoteJid, {
      text:
`🧮 *MATEMÁTICAS — ${question.label}*

❓ ¿Cuánto es: *${question.str}*?

⏳ Tiempo: *${question.time / 1000}s*
🏆 Premio: *${question.bonus} pts*

_El primero en responder correctamente gana._`
    }, { quoted: msg });
  },

  async onMessage(ctx) {
    const { sock, remoteJid, body, sender, msg } = ctx;

    const question = activeQuestions.get(remoteJid);
    if (!question) return;

    const answer = parseFloat(body.trim().replace(',', '.'));
    if (isNaN(answer)) return;

    if (answer !== question.result) return; // respuesta incorrecta, ignorar

    // ¡Correcto!
    clearTimeout(question.timer);
    activeQuestions.delete(remoteJid);

    return sock.sendMessage(remoteJid, {
      text:
`✅ *¡CORRECTO!*

🏆 ${mention(sender)} respondió *${question.result}* y gana *${question.bonus} pts*!

La pregunta era: *${question.str} = ${question.result}*`,
      mentions: [sender]
    }, { quoted: msg });
  }
};
