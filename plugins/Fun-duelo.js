'use strict';

const db = require('../lib/database');

let events = null;
try {
  events = require('../lib/events');
} catch {}

const pendingDuels = new Map();
const cooldowns = new Map();

const ACCEPT_TIME = 60 * 1000;
const COOLDOWN = 5 * 60 * 1000;
const ATTACK_DELAY = 10 * 1000;

const attacks = [
  '🥊 lanzó una patada voladora',
  '🩴 tiró una chancla legendaria',
  '🗡️ usó un combo prohibido',
  '🍵 invocó el poder del emoliente',
  '🪑 atacó con una silla oxidada',
  '🥷 hizo un golpe ninja',
  '🍛 tiró arroz con pollo hirviendo',
  '🔥 activó modo barrio',
  '⚔️ sacó una espada imaginaria',
  '👁️ usó mirada intimidante',
  '🥖 lanzó un pan con palta',
  '💬 atacó con insulto crítico',
  '🕺 hizo un baile confuso',
  '🌌 sacó poderes de anime',
  '👵 invocó a su tía molesta',
  '📶 usó el WiFi del vecino como arma',
  '🪨 lanzó una piedra emocional',
  '🎒 pegó con una mochila llena',
  '💡 atacó con factura de luz',
  '🚌 hizo técnica secreta de combi',
  // ── nuevos ──
  '🧃 lanzó un jugo de caja caducado',
  '🐔 invocó el espíritu del pollo a la brasa',
  '📱 mandó cadena de WhatsApp como proyectil',
  '🧻 atacó con rollo de papel higiénico del 2020',
  '🫙 tiró mayonesa industrial en la cara',
  '👟 hizo el clásico zapatillazo de mamá',
  '🎤 soltó freestyle destructor de autoestima',
  '🕵️ usó técnica del vecino chismoso',
  '🧲 activó el poder del imán de mala suerte',
  '🦆 invocó al pato de la mala vibra',
  '📣 gritó tan fuerte que cayó la señal',
  '🫀 atacó con fuerza del desamor acumulado',
  '🧿 lanzó mal de ojo concentrado',
  '🥴 hizo cara de no entender nada y confundió al rival',
  '🍌 resbaló al rival con cáscara estratégica',
  '🎲 usó suerte de juego de parqués como arma',
  '🪣 tiró un balde de agua fría emocionalmente',
  '🧦 atacó con calcetín usado de tres días',
  '🗑️ invocó el poder del cubo de la basura lleno',
  '🪠 sacó el desatascador de baño como lanza',
];

const dodgeActions = [
  'se agachó justo a tiempo',
  'lo esquivó como Ultra Instinto',
  'saltó hacia atrás con estilo',
  'se escondió detrás de una tapa de olla',
  'lo evitó corriendo como de la Sunat',
  'se tiró al piso dramáticamente',
  'hizo una maniobra de mototaxi',
  'desapareció por puro lag',
  'bloqueó con una mochila',
  'se movió como NPC bugueado',
  // ── nuevos ──
  'se hizo el dormido y lo ignoró',
  'mandó a su prima a recibir el golpe',
  'abrió el paraguas justo a tiempo',
  'se escondió detrás de un poste',
  'fingió un calambre y esquivó por error',
  'se distrajo y el golpe pasó rozando',
  'lo bloqueó con la biblia de la abuela',
  'dijo "espera" y el rival se detuvo',
  'cayó al piso antes del
