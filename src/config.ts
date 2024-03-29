import dotenv from 'dotenv';

dotenv.config();

const config = {
  bot: {
    name: process.env.BOT_NAME || 'WumpusGPT',
    instruction:
      process.env.BOT_INSTRUCTION || 'You are WumpusGPT, a helpful assistant.',
    invite_url: `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=395137067008&scope=bot`,
    thread_prefix: process.env.BOT_THREAD_PREFIX || '💬',
    prune_interval: process.env.BOT_PRUNE_INTERVAL || 0,
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
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    temperature: process.env.OPENAI_TEMPERATURE || 0.7,
    max_tokens: process.env.OPENAI_MAX_TOKENS || 500,
  },
};

if (
  !config.database.url ||
  !config.discord.client_id ||
  !config.discord.token ||
  !config.openai.api_key
) {
  throw new Error(
    'Missing environment variables. Make sure the following are set: DATABASE_URL, DISCORD_CLIENT_ID, DISCORD_TOKEN, OPENAI_API_KEY.'
  );
}

export default config;
