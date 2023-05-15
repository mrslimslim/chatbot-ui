import { Knowledge } from '@/types/chat';
import { OpenAIModel } from '@/types/openai';

import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { PineconeClient } from '@pinecone-database/pinecone';
import * as cheerio from 'cheerio';
import { CallbackManager } from 'langchain/callbacks';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { PlaywrightWebBaseLoader } from 'langchain/document_loaders/web/playwright';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from 'langchain/schema';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { PineconeStore } from 'langchain/vectorstores/pinecone';

interface KnowledgeLoaderOptions {
  modelName: OpenAIModel;
  temperature: number;
  prompt: string;
  question: string;
  knowledge: Knowledge;
}

export async function knowledgeLoader(
  {
    modelName,
    temperature,
    prompt,
    question,
    knowledge,
  }: KnowledgeLoaderOptions,
  onTokenStream: (token: string) => void,
  onCloseStream: () => void,
) {
  const model = new ChatOpenAI({
    temperature: 0,
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
  const embeddings = new OpenAIEmbeddings();
  const pinecone = new PineconeClient();
  await pinecone.init({
    environment: process.env.PINECONE_ENVIRONMENT ?? '', //this is in the dashboard
    apiKey: process.env.PINECONE_API_KEY ?? '',
  });
  const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    textKey: 'text',
    namespace: knowledge.namespace, //namespace comes from your config folder
  });
  const results = await vectorStore.similaritySearch(question, 4);
  console.log('xxxx', results);

  const context = results.map((res) => res.pageContent).join('\n');
  console.log('context', context);

  // Now, you will act as a foreign senior business trader and a math teacher ,you have to be strict and sensitive to numbers and calculate and good at calculating the expression,I will show you a context
  const promptStr = promptTemplate(prompt, context);
  model.call([
    new HumanChatMessage(promptStr),
    new AIChatMessage('Sure, please show me your question'),
    new HumanChatMessage(question),
  ]);
}

const promptTemplate = (prompt: string, context: string) => {
  // 正则匹配string中包含 {{{context}}} 会被替换为 context
  const promptStr = prompt.replace(/{{{context}}}/g, context);
  return promptStr;
};
