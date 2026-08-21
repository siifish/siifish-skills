#!/usr/bin/env node
/**
 * 搜索相关笔记
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_CONFIG = resolve(__dirname, '../../../config/mcporter.json');
const CONFIG_PATH = process.argv[3] || DEFAULT_CONFIG;

async function searchRelatedNotes(keywords, limit = 5) {
  try {
    const keywordStr = Array.isArray(keywords) ? keywords.join(' ') : keywords;
    
    const result = execSync(
      `npx mcporter call flomo.memo_search --config ${CONFIG_PATH} --args '${JSON.stringify({
        keywords: keywordStr,
        limit: limit
      })}' --output json`,
      { encoding: 'utf-8' }
    );
    
    const data = JSON.parse(result);
    return data.memos || [];
  } catch (error) {
    console.error('搜索笔记失败:', error.message);
    return [];
  }
}

async function getRelatedNotesById(noteId, limit = 3) {
  try {
    const result = execSync(
      `npx mcporter call flomo.memo_recommended --config ${CONFIG_PATH} --args '${JSON.stringify({
        id: noteId,
        limit: limit
      })}' --output json`,
      { encoding: 'utf-8' }
    );
    
    const data = JSON.parse(result);
    return data.memos || [];
  } catch (error) {
    console.error('获取相关笔记失败:', error.message);
    return [];
  }
}

async function getTagTree() {
  try {
    const result = execSync(
      `npx mcporter call flomo.tag_tree --config ${CONFIG_PATH} --output json`,
      { encoding: 'utf-8' }
    );
    
    return JSON.parse(result);
  } catch (error) {
    console.error('获取标签树失败:', error.message);
    return { tags: [] };
  }
}

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  const keywords = process.argv[2];
  if (!keywords) {
    console.error('Usage: node search-notes.mjs "关键词" [limit]');
    process.exit(1);
  }
  
  const limit = parseInt(process.argv[3]) || 5;
  searchRelatedNotes(keywords, limit).then(notes => {
    console.log(JSON.stringify(notes, null, 2));
  });
}

export { searchRelatedNotes, getRelatedNotesById, getTagTree };
