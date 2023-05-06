import { OpenAIModel } from '@/types/openai';

import { CallbackManager } from 'langchain/callbacks';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { WebBrowser } from 'langchain/tools/webbrowser';

interface WebSearchOptions {
  modelName: OpenAIModel;
  temperature: number;
  url: string;
  question: string;
}

export async function webSearch(
  { modelName, temperature, url, question }: WebSearchOptions,
  onTokenStream: (token: string) => void,
  onCloseStream: () => void,
) {
  const model = new ChatOpenAI({
    temperature,
    streaming: true,
    callbacks: CallbackManager.fromHandlers({
      async handleLLMNewToken(token: string) {
        if (!token) return;
        onTokenStream && onTokenStream(token);
      },
      async handleLLMEnd() {
        onCloseStream && onCloseStream();
      },
    }),
  });
  const embeddings: any = new OpenAIEmbeddings();

  const browser = new WebBrowser({ model, embeddings });
  browser.call(`"${url}", "${question || '简介一下网站的信息'}"`);
}
