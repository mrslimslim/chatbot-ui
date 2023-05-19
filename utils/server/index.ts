import { Knowledge, Message } from '@/types/chat';
import { OpenAIModel } from '@/types/openai';

import {
  AZURE_DEPLOYMENT_ID,
  OPENAI_API_HOST,
  OPENAI_API_TYPE,
  OPENAI_API_VERSION,
  OPENAI_ORGANIZATION,
} from '../app/const';
import { googleSearch } from '../google-search-loader';
import { knowledgeLoader } from '../knowledge-loader';
import { getModel } from '../llm-models';
import { webLoader } from '../web-loader';
import { webSearch } from '../web-search';

import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { PineconeClient } from '@pinecone-database/pinecone';
import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';
import { CallbackManager } from 'langchain/callbacks';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from 'langchain/schema';
import { PineconeStore } from 'langchain/vectorstores/pinecone';

export class OpenAIError extends Error {
  type: string;
  param: string;
  code: string;

  constructor(message: string, type: string, param: string, code: string) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

const loadVectorStore = async () => {
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
    namespace: PINECONE_NAME_SPACE, //namespace comes from your config folder
  });
  return vectorStore;
};

const rules = {
  // 以'/s'开头 且包含满足url的字符串
  search: (str: string) => {
    return str.startsWith('/s') && str.slice(3).match(/(http(s)?:\/\/)?\S+/);
  },
  // 以'/g'开头
  google: (str: string) => {
    return str.startsWith('/g');
  },
};

// 根据不同的参数选择进入不同的调用方式
const chatProxyParser = (
  model: OpenAIModel,
  systemPrompt: string,
  temperature: number,
  key: string,
  messages: Message[],
  isKnowledgeBase?: boolean,
  knowledge?: Knowledge,
) => {
  //获取messages的最后一条信息
  console.log('knowledge', isKnowledgeBase, knowledge);
  const question = messages[messages.length - 1];
  // 判断question是否search规则
  if (rules.search(question.content)) {
    // 如果是search规则，进入webSearch

    // 正则提取url,做容错处理
    let url = '';
    const maybeUrl = question.content.slice(3).match(/(http(s)?:\/\/)?\S+/);
    if (maybeUrl && maybeUrl.length > 0) {
      url = maybeUrl[0];
    } else {
      return normalChatParse(model, systemPrompt, temperature, key, messages);
    }
    const maybeQuestion = question.content.match(
      /(?<=\s)(?!https?:\/\/)([\u4e00-\u9fa5_a-zA-Z0-9\s]+)/g,
    );
    let questionContent = '';
    if (maybeQuestion && maybeQuestion.length > 0) {
      questionContent = maybeQuestion[0];
    }

    // 提取问题，排除 \s 和 url后的字符串作为问题
    return webChatParse(model, temperature, url, questionContent);
  } else if (rules.google(question.content)) {
    const maybeQuestion = question.content.match(/(?<=\/g\s+)(.+)/g);
    let questionContent = '';
    if (maybeQuestion && maybeQuestion.length > 0) {
      questionContent = maybeQuestion[0];
    }
    return googleSearchParse(model, temperature, url, questionContent);
  } else if (knowledge) {
    return knowledgeLoaderParse(
      model,
      temperature,
      systemPrompt,
      question.content,
      knowledge,
    );
  }
  // 如果不是search规则，进入normalChatParse
  return normalChatParse(model, systemPrompt, temperature, key, messages);
};

export const LLMStream = async (
  model: OpenAIModel,
  systemPrompt: string,
  temperature: number,
  key: string,
  messages: Message[],
  isKnowledgeBase?: boolean,
  knowledge?: Knowledge,
) => {
  console.log(model, systemPrompt, temperature, key, messages, isKnowledgeBase);
  const parser = await chatProxyParser(
    model,
    systemPrompt,
    temperature,
    key,
    messages,
    isKnowledgeBase,
    knowledge,
  );

  const stream = new ReadableStream({
    async start(controller) {
      parser(controller);
    },
  });

  return stream;
};

// const normalChatParse = async (
//   model: OpenAIModel,
//   systemPrompt: string,
//   temperature: number,
//   key: string,
//   messages: Message[],
// ) => {
//   let url = `${OPENAI_API_HOST}/v1/chat/completions`;
//   if (OPENAI_API_TYPE === 'azure') {
//     url = `${OPENAI_API_HOST}/openai/deployments/${AZURE_DEPLOYMENT_ID}/chat/completions?api-version=${OPENAI_API_VERSION}`;
//   }
//   const res = await fetch(url, {
//     headers: {
//       'Content-Type': 'application/json',
//       ...(OPENAI_API_TYPE === 'openai' && {
//         Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`,
//       }),
//       ...(OPENAI_API_TYPE === 'azure' && {
//         'api-key': `${key ? key : process.env.OPENAI_API_KEY}`,
//       }),
//       ...(OPENAI_API_TYPE === 'openai' &&
//         OPENAI_ORGANIZATION && {
//           'OpenAI-Organization': OPENAI_ORGANIZATION,
//         }),
//     },
//     method: 'POST',
//     body: JSON.stringify({
//       ...(OPENAI_API_TYPE === 'openai' && { model: model.id }),
//       messages: [
//         {
//           role: 'system',
//           content: systemPrompt,
//         },
//         ...messages,
//       ],
//       max_tokens: 1000,
//       temperature: temperature,
//       stream: true,
//     }),
//   });

//   const encoder = new TextEncoder();
//   const decoder = new TextDecoder();

//   if (res.status !== 200) {
//     const result = await res.json();
//     if (result.error) {
//       throw new OpenAIError(
//         result.error.message,
//         result.error.type,
//         result.error.param,
//         result.error.code,
//       );
//     } else {
//       throw new Error(
//         `OpenAI API returned an error: ${
//           decoder.decode(result?.value) || result.statusText
//         }`,
//       );
//     }
//   }
//   return async (controller: any) => {
//     const onParse = (event: ParsedEvent | ReconnectInterval) => {
//       if (event.type === 'event') {
//         const data = event.data;

//         try {
//           const json = JSON.parse(data);
//           if (json.choices[0].finish_reason != null) {
//             controller.close();
//             return;
//           }
//           const text = json.choices[0].delta.content;
//           const queue = encoder.encode(text);
//           controller.enqueue(queue);
//         } catch (e) {
//           controller.error(e);
//         }
//       }
//     };

//     const parser = createParser(onParse);

//     for await (const chunk of res.body as any) {
//       parser.feed(decoder.decode(chunk));
//     }
//   };
// };

const normalChatParse = async (
  model: OpenAIModel,
  systemPrompt: string,
  temperature: number,
  key: string,
  messages: Message[],
) => {
  return async (controller: any) => {
    let type = 'openai';
    if (model.id.includes('claude')) {
      type = 'anthropic';
    }
    const models = getModel(type, {
      modelName: model.id,
      temperature,
      streaming: true,
      callbacks: CallbackManager.fromHandlers({
        async handleLLMNewToken(token: string) {
          if (!token) return;
          controller.enqueue(token);
        },
        async handleLLMEnd() {
          controller.close();
        },
        async handleLLMError(error: any) {
          console.log('error', error);
        },
      }),
    });
    console.log('messages', messages);
    const systemMessages = new SystemChatMessage(systemPrompt);
    const chatMessages = messages.map((message) => {
      if (message.role === 'user') return new HumanChatMessage(message.content);
      return new AIChatMessage(message.content);
    });
    models.call([systemMessages, ...chatMessages]);
  };
};

const webChatParse = async (
  model: OpenAIModel,
  temperature: number,
  url: string,
  question: string,
) => {
  const encoder = new TextEncoder();
  return (controller: any) => {
    // webLoader
    webLoader(
      { modelName: model, temperature, url, question },
      (token) => {
        controller.enqueue(encoder.encode(token));
      },
      () => {
        controller.close();
      },
    );
  };
};

const googleSearchParse = async (
  model: OpenAIModel,
  temperature: number,
  url: string,
  question: string,
) => {
  const encoder = new TextEncoder();
  return (controller: any) => {
    googleSearch(
      { modelName: model, temperature, url, question },
      (token) => {
        controller.enqueue(encoder.encode(token));
      },
      () => {
        controller.close();
      },
    );
  };
};

const knowledgeLoaderParse = async (
  model: OpenAIModel,
  temperature: number,
  prompt: string,
  question: string,
  knowledge: Knowledge,
) => {
  const encoder = new TextEncoder();
  return (controller: any) => {
    knowledgeLoader(
      {
        modelName: model,
        temperature,
        prompt,
        question,
        knowledge,
      },
      (token) => {
        controller.enqueue(encoder.encode(token));
      },
      () => {
        controller.close();
      },
    );
  };
};
