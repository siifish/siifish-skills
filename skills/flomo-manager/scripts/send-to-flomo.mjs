#!/usr/bin/env node
/**
 * 发送笔记到 flomo
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 默认从 openclaw workspace 配置目录解析（脚本在 skills/flomo-manager/scripts/ 下）
const DEFAULT_CONFIG = resolve(__dirname, '../../../config/mcporter.json');
const CONFIG_PATH = process.argv[3] || DEFAULT_CONFIG;

async function sendToFlomo(content, createdAt = null) {
  try {
    const args = {
      content: content,
      format: 'markdown'
    };
    
    if (createdAt) {
      args.created_at = createdAt;
    }
    
    const result = execSync(
      `npx mcporter call flomo.memo_create --config ${CONFIG_PATH} --args '${JSON.stringify(args)}' --output json`,
      { encoding: 'utf-8' }
    );
    
    const data = JSON.parse(result);
    return {
      success: true,
      id: data.id,
      createdAt: data.created_at,
      wordCount: data.word_count,
      tags: data.tags
    };
  } catch (error) {
    console.error('发送笔记失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  const content = process.argv[2];
  if (!content) {
    console.error('Usage: node send-to-flomo.mjs "笔记内容" [created_at]');
    process.exit(1);
  }
  
  const createdAt = process.argv[3] || null;
  sendToFlomo(content, createdAt).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}

export { sendToFlomo };
