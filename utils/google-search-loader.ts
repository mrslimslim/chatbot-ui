import { GoogleSource } from '@/types/google';
import { OpenAIModel } from '@/types/openai';

import { cleanSourceText } from './server/google';

import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import { convert } from 'html-to-text';
import jsdom, { JSDOM } from 'jsdom';
import { CallbackManager } from 'langchain/callbacks';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { Document } from 'langchain/document';
import { CheerioWebBaseLoader } from 'langchain/document_loaders/web/cheerio';
import { PuppeteerWebBaseLoader } from 'langchain/document_loaders/web/puppeteer';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
// import { RetrievalQAChain } from "langchain/chains";
import { AIChatMessage, HumanChatMessage } from 'langchain/schema';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

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

export async function googleSearch(
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
  const searchResult = await getGoogleSearchResult(question);
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 400,
  });
  const texts = await textSplitter.splitText(JSON.stringify(searchResult));
  const docs = texts.map(
    (pageContent) =>
      new Document({
        pageContent,
        metadata: [],
      }),
  );
  const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
  const results = await vectorStore.similaritySearch(question, 8);
  const context = results.map((res) => res.pageContent).join('\n');
  //   console.log('context', context);
  model.call([
    new HumanChatMessage(`
        Provide me with the information I requested. Provide an accurate response and then stop. Today's date is ${new Date().toLocaleDateString()};
        Answer in CHINESE.

        Sources:
        ${context}
    `),
    new AIChatMessage('Sure, please show me your question'),
    new HumanChatMessage(question),
  ]);
}

const getGoogleSearchResult = async (query: string) => {
  const { googleAPIKey, googleCSEId } = process.env;
  //   console.log('query', query);
  const googleRes = await fetch(
    `https://customsearch.googleapis.com/customsearch/v1?key=${
      googleAPIKey ? googleAPIKey : process.env.GOOGLE_API_KEY
    }&cx=${
      googleCSEId ? googleCSEId : process.env.GOOGLE_CSE_ID
    }&q=${query}&num=1`,
  );

  const googleData = await googleRes.json();
  const sources: GoogleSource[] = googleData.items.map((item: any) => ({
    title: item.title,
    link: item.link,
    displayLink: item.displayLink,
    snippet: item.snippet,
    image: item.pagemap?.cse_image?.[0]?.src,
    text: '',
  }));

  console.log('sources', sources);

  const fetchSourceHTMl = async (url: string) => {
    const launchConfig =
      process.env.NODE_ENV === 'production'
        ? {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: '/bin/chromium-browser',
          }
        : {};
    const loader = new PuppeteerWebBaseLoader(url, {
      launchOptions: launchConfig,
    });
    const web = await loader.load();
    return web[0].pageContent;
  };

  const sourcesWithText: any = await Promise.all(
    sources.map(async (source) => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), 5000),
        );

        const html = (await Promise.race([
          fetchSourceHTMl(source.link),
          timeoutPromise,
        ])) as any;

        const $ = cheerio.load(html);
        // 从页面中移除不需要的元素
        const unwantedSelectors = [
          'script', // 移除script标签
          'style', // 移除style标签
          'img', // 移除图片
          '.ad', // 移除广告（假设广告使用类名 ad）
          '.sidebar', // 移除侧边栏（假设侧边栏使用类名 sidebar）
          '.footer', // 移除页脚（假设页脚使用类名 footer）
          '.header', // 移除页眉（假设页眉使用类名 header）
          '.nav', // 移除导航（假设导航使用类名 nav）
          '.breadcrumb', // 移除面包屑（假设面包屑使用类名 breadcrumb）
          '.pagination', // 移除分页（假设分页使用类名 pagination）
          '.comments', // 移除评论（假设评论使用类名 comments）
        ];
        removeUnwantedElements($, unwantedSelectors);
        // const text = convert(html, {
        //   wordwrap: false,
        //   selectors: [
        //     { selector: 'img', format: 'skip' },
        //     { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
        //   ],
        // });
        const virtualConsole = new jsdom.VirtualConsole();
        virtualConsole.on('error', (error) => {
          if (!error.message.includes('Could not parse CSS stylesheet')) {
            console.error(error);
          }
        });

        const dom = new JSDOM(html, { virtualConsole });
        const doc = dom.window.document;
        const parsed = new Readability(doc).parse();
        const text = parsed?.textContent;
        console.log('text', text);
        return text;
      } catch (error) {
        console.error(error);
        return null;
      }
    }),
  );

  const filteredSources: GoogleSource[] = sourcesWithText.filter(Boolean);
  const filteredSourcesStr = JSON.stringify(filteredSources.join('\n'));
  console.log('filteredSourcesStr', filteredSourcesStr);
  return filteredSourcesStr;
};

const removeUnwantedElements = ($: any, unwantedSelectors: any) => {
  unwantedSelectors.forEach((selector: any) => {
    $(selector).remove();
  });
};
