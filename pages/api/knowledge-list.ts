import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        // 判断是否存在knowledge.json文件，没有创建
        const isExist = fs.existsSync('./knowledge.json');
        if (!isExist) {
            fs.writeFileSync('./knowledge.json', '[]');
        }
        // 读取knowledge.json文件
        const configArrStr = fs.readFileSync('./knowledge.json', 'utf-8');
        res.status(200).json({ success: true, data: JSON.parse(configArrStr) });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

export default handler;
