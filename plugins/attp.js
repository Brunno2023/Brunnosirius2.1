import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

let handler = async (m, { conn, text, usedPrefix, command }) => {

  if (!text) {
    throw `${mg}𝙀𝙎𝘾𝙍𝙄𝘽𝘼 𝙋𝘼𝙍𝘼 𝙌𝙐𝙀 𝙀𝙇 𝙏𝙀𝙓𝙏𝙊 𝙎𝙀 𝘾𝙊𝙉𝙑𝙄𝙀𝙍𝙏𝘼 𝙀𝙉 𝙎𝙏𝙄𝘾𝙆𝙀𝙍\n\n✳️ Ejemplo:\n*${usedPrefix + command}* Hola Mundo`
  }

  const tempDir = './temp'

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  const id = Date.now()

  const webp = path.join(tempDir, `${id}.webp`)

  // 🔥 AUTO SIZE
  const length = text.length

  let fontSize

  if (length <= 10) fontSize = 70
  else if (length <= 20) fontSize = 60
  else if (length <= 40) fontSize = 50
  else if (length <= 70) fontSize = 40
  else fontSize = 30

  // 🔥 CORTAR TEXTO LARGO
  function breakText(str, max = 12) {
    return str.replace(
      new RegExp(`(.{${max}})`, 'g'),
      '$1\n'
    )
  }

  const formatted = breakText(
    text
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
  )

  // 🔥 RGB COLORS
  const colors = [
    '#ff0000',
    '#ff8800',
    '#ffff00',
    '#00ff00',
    '#00ffff',
    '#0000ff',
    '#ff00ff'
  ]

  const frames = []

  try {

    // 🔥 CREAR FRAMES RGB
    for (let i = 0; i < colors.length; i++) {

      const frame = path.join(
        tempDir,
        `frame_${id}_${i}.png`
      )

      frames.push(frame)

      const cmd = `
      magick -size 512x512 xc:none \
      -gravity center \
      -font DejaVu-Sans-Bold \
      -pointsize ${fontSize} \
      -fill "${colors[i]}" \
      -stroke black \
      -strokewidth 4 \
      -interline-spacing 8 \
      -annotate +0+0 "${formatted}" \
      "${frame}"
      `

      await new Promise((resolve, reject) => {
        exec(cmd, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    // 🔥 UNIR FRAMES A WEBP
    const inputs = frames
      .map(f => `-i "${f}"`)
      .join(' ')

    const ffmpegCmd = `
    ffmpeg -y \
    ${inputs} \
    -filter_complex "concat=n=${frames.length}:v=1:a=0,fps=8,scale=512:512:flags=lanczos" \
    -vcodec libwebp \
    -loop 0 \
    -lossless 0 \
    -compression_level 6 \
    -q:v 50 \
    "${webp}"
    `

    await new Promise((resolve, reject) => {
      exec(ffmpegCmd, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // 🔥 ENVIAR STICKER
    await conn.sendFile(
      m.chat,
      webp,
      'rgb.webp',
      '',
      m,
      { asSticker: true }
    )

  } catch (err) {

    console.log(err)

    throw '❌ Error creando sticker RGB'

  } finally {

    // 🔥 LIMPIAR
    if (fs.existsSync(webp)) {
      fs.unlinkSync(webp)
    }

    frames.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    })
  }
}

handler.command = handler.help = [
  'attp',
  'ttp',
  'ttp2',
  'ttp3',
  'ttp4',
  'ttp5',
  'attp2'
]

handler.tags = ['sticker']

export default handler
