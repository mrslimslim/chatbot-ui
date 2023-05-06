import { pinecone } from '@/utils/pinecone';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';


export const run = async () => {
    try {
        const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

        index.delete1({
            deleteAll: true,
            namespace: 'fb0da9bc837e4dc0b7fc478cd81b6e47',
        });
    }catch (error) {
        console.log('error', error);
        throw new Error('Failed to clear your data');
    }
}

run();