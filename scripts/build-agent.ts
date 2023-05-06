import { PuppeteerWebBaseLoader } from 'langchain/document_loaders/web/puppeteer';

async function run() {
  const loader = new PuppeteerWebBaseLoader(
    'https://js.langchain.com/docs/modules/indexes/document_loaders/examples/web_loaders/web_puppeteer/',
  );

  const docs = await loader.load();
  console.log(docs);
}

run();
