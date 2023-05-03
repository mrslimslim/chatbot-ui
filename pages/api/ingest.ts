import { NextApiRequest, NextApiResponse } from 'next';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { ingestData } from '../../scripts/ingest-data'
import { v4 as uuidv4 } from 'uuid';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';


const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
       res.status(405).json({ success: false, message: 'Method not allowed', code : 405 });
    }

    const body = req.body;
    const configArrStr = readFileSync('./knowledge.json', 'utf-8');
    const configArr = JSON.parse(configArrStr);
    //  将配置信息写入追加写入knowledge.json文件
    
    // body => {url: '/files/xxx.pdf'}
    // 判断文件是否存在
    const isExist = existsSync(`./${body.file.url}`);
    console.log('isExist', isExist);
    try{
        const namespace =  uuidv4()
        const result =  await ingestData(body.file.url.split('.')[1], `./${body.file.url}`, PINECONE_NAME_SPACE);
        const data = {
            namespace,
            ...body

        }
        if(result.code === 200){
            res.status(200).json({ success: true, code: 200 });
            configArr.push(data);
            writeFileSync('./knowledge.json', JSON.stringify(configArr));
        }
       
    }catch(err){
        console.log(err);
        res.status(500).json({ success: false, message: 'ingest failed', code: 500 });
    }
    
    if (!isExist) {
        res.status(500).json({ success: false, message: 'Upload File not found', code: 500 });
        return;
    }
    // res.status(200).json({ success: true, code: 200 });
};

export default handler;
