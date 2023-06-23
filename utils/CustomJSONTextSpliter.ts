import * as acorn from 'acorn';
import { Document } from 'langchain/document';
import {
  RecursiveCharacterTextSplitter,
  RecursiveCharacterTextSplitterParams,
} from 'langchain/text_splitter';
import fs from 'fs';

// 扩展重写RecursiveCharacterTextSplitter

export class CustomJSONTextSplitter extends RecursiveCharacterTextSplitter {
  [x: string]: any;
  constructor(
    fields: Partial<RecursiveCharacterTextSplitterParams> | undefined,
  ) {
    super(fields);
  }

  async createDocuments(texts: string | any[], metadatas = []) {
    const _metadatas =
      metadatas.length > 0 ? metadatas : new Array(texts.length).fill({});
    const documents = new Array();
    let metaInfo = [];
    for (let i = 0; i < texts.length; i += 1) {
      const text = texts[i];
      let lineCounterIndex = 1;
      let prevChunk = null;
      if (!this.isValidJsObject(text)) {
        console.log('text',text)
        throw new Error('jsonString is not a valid json string')
      }
      for (const chunk of await this.splitText(text)) {
        // we need to count the \n that are in the text before getting removed by the splitting
        let numberOfIntermediateNewLines = 0;
        let startScope = []
        let endScope = []
        let indexChunk = 0
        let indexEndChunk = 0
        if (prevChunk) {
          indexChunk = text.indexOf(chunk);
          indexEndChunk = indexChunk + chunk.length;
          const indexEndPrevChunk = text.indexOf(prevChunk) + prevChunk.length;
          const removedNewlinesFromSplittingText = text.slice(
            indexEndPrevChunk,
            indexChunk,
          );
          startScope = this.getScopeInfo(text, indexChunk);
          endScope = this.getScopeInfo(text, indexEndChunk);
          
          numberOfIntermediateNewLines = (
            removedNewlinesFromSplittingText.match(/\n/g) || []
          ).length;
        }
        lineCounterIndex += numberOfIntermediateNewLines;
        const newLinesCount = (chunk.match(/\n/g) || []).length;
        const loc =
          _metadatas[i].loc && typeof _metadatas[i].loc === 'object'
            ? { ..._metadatas[i].loc }
            : {};
        loc.lines = {
          from: lineCounterIndex,
          to: lineCounterIndex + newLinesCount,
        };
        const metadataWithLinesNumber = {
          ..._metadatas[i],
          loc,
          startScope: startScope.map(item=> item.value).join('>') + `>${indexChunk}`,
          endScope: endScope.map(item=> item.value).join('>')  + `>${indexEndChunk}`,
        };
        const startScopeStr = startScope.map(item=> item.value).join('>');
        const endScopeStr = endScope.map(item=> item.value).join('>');
        metaInfo.push(metadataWithLinesNumber);
        documents.push(
          new Document({
            pageContent: `>>>startScopeStr:"${startScopeStr}"<<< content:${chunk} >>>endScopeStr:"${endScopeStr}"<<<`,
            metadata: metadataWithLinesNumber,
          }),
        );
        lineCounterIndex += newLinesCount;
        prevChunk = chunk;
      }
    }
    fs.writeFileSync('./metaInfo.json', JSON.stringify(metaInfo))
    
    return documents;
  }


  isValidJsObject(str: string) {
    // 使用正则表达式将属性名用双引号引起来
    // str = '(' + str + ')'; // 括号用于处理类似 '{a: 1}' 的对象字面量，使其能够被正确解析
    try {
      const ast = acorn.parse(str, { ecmaVersion: 2020 });
      console.log('ast', ast)
      if (ast.type === 'Program' && ast.body.length === 0) {
        return false;
      }
      const expression = ast.type === 'Program' ? ast.body[0] : ast;
      return expression.type === 'ExpressionStatement' && expression.expression.type === 'ObjectExpression';
    } catch (e) {
      console.log('e',e);
      return false;
    }
  }


  getScopeInfo(jsonString: string, index: number, scope: any[] = []) {
    //判断是否是json字符串
    if (typeof jsonString !== 'string') {
      throw new Error('jsonString must be a string');
    }
    //判断是否是有效的json字符串
    const ast = acorn.parseExpressionAt(jsonString);

    function findScope(node: any, scope: any[] = []) {
      if (node.start <= index && node.end >= index) {
        if (node.type === 'ObjectExpression' || node.type === 'Property') {
          for (const property of node.properties) {
            if (property.start <= index && property.end >= index) {
              return findScope(property.value, [...scope, property.key]);
            }
            if (property.value.start <= index && property.value.end >= index) {
              return findScope(property.value, [...scope, property.key]);
            }
          }
        }
        return scope;
      }
      return scope || null;
    }

    return findScope(ast, scope);
  }
}
