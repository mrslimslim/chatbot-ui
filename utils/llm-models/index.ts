import { ClaudeModel, OpenAIModel } from '@/types/openai';

import { AnthropicInput, ChatAnthropic } from 'langchain/chat_models/anthropic';
import {
  AzureOpenAIInput,
  ChatOpenAI,
  OpenAIChatInput,
} from 'langchain/chat_models/openai';
import { BaseLanguageModelParams } from 'langchain/dist/base_language';

export const getModel = (
  type = 'openai',
  config:
    | (Partial<OpenAIChatInput> &
        Partial<AzureOpenAIInput> &
        BaseLanguageModelParams & {
          concurrency?: number | undefined;
          cache?: boolean | undefined;
          openAIApiKey?: string | undefined;
        })
    | (Partial<AnthropicInput> &
        BaseLanguageModelParams & { anthropicApiKey?: string | undefined })
    | undefined,
) => {
  if (type === 'anthropic') {
    console.log('process.env.ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY);
    return new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...config,
    });
  }
  console.log('config', config);
  return new ChatOpenAI({
    ...config,
  },{
    basePath: process.env.OPENAI_BASE_PATH,
  });
};
