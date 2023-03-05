import fs from 'fs';
import path from 'path';

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.ts'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);

  require(filePath);
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith('.ts'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);

  require(filePath);
}
