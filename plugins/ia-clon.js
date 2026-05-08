const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

const DB_PATH = path.join(__dirname, '../database/personality.json')

global.personalityDB = global.personalityDB || loadDB()

function loadDB() {
try {
if (fs.existsSync(DB_PATH)) {
return JSON.parse(fs.readFileSync(DB_PATH))
}
} catch (e) {
console.log(e)
}
return {}
}

function saveDB() {
try {
fs.writeFileSync(DB_PATH, JSON.stringify(global.personalityDB, null, 2))
} catch (e) {
console.log(e)
}
}

function cleanText(text = '') {
return text
.replace(/\s+/g, ' ')
.replace(/[^\p{L}\p{N}\s?!.,💀🔥😂🥶😈]/gu, '')
.trim()
}

function analyzeStyle(messages = []) {

const all = messages.join(' ')

const emojis = all.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu) || []

const upper =
(messages.filter(v => v === v.toUpperCase()).length)

const avgLength =
messages.reduce((a, b) => a + b.length, 0) /
(messages.length || 1)

const words = {}

all.split(/\s+/).forEach(word => {

const w = word.toLowerCase()

if (w.length < 3) return

words[w] = (words[w] || 0) + 1

})

const topWords = Object.entries(words)
.sort((a, b) => b[1] - a[1])
.slice(0, 15)
.map(v => v[0])

return {
topWords,
emojis: [...new Set(emojis)].slice(0, 10),
upper,
avgLength
}
}

async function generateAI(style, messages, promptUser) {

const apiKey = 'TU_API_KEY_GEMINI'

const prompt = `
Imita EXACTAMENTE este estilo humano de WhatsApp.

Características:
- Palabras frecuentes: ${style.topWords.join(', ')}
- Emojis usados: ${style.emojis.join(' ')}
- Usa mayúsculas: ${style.upper > 3 ? 'sí' : 'no'}
- Longitud promedio: ${Math.floor(style.avgLength)}

Mensajes reales:
${messages.slice(-25).join('\n')}

Usuario dijo:
"${promptUser}"

RESPONDE como esa persona.
Máximo 2 líneas.
`

try {

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({
contents: [{
parts: [{
text: prompt
}]
}]
})
})

const json = await res.json()

return json?.candidates?.[0]?.content?.parts?.[0]?.text || '...'

} catch (e) {
console.log(e)
return 'Error generando respuesta'
}
}

const handler = async (m, { conn, text, participants }) => {

if (!text) {
return m.reply('Usa:\n.clon @usuario mensaje')
}

const mention = m.mentionedJid?.[0]

if (!mention) {
return m.reply('Etiqueta un usuario')
}

if (!global.personalityDB[mention]) {
return m.reply('No tengo suficientes datos de ese usuario')
}

const userData = global.personalityDB[mention]

const style = analyzeStyle(userData.messages)

await m.react('🧠')

const response = await generateAI(
style,
userData.messages,
text
)

await conn.reply(m.chat, response, m)

}

handler.command = ['clon']
handler.group = true

module.exports = handler

// ===========================
// SISTEMA AUTOMÁTICO PASIVO
// ===========================

global.collectPersonality = async function(m) {

try {

if (!m.text) return
if (m.text.length < 3) return
if (m.fromMe) return

const user = m.sender

if (!global.personalityDB[user]) {
global.personalityDB[user] = {
messages: []
}
}

const arr = global.personalityDB[user].messages

arr.push(cleanText(m.text))

// límite RAM optimizado
if (arr.length > 80) {
arr.shift()
}

// guardado liviano
if (Math.random() < 0.15) {
saveDB()
}

} catch (e) {
console.log(e)
}

}
