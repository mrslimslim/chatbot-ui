import { NextApiRequest, NextApiResponse } from 'next';

import { ingestData } from '../../scripts/ingest-data';

import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res
      .status(405)
      .json({ success: false, message: 'Method not allowed', code: 405 });
  }

  const body = req.body;
  const configArrStr = readFileSync('./knowledge.json', 'utf-8');
  const configArr = JSON.parse(configArrStr);
  //  将配置信息写入追加写入knowledge.json文件

  // body => {url: '/files/xxx.pdf'}
  // 判断文件是否存在
  const isExist = existsSync(`./${body.file.url}`);
  try {
    // filename
    const filename = path.basename(body.file.url);
    const namespace = filename;
    const extension = path.extname(body.file.url);
    const result = await ingestData(
      extension,
      `./${body.file.url}`,
      namespace,
      body.chunkSize,
      body.chunkOverlap,
    );
    const data = {
      namespace,
      ...body,
    };
    if (result.code === 200) {
      res.status(200).json({ success: true, code: 200 });
      configArr.push(data);
      writeFileSync('./knowledge.json', JSON.stringify(configArr));
    }
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ success: false, message: 'ingest failed', code: 500 });
  }

  if (!isExist) {
    res
      .status(500)
      .json({ success: false, message: 'Upload File not found', code: 500 });
    return;
  }
  // res.status(200).json({ success: true, code: 200 });
};

export default handler;
