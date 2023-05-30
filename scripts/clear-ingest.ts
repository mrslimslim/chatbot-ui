// import { pinecone } from '@/utils/pinecone';
import { PineconeClient } from '@pinecone-database/pinecone';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';


export const run = async () => {
    try {
        const pinecone = new PineconeClient();

        await pinecone.init({
        environment: process.env.PINECONE_ENVIRONMENT ?? '', //this is in the dashboard
        apiKey: process.env.PINECONE_API_KEY ?? '',
        });
        const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

        index.delete1({
            deleteAll: true,
            namespace: "43542995-3a7a-4def-8161-72d835326613.plain",
        });
    }catch (error) {
        console.log('error', error);
        throw new Error('Failed to clear your data');
    }
}

run();