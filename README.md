# WumpusGPT

WumpusGPT is a Discord chatbot written in TypeScript and powered by OpenAI's `gpt-3.5-turbo` language model.

Although WumpusGPT is not quite the same as ChatGPT, they both utilize the same language model so you will yield very similar results.

Built with [OpenAI Node.js Library](https://github.com/openai/openai-node) and [discord.js](https://discord.js.org). Inspired by OpenAI's [GPT Discord Bot](https://github.com/openai/gpt-discord-bot).

You can invite the bot to your server by clicking [here](https://discord.com/api/oauth2/authorize?client_id=1054835849893793872&permissions=397284550656&scope=bot).

## Roadmap

> **Warning**
> This is a work in progress. Feel free to contribute!

- [ ] Closable Threads
- [ ] Message Moderation
- [x] ~Image Generation~
- [x] ~Rate Limiting~
- [x] ~Thread Pruning~

## Features

- Configurable bot instructions
- Remembers previous messages in threads
- Ability to regenerate responses
- Image generation using DALL·E via `/image`
- Rate limiting per user to prevent abuse
- Automatic thread pruning

## Get Started

1. Copy `.env.example` to `.env` and fill in the values as detailed below
1. Create a MySQL database (I recommend [PlanetScale](https://planetscale.com/) if you don't want to host locally) and fill in `DATABASE_URL`
1. Create a Discord application at https://discord.com/developers/applications
1. Go to the Bot tab and click "Add Bot"
    - Click "Reset Token" and fill in `DISCORD_TOKEN`
    - Disable "Public Bot" unless you want your bot to be visible to everyone
    - Enable "Message Content Intent" under "Privileged Gateway Intents"
1. Go to the OAuth2 tab, copy your "Client ID", and fill in `DISCORD_CLIENT_ID`
1. Go to https://beta.openai.com/account/api-keys, create an API key, and fill in `OPENAI_API_KEY`
1. Install dependencies and run the bot
    ```
    npm install

    # If you are using PlanetScale:
    npx prisma db push

    # Otherwise:
    npx prisma migrate dev --name init

    npm start
    ```
    You should see an invite URL in the console. Copy and paste it into your browser to add the bot to your server.
1. Start chatting with the bot via the `/chat` or `/ask` commands

## License

Licensed under the [MIT license](https://github.com/biscxit/wumpus-gpt/blob/main/LICENSE).
