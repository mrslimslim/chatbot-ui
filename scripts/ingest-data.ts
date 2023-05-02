import { pinecone } from '@/utils/pinecone';

import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { PuppeteerWebBaseLoader } from 'langchain/document_loaders/web/puppeteer';

async function run() {
  const loader = new PuppeteerWebBaseLoader(
    'https://js.langchain.com/docs/modules/indexes/document_loaders/examples/web_loaders/web_puppeteer/',
  );

  const docs = await loader.load();
  console.log(docs);
}

async function clear() {
  try {
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

    await index.delete1({
      deleteAll: true,
      namespace: PINECONE_NAME_SPACE,
    });
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to clear your data');
  }
}

run();
