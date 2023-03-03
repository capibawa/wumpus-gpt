import { REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

import config from './config.js';
import { getDirectoryName } from './lib/helpers.js';

const commands = [];
const commandsPath = path.join(getDirectoryName(import.meta), 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    const data = await rest.put(
      Routes.applicationCommands(config.discord.client_id),
      { body: commands }
    );

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (err) {
    console.error(err);
  }
})();
