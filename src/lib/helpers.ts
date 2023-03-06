import { ThreadChannel } from 'discord.js';

// Delete a thread channel as well as the starter (not first) message.
export async function destroyThread(thread: ThreadChannel) {
  await thread.delete();

  const starterMessage = await thread.fetchStarterMessage();

  if (starterMessage) {
    await starterMessage.delete();
  }
}

// String helpers

export function limit(str: string, limit: number): string {
  return str.length > limit ? `${str.slice(0, limit - 3)}...` : str;
}
