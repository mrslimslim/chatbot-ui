import { OpenAIModel } from '@/types/openai';

import * as cheerio from 'cheerio';
import { CallbackManager } from 'langchain/callbacks';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { PlaywrightWebBaseLoader } from 'langchain/document_loaders/web/playwright';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

export function knowledgeLoader() {}

const loadVectorStore = async () => {
  const embeddings = new OpenAIEmbeddings();
  // const pinecone = new PineconeClient();
  // await pinecone.init({
  //   environment: process.env.PINECONE_ENVIRONMENT ?? '', //this is in the dashboard
  //   apiKey: process.env.PINECONE_API_KEY ?? '',
  // });
  // const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name
  // const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  //   pineconeIndex: index,
  //   textKey: 'text',
  //   namespace: PINECONE_NAME_SPACE, //namespace comes from your config folder
  // });
  // return vectorStore;
};

export const makeChain = async (
  modelName: string,
  systemPrompt: string,
  temperature: number,
  onTokenStream?: (token: string) => void,
  onCloseStream?: () => void,
) => {
  const vectorStore = await loadVectorStore();
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
//   return ConversationalRetrievalQAChain.fromLLM(model, vectorStore.asRetriever(),)
};
