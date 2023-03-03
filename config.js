import * as dotenv from 'dotenv';
dotenv.config();

const config = {
  bot: {
    name: process.env.BOT_NAME || 'WumpusGPT',
    instructions:
      process.env.BOT_INSTRUCTIONS || 'You are WumpusGPT, a helpful assistant.',
    invite_url: `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=397284550656&scope=bot`,
  },
  discord: {
    client_id: process.env.DISCORD_CLIENT_ID,
    token: process.env.DISCORD_TOKEN,
  },
  openai: {
    api_key: process.env.OPENAI_API_KEY,
  },
};

export default config;
