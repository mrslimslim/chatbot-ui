import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { PineconeClient } from '@pinecone-database/pinecone';
import { CSVLoader } from 'langchain/document_loaders/fs/csv';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { DocxLoader } from 'langchain/document_loaders/fs/docx';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PineconeStore } from 'langchain/vectorstores/pinecone';

/* Name of directory to retrieve your files from */
// const filePath = 'docs';

export const ingestData = async (
  extension: string,
  filepath: string,
  namespace: string,
  chunkSize: number,
  chunkOverlap: number,
) => {
  try {
    let loader = null;
    switch (extension) {
      case 'txt':
        loader = new TextLoader(filepath);
        break;
      case 'docx':
        loader = new DocxLoader(filepath);
        break;
      case 'pdf':
        loader = new PDFLoader(filepath);
        break;
      case 'csv':
        loader = new CSVLoader(filepath);
        break;
      default:
        loader = new TextLoader(filepath);
        break;
    }

    const rawDocs = await loader.load();

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });

    const docs = await textSplitter.splitDocuments(rawDocs);
    console.log('split docs', docs);

    console.log('creating vector store...');
    /*create and store the embeddings in the vectorStore*/
    const pinecone = new PineconeClient();
    await pinecone.init({
      environment: process.env.PINECONE_ENVIRONMENT ?? '', //this is in the dashboard
      apiKey: process.env.PINECONE_API_KEY ?? '',
    });
    const embeddings = new OpenAIEmbeddings();
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

    //embed the PDF documents
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: namespace,
      textKey: 'text',
    });
    console.log('ingestion complete');
    return {
      success: true,
      code: 200,
      message: 'Ingested data successfully',
    };
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to ingest your data');
  }
};
