#!/usr/bin/env node
/**
 * 初始化 Flomo Manager 缓存
 * 拉取标签树和最近笔记用于风格分析
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_DIR = process.argv[2] || resolve(__dirname, '../cache');
const DEFAULT_CONFIG = resolve(__dirname, '../../../config/mcporter.json');
const CONFIG_PATH = process.argv[3] || DEFAULT_CONFIG;

async function initCache() {
  console.log('🔄 正在初始化缓存...');
  
  // 确保缓存目录存在
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  try {
    // 1. 拉取标签树
    console.log('📋 拉取标签树...');
    const tagTreeResult = execSync(
      `npx mcporter call flomo.tag_tree --config ${CONFIG_PATH} --output json`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );
    const tagTree = JSON.parse(tagTreeResult);
    writeFileSync(`${CACHE_DIR}/tag_tree.json`, JSON.stringify(tagTree, null, 2));
    console.log(`✅ 已缓存 ${tagTree.tags?.length || 0} 个标签`);

    // 2. 拉取最近笔记（用于风格分析）
    console.log('📝 拉取最近笔记...');
    const recentResult = execSync(
      `npx mcporter call flomo.memo_search --config ${CONFIG_PATH} --args '{"limit":20}' --output json`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );
    const recentNotes = JSON.parse(recentResult);
    writeFileSync(`${CACHE_DIR}/recent_notes.json`, JSON.stringify(recentNotes, null, 2));
    console.log(`✅ 已缓存 ${recentNotes.memos?.length || 0} 条笔记`);

    // 3. 生成风格配置文件
    console.log('🎨 分析写作风格...');
    const styleProfile = analyzeStyle(recentNotes.memos || []);
    writeFileSync(`${CACHE_DIR}/style_profile.json`, JSON.stringify(styleProfile, null, 2));

    // 4. 初始化用户偏好
    if (!existsSync(`${CACHE_DIR}/user_preferences.json`)) {
      writeFileSync(`${CACHE_DIR}/user_preferences.json`, JSON.stringify({
        preferredTags: [],
        styleAdjustments: [],
        tagAssociations: {}
      }, null, 2));
    }

    // 5. 记录更新时间
    writeFileSync(`${CACHE_DIR}/last_update.txt`, new Date().toISOString());

    console.log('✅ 缓存初始化完成！');
    return true;
  } catch (error) {
    console.error('❌ 缓存初始化失败:', error.message);
    return false;
  }
}

function analyzeStyle(memos) {
  const style = {
    avgLength: 0,
    commonPatterns: [],
    hasTitle: false,
    useBold: false,
    useLinks: false,
    paragraphStyle: 'natural'
  };

  if (memos.length === 0) return style;

  // 分析平均长度
  const totalLength = memos.reduce((sum, m) => sum + (m.word_count || 0), 0);
  style.avgLength = Math.round(totalLength / memos.length);

  // 分析格式特征
  let titleCount = 0;
  let boldCount = 0;
  let linkCount = 0;

  memos.forEach(memo => {
    const content = memo.content || '';
    if (content.match(/^\*\*.+\*\*/m)) titleCount++;
    if (content.match(/\*\*.+\*\*/g)) boldCount++;
    if (content.includes('http')) linkCount++;
  });

  style.hasTitle = titleCount / memos.length > 0.5;
  style.useBold = boldCount / memos.length > 0.3;
  style.useLinks = linkCount / memos.length > 0.2;

  return style;
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  initCache().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { initCache, analyzeStyle };
