const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

const DB_PATH = path.join(process.cwd(), 'database/personality.json')

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
}

if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, '{}')
}

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH))
  } catch {
    return {}
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data))
}

function clean(text = '') {
  return String(text).trim()
}

function random(arr = []) {
  return arr[Math.floor(Math.random() * arr.length)]
}

module.exports = {

  commands: ['clon'],

  onMessage: async ({ body, sender }) => {

    try {

      if (!body || body.length < 4) return

      const db = loadDB()

      if (!db[sender]) {
        db[sender] = {
          messages: []
        }
      }

      db[sender].messages.push(clean(body))

      if (db[sender].messages.length > 50) {
        db[sender].messages.shift()
      }

      if (Math.random() < 0.05) {
        saveDB(db)
      }

    } catch (e) {
      console.log(e)
    }
  },

  execute: async ({
    sock,
    msg,
    args,
    remoteJid
  }) => {

    try {

      const mention =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

      if (!mention) {
        return sock.sendMessage(remoteJid, {
          text: 'Etiqueta un usuario'
        }, { quoted: msg })
      }

      const prompt = args.slice(1).join(' ')

      if (!prompt) {
        return sock.sendMessage(remoteJid, {
          text: '.clon @usuario mensaje'
        }, { quoted: msg })
      }

      const db = loadDB()

      if (!db[mention]) {
        return sock.sendMessage(remoteJid, {
          text: 'No tengo datos suficientes'
        }, { quoted: msg })
      }

      const messages = db[mention].messages.slice(-20).join('\n')

      const apiKey = 'AIzaSyAF9rla64VZQ4n9a0G8F4PwOQYmrWxYDRw'

      const promptAI = `
Imita exactamente esta personalidad de WhatsApp.

Mensajes reales:
${messages}

Usuario:
${prompt}

Responde igual que esa persona.
`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: promptAI
              }]
            }]
          })
        }
      )

      const json = await res.json()

      const response =
        json?.candidates?.[0]?.content?.parts?.[0]?.text || '...'

      await sock.sendMessage(remoteJid, {
        text: response
      }, { quoted: msg })

    } catch (e) {

      console.log(e)

      await sock.sendMessage(remoteJid, {
        text: 'Error IA'
      }, { quoted: msg })

    }
  }
}
