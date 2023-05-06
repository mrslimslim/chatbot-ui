const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // 导航至博客网页
  await page.goto('https://your-blog-url.com', {
    waitUntil: 'networkidle2',
  });

  // 将网页转换为 PDF
  const pdfBuffer = await page.pdf({ format: 'A4' });

  // 将 PDF 保存到文件
  await fs.writeFile('output.pdf', pdfBuffer);

  // 提取 PDF 中的文本信息
  const pdfData = await pdfParse(pdfBuffer);
  const pdfText = pdfData.text;

  console.log(pdfText);

  // 关闭浏览器
  await browser.close();
})();
