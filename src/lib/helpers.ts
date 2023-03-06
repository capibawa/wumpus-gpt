import { ThreadChannel } from 'discord.js';
import GPT3Tokenizer from 'gpt3-tokenizer';

import config from '@/config';

let tokenizer: GPT3Tokenizer;

export function exceedsTokenLimit(text: string): boolean {
  if (!tokenizer) {
    tokenizer = new GPT3Tokenizer({ type: 'gpt3' });
  }

  return tokenizer.encode(text).bpe.length > config.openai.max_tokens;
}

// Delete a thread channel as well as the starter (not first) message.
export async function destroyThread(thread: ThreadChannel): Promise<void> {
  await thread.delete();

  const starterMessage = await thread.fetchStarterMessage();

  if (starterMessage) {
    await starterMessage.delete();
  }
}
