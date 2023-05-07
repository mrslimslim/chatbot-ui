import { OpenAIModel } from '@/types/openai';

import * as cheerio from 'cheerio';
import { CallbackManager } from 'langchain/callbacks';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { PlaywrightWebBaseLoader } from 'langchain/document_loaders/web/playwright';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from 'langchain/document'
// import { RetrievalQAChain } from "langchain/chains";
import { HumanChatMessage } from 'langchain/schema';

/**
 * Loader uses `page.evaluate(() => document.body.innerHTML)`
 * as default evaluate function
 **/

interface WebLoaderOptions {
  modelName: OpenAIModel;
  temperature: number;
  url: string;
  question: string;
}

export async function webLoader(
  { modelName, temperature, url, question }: WebLoaderOptions,
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
  const embeddings: any = new OpenAIEmbeddings();
  const loader = new PlaywrightWebBaseLoader(url);
  const web = await loader.load();
  console.log('(web[0].pageContent', web[0].pageContent);
  const text = getText(web[0].pageContent, url, question);
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const texts = await textSplitter.splitText(text);
  const docs = texts.map((pageContent) => new Document({
    pageContent,
    metadata: [],
  }));
  const vectorStore =await MemoryVectorStore.fromDocuments(docs, embeddings)
  const results = await  vectorStore.similaritySearch(question, 4);
  const context = results.map((res) => res.pageContent).join("\n");
  console.log('context', context);
  model.call([
    new HumanChatMessage(`
      现在, 我将给你展示一段上下文，请根据上下文回答QUESTION的问题或者指令.

      QUESTION: ${question || 'please summarize it'}
      ----
      CONTEXT:
      ${context}
      ----
    `)
  ])
}

export const getText = (html: string, baseUrl: string, summary: string) => {
  // scriptingEnabled so noscript elements are parsed
  const $ = cheerio.load(html, { scriptingEnabled: true });
  let text = '';
  // lets only get the body if its a summary, dont need to summarize header or footer etc
  const rootElement = summary ? 'body ' : '*';
  $(`${rootElement}:not(style):not(script):not(svg)`).each((_i, elem) => {
    // we dont want duplicated content as we drill down so remove children
    let content = $(elem).clone().children().remove().end().text().trim();
    const $el = $(elem);
    // if its an ahref, print the content and url
    let href = $el.attr('href');
    if ($el.prop('tagName')?.toLowerCase() === 'a' && href) {
      if (!href.startsWith('http')) {
        try {
          href = new URL(href, baseUrl).toString();
        } catch {
          // if this fails thats fine, just no url for this
          href = '';
        }
      }
      const imgAlt = $el.find('img[alt]').attr('alt')?.trim();
      if (imgAlt) {
        content += ` ${imgAlt}`;
      }
      text += ` [${content}](${href})`;
    }
    // otherwise just print the content
    else if (content !== '') {
      text += ` ${content}`;
    }
  });
  return text.trim().replace(/\n+/g, ' ');
};
