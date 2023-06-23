import { NextApiRequest, NextApiResponse } from 'next';

import formidable from 'formidable';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import unzipper from 'unzipper';

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
        const extname = files?.file.mimetype.split('/')[1];
        const filename = uuidv4() + '.' + extname;
        console.log('extname', extname)
        if (extname.includes('zip')) {
          const zipfilename = uuidv4();
          fs.mkdirSync(`./files/${zipfilename}`);
          console.log('work')
          fs.rename(files?.file.filepath, `./files/${zipfilename}/${filename}`, () => {
            fs.createReadStream(`./files/${zipfilename}/${filename}`)
              .pipe(unzipper.Extract({ path: `./files/${zipfilename}` }))
              .on('close', () => {
                // 删除目录中的zip文件
                fs.unlinkSync(`./files/${zipfilename}/${filename}`);
                res.status(200).json({ success: true, url: `/files/${zipfilename}`, type: 'dir' });
              });
          });
        } else {
          fs.rename(files?.file.filepath, `./files/${filename}`, () => {
            res.status(200).json({ success: true, url: `/files/${filename}`, type: 'file' });
          });
        }
      } else {
        res.status(500).json({ success: false, message: '上传失败' });
      }
    });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

// const handler = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
    
//     const form = new formidable.IncomingForm();
//     form.parse(req, async (err, fields, files) => {
//       // 判断是否是目录上传
//       if (files?.file) {
//         // 获取后缀
//         const extname = files?.file.mimetype.split('/')[1];
//         // 生成新的文件名
//         const filename = uuidv4() + '.' + extname;
//         // 将文件保存到files
//         fs.rename(files?.file.filepath, `./files/${filename}`, () => {
//           res.status(200).json({ success: true, url: `/files/${filename}`,type: 'file' });
//         });
//       } else {
//         res.status(500).json({ success: false, message: '上传失败' });
//       }
//     });
//     // res.status(200).json({ success: true });
//   } catch (error) {
//     res.status(500).json({ success: false });
//   }
// };

export default handler;
