import { NextApiRequest, NextApiResponse } from 'next';

import formidable from 'formidable';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: false,
  },
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (files?.file) {
        // 获取后缀
        const extname = files?.file.mimetype.split('/')[1];
        // 生成新的文件名
        const filename = uuidv4() + '.' + extname;
        // 将文件保存到files
        fs.rename(files?.file.filepath, `./files/${filename}`, () => {
          res.status(200).json({ success: true, url: `/files/${filename}` });
        });
      } else {
        res.status(500).json({ success: false, message: '上传失败' });
      }
    });
    // res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

export default handler;
