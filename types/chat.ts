import { OpenAIModel } from './openai';

export interface Message {
  role: Role;
  content: string;
}

export type Role = 'assistant' | 'user';

export interface ChatBody {
  model: OpenAIModel;
  messages: Message[];
  key: string;
  prompt: string;
  temperature: number;
  isKnowledgeBase?: boolean;
  knowledge ?: Knowledge;
}

export interface Knowledge {
  namespace: string;
  chunkSize: number;
  chunkSizeOverlap: number;
}

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  model: OpenAIModel;
  prompt: string;
  temperature: number;
  isKnowledgeBase?: boolean;
  knowledge?: Knowledge;
  folderId: string | null;
}
