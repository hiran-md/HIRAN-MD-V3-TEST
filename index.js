const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@adiwajshing/baileys');
const axios = require('axios');
const fs = require('fs');
const { sessionId, sessionFile, botName } = require('./config.js');
const settings = require('./settings.js');

// Use multi-file authentication state (recommended for newer versions)
const { state, saveCreds } = useMultiFileAuthState('./session'); // This will store the session in the './session' folder

// Initialize the connection with WhatsApp
const conn = makeWASocket({
  auth: state, // Pass the entire state which will include the credentials (creds)
  printQRInTerminal: true,  // This will print the QR code in the terminal
});

conn.ev.on('connection.update', (update) => {
  const { connection, lastDisconnect } = update;
  if (connection === 'open') {
    console.log('Bot is connected to WhatsApp using the pre-generated session.');
    saveCreds();  // Save session credentials after connecting
  }

  if (connection === 'close') {
    const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
    if (shouldReconnect) {
      conn.connect();  // Reconnect if not logged out
    }
  }
});

// Send welcome menu when the bot starts
async function sendMenu(jid) {
  const menuMessage = {
    text: settings.menu.welcomeMessage,
    buttons: [
      { buttonId: 'button_movie', buttonText: { displayText: 'Movie Download' }, type: 1 },
      { buttonId: 'button_yt', buttonText: { displayText: 'YouTube Search' }, type: 1 },
      { buttonId: 'button_alive', buttonText: { displayText: 'Bot Alive' }, type: 1 },
      { buttonId: 'button_system', buttonText: { displayText: 'System Info' }, type: 1 }
    ],
    footer: settings.footerText,
  };
  await conn.sendMessage(jid, menuMessage);
}

// Function to search for movies
async function searchMovie(query) {
  const response = await axios.get(`${settings.downloadSettings.movieApi}${query}`);
  const data = response.data;
  if (data.data && data.data.length > 0) {
    const movie = data.data[0];
    const title = movie.title;
    const downloadLink = movie.download;
    return `Found movie: *${title}*\nDownload Link: ${downloadLink}`;
  } else {
    return "No results found for your search.";
  }
}

// Handling incoming messages
conn.ev.on('messages.upsert', async (m) => {
  const message = m.messages[0];
  const messageText = message.message.conversation || message.message.extendedTextMessage.text;
  const jid = message.key.remoteJid;

  if (messageText) {
    const command = messageText.trim().split(' ')[0].toLowerCase();
    const query = messageText.trim().split(' ').slice(1).join(' ');

    if (command === '#menu') {
      await sendMenu(jid);
    }

    if (command === '#movie') {
      const response = await searchMovie(query);
      await conn.sendMessage(jid, { text: response });
    }

    if (command === '#yt') {
      const ytQuery = query;
      const ytResponse = await searchAndDownloadYouTube(ytQuery, 'video');
      await conn.sendMessage(jid, { text: ytResponse.url ? `Title: ${ytResponse.title}\nDownload: ${ytResponse.url}` : ytResponse });
    }

    if (command === '#alive') {
      await conn.sendMessage(jid, { text: settings.menu.aliveMessage, image: { url: settings.imageUrl }, footer: settings.footerText });
    }

    if (command === '#system') {
      await conn.sendMessage(jid, { text: settings.menu.systemInfoMessage });
    }
  }
});

// Search and Download YouTube (song/video) using Dylux API or similar
async function searchAndDownloadYouTube(query, type = 'video') {
  try {
    const apiUrl = `https://dylux-api.com/search?query=${encodeURIComponent(query)}&type=${type}`;
    const response = await axios.get(apiUrl);
    
    if (response.data && response.data.items && response.data.items.length > 0) {
      const firstItem = response.data.items[0];
      const title = firstItem.title;
      const videoUrl = firstItem.url;

      return {
        title: title,
        url: videoUrl
      };
    } else {
      return "No results found on YouTube.";
    }
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return "Error searching or downloading from YouTube.";
  }
}

// Connect the bot
(async () => {
  await conn.connect();  // Connect the bot using the session data
})();
