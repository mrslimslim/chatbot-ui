import { NextApiRequest, NextApiResponse } from 'next';
import { writeFileSync, readFileSync } from 'fs';


const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
       res.status(405).json({ success: false, message: 'Method not allowed', code : 405 });
    }


    const configArrStr = readFileSync('./knowledge.json', 'utf-8');
    const configArr = JSON.parse(configArrStr);
    //  将配置信息写入追加写入knowledge.json文件
    configArr.push(req.body);
    writeFileSync('./knowledge.json', JSON.stringify(configArr));


    
    res.status(200).json({ success: true, code: 200 });
};

export default handler;
