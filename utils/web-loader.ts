import { OpenAIModel } from '@/types/openai';

import * as cheerio from 'cheerio';
import { convert } from 'html-to-text';
import { CallbackManager } from 'langchain/callbacks';
import { RetrievalQAChain } from 'langchain/chains';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { Document } from 'langchain/document';
import { PuppeteerWebBaseLoader } from 'langchain/document_loaders/web/puppeteer';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { ContextualCompressionRetriever } from 'langchain/retrievers/contextual_compression';
import { LLMChainExtractor } from 'langchain/retrievers/document_compressors/chain_extract';
import { HumanChatMessage } from 'langchain/schema';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import debounce from 'lodash-es/debounce';

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
      handleLLMEnd: async function () {
        onCloseStream && onCloseStream();
      },
    }),
  });
  // const baseCompressor = LLMChainExtractor.fromLLM(model);
  const embeddings: any = new OpenAIEmbeddings();
  const loader = new PuppeteerWebBaseLoader(url, {});
  const web = await loader.load();
  const text = await getText(web[0].pageContent);
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
  });
  const texts = await textSplitter.splitText(text);
  const docs = texts.map(
    (pageContent) =>
      new Document({
        pageContent,
        metadata: [],
      }),
  );
  const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
  const results = await vectorStore.similaritySearch(question, 3);
  const context = results.map((res) => res.pageContent).join('\n');
  model.call([
    new HumanChatMessage(`
      现在, 我将给你展示一段上下文，请根据上下文回答QUESTION的问题或者指令.

      QUESTION: ${question || 'please summarize the context bellow in Chinese'}
      ----
      CONTEXT:
      ${context}
      ----
    `),
  ]);
  // const retriever = new ContextualCompressionRetriever({
  //   baseCompressor,
  //   baseRetriever: vectorStore.asRetriever(),
  // });
  // const chain = RetrievalQAChain.fromLLM(model, retriever);

  // chain.call({
  //   query: question,
  // });
}

// export const getText = (html: string, baseUrl: string, summary: string) => {
//   // scriptingEnabled so noscript elements are parsed
//   const $ = cheerio.load(html, { scriptingEnabled: true });
//   let text = '';
//   // lets only get the body if its a summary, dont need to summarize header or footer etc
//   const rootElement = summary ? 'body ' : '*';
//   $(`${rootElement}:not(style):not(script):not(svg)`).each((_i, elem) => {
//     // we dont want duplicated content as we drill down so remove children
//     let content = $(elem).clone().children().remove().end().text().trim();
//     const $el = $(elem);
//     // if its an ahref, print the content and url
//     let href = $el.attr('href');
//     if ($el.prop('tagName')?.toLowerCase() === 'a' && href) {
//       if (!href.startsWith('http')) {
//         try {
//           href = new URL(href, baseUrl).toString();
//         } catch {
//           // if this fails thats fine, just no url for this
//           href = '';
//         }
//       }
//       const imgAlt = $el.find('img[alt]').attr('alt')?.trim();
//       if (imgAlt) {
//         content += ` ${imgAlt}`;
//       }
//       text += ` [${content}](${href})`;
//     }
//     // otherwise just print the content
//     else if (content !== '') {
//       text += ` ${content}`;
//     }
//   });
//   return text.trim().replace(/\n+/g, ' ');
// };

const removeUnwantedElements = ($: any, unwantedSelectors: any) => {
  unwantedSelectors.forEach((selector: any) => {
    $(selector).remove();
  });
};

export const getText = async (html: string) => {
  try {
    const $ = cheerio.load(html);

    // 从页面中移除不需要的元素
    const unwantedSelectors = [
      'script', // 移除script标签
      'style', // 移除style标签
      'img', // 移除图片
      '.ad', // 移除广告（假设广告使用类名 ad）
    ];

    removeUnwantedElements($, unwantedSelectors);

    // 将HTML转换为纯文本
    const text = convert($.html(), {
      wordwrap: false,
      selectors: [{ selector: 'img', format: 'skip' }],
    });

    return text;
  } catch (error) {
    console.error('Error fetching URL:', error);
    return '';
  }
};
