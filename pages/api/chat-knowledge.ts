// api/openai-chat.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { OpenAIError, OpenAIStream } from '@/utils/server';
import { ChatBody, Message } from '@/types/chat';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const {
      model,
      messages,
      key,
      prompt,
      temperature,
      isKnowledgeBase,
      knowledge,
    } = req.body as ChatBody;

    let promptToSend = prompt;
    if (!promptToSend) {
      promptToSend = DEFAULT_SYSTEM_PROMPT;
    }

    let temperatureToUse = temperature;
    if (temperatureToUse == null) {
      temperatureToUse = DEFAULT_TEMPERATURE;
    }

    let messagesToSend: Message[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];

      messagesToSend = [message, ...messagesToSend];
    }

    const stream = await OpenAIStream(
      model,
      promptToSend,
      temperatureToUse,
      key,
      messagesToSend,
      isKnowledgeBase,
      knowledge
    );

    // Set up the headers for the stream response
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    
    // Pipe the stream to the response
    // Read the stream and send the data to the client
    const reader = stream.getReader();
    reader.read().then(function process({ done, value }) {
      if (done) {
        res.end();
        return;
      }

      res.write(Buffer.from(value));
      reader.read().then(process).catch(error => {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while reading the stream' });
      });
    }).catch(error => {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while reading the stream' });
    });
  } catch (error) {
    console.error(error);
    if (error instanceof OpenAIError) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
}
