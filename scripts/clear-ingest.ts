import { pinecone } from '@/utils/pinecone';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';


export const run = async () => {
    try {
        const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

        index.delete1({
            deleteAll: true,
            namespace: PINECONE_NAME_SPACE,
        });
    }catch (error) {
        console.log('error', error);
        throw new Error('Failed to clear your data');
    }
}

run();