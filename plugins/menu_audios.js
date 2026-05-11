case 'menuaudios':
case 'audiomenu':
case 'menud':
case 'menuaudio': {

const texto = `
╭━━〔 🎵 MENU AUDIOS 🎵 〕━━⬣

➤ hola
➤ autoestima
➤ tetas
➤ añanin
➤ chao
➤ pelear
➤ coger
➤ viernes
➤ abrigate
➤ bot
➤ siu
➤ noche
➤ sexo
➤ linda
➤ alok
➤ importa
➤ piropo
➤ buenos
➤ homero
➤ plata
➤ goku

╭━━〔 🔥 FRASES 🔥 〕━━⬣

➤ tu no mete
➤ rockstar
➤ telepatia
➤ elmo
➤ tarea
➤ fanatica
➤ me voy
➤ sexo1
➤ gordo
➤ broma
➤ monte
➤ porro
➤ palo
➤ inutil
➤ doxean
➤ no es jueves
➤ machista
➤ bruyne
➤ hacelo
➤ jejeje

╰━━━━━━━━━━━━━━⬣
`;

await sock.sendMessage(remoteJid, {
  text: texto
}, { quoted: msg });

}
break;
