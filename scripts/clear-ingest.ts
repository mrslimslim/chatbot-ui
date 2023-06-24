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
            namespace: "0ff1527e-50dd-418a-8912-c2b2be38772e.plain",
        });
    }catch (error) {
        console.log('error', error);
        throw new Error('Failed to clear your data');
    }
}

run();