import { PuppeteerWebBaseLoader } from 'langchain/document_loaders/web/puppeteer';

/**
 * Loader uses `page.evaluate(() => document.body.innerHTML)`
 * as default evaluate function
 **/

function webLoader() {}
const loader = new PuppeteerWebBaseLoader('https://www.tabnews.com.br/');

const docs = await loader.load();
