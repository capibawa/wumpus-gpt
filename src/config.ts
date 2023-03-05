import dotenv from 'dotenv';
dotenv.config();

const config = {
  bot: {
    name: process.env.BOT_NAME || 'WumpusGPT',
    instructions:
      process.env.BOT_INSTRUCTIONS || 'You are WumpusGPT, a helpful assistant.',
    invite_url: `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=397284550656&scope=bot`,
    prune_interval: process.env.BOT_PRUNE_INTERVAL || 0, // hours
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  discord: {
    client_id: process.env.DISCORD_CLIENT_ID,
    token: process.env.DISCORD_TOKEN,
  },
  openai: {
    api_key: process.env.OPENAI_API_KEY,
    temperature: process.env.OPENAI_TEMPERATURE || 0.7,
    top_p: process.env.OPENAI_TOP_P || 1.0,
    frequency_penalty: process.env.OPENAI_FREQUENCY_PENALTY || 0.0,
    presence_penalty: process.env.OPENAI_PRESENCE_PENALTY || 0.0,
    max_tokens: process.env.OPENAI_MAX_TOKENS || 2048,
  },
};

export default config;
