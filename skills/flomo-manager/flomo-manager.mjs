#!/usr/bin/env node
/**
 * Flomo Manager - 主执行脚本
 * 完整的灵感记录流程
 */

import { existsSync, readFileSync } from 'fs';
import { extractKeywords } from './extract-keywords.mjs';
import { searchRelatedNotes, getTagTree } from './search-notes.mjs';
import { recommendTags } from './recommend-tags.mjs';
import { sendToFlomo } from './send-to-flomo.mjs';
import { initCache } from './init-cache.mjs';
import { updateUserPreferences } from './update-preferences.mjs';

const CACHE_DIR = process.env.CACHE_DIR || './cache';
const CONFIG_PATH = process.env.CONFIG_PATH || '../config/mcporter.json';

/**
 * 分析相关笔记的风格
 */
function analyzeRelatedStyle(memos) {
  if (!memos || memos.length === 0) {
    return {
      avgLength: 1000,
      hasTitle: true,
      useBold: true,
      useLinks: true,
      paragraphStyle: 'natural'
    };
  }
  
  const totalLength = memos.reduce((sum, m) => sum + (m.word_count || 0), 0);
  const avgLength = Math.round(totalLength / memos.length);
  
  let titleCount = 0;
  let boldCount = 0;
  let linkCount = 0;
  
  memos.forEach(memo => {
    const content = memo.content || '';
    if (content.match(/^\*\*.+\*\*/m)) titleCount++;
    if (content.match(/\*\*.+\*\*/g)) boldCount++;
    if (content.includes('http') || content.includes('关联自')) linkCount++;
  });
  
  return {
    avgLength,
    hasTitle: titleCount / memos.length > 0.3,
    useBold: boldCount / memos.length > 0.3,
    useLinks: linkCount / memos.length > 0.2,
    paragraphStyle: 'natural'
  };
}

/**
 * 撰写笔记
 */
function writeNote(input, relatedMemos, style, relatedNoteId = null, tags = []) {
  const targetLength = style.avgLength || 1000;
  const minLength = Math.max(800, targetLength - 200);
  const maxLength = Math.min(1200, targetLength + 200);
  
  // 提取核心内容
  const mainContent = input.trim();
  
  // 生成标题（从内容中提取或概括）
  let title = '';
  if (style.hasTitle) {
    // 尝试提取第一句话作为标题，或概括主题
    const firstSentence = mainContent.split(/[。！？\n]/)[0];
    if (firstSentence.length <= 30) {
      title = firstSentence;
    } else {
      // 提取关键词组合成标题
      const keywords = extractKeywords(mainContent).slice(0, 3);
      title = keywords.join('、') + '的思考';
    }
  }
  
  // 构建正文
  let body = mainContent;
  
  // 如果内容较短，尝试扩展（基于相关笔记的风格）
  if (body.length < minLength && relatedMemos.length > 0) {
    // 可以在这里添加智能扩展逻辑
    // 目前保持原始内容
  }
  
  // 添加加粗标记（对关键概念）
  if (style.useBold) {
    const keywords = extractKeywords(body);
    keywords.forEach(keyword => {
      // 只给第一次出现的关键词加粗
      const regex = new RegExp(`(?<!\*)${keyword}(?!\*)`, 'i');
      body = body.replace(regex, `**${keyword}**`);
    });
  }
  
  // 构建完整笔记
  let note = '';
  
  if (title) {
    note += `**${title}**\n\n`;
  }
  
  // 标签放在标题下面、正文上面
  if (tags && tags.length > 0) {
    note += tags.join(' ') + '\n\n';
  }
  
  note += body;
  
  // 添加关联笔记
  if (style.useLinks && relatedNoteId) {
    note += `\n\n关联自： https://v.flomoapp.com/mine/?memo_id=${relatedNoteId} `;
  }
  
  return note;
}

/**
 * 主流程
 */
async function main(input) {
  console.log('🎯 Flomo Manager 启动\n');
  
  // 1. 检查缓存
  if (!existsSync(`${CACHE_DIR}/tag_tree.json`)) {
    console.log('⏳ 首次使用，正在初始化缓存...');
    const success = await initCache();
    if (!success) {
      console.error('❌ 缓存初始化失败，请检查 flomo MCP 配置');
      process.exit(1);
    }
    console.log('✅ 缓存初始化完成\n');
  }
  
  // 2. 提取关键词
  console.log('🔍 提取关键词...');
  let allTags = [];
  try {
    const tagTree = JSON.parse(readFileSync(`${CACHE_DIR}/tag_tree.json`, 'utf-8'));
    allTags = tagTree.tags || [];
  } catch (e) {
    console.warn('⚠️ 无法读取标签树');
  }
  
  const keywords = extractKeywords(input, allTags);
  console.log(`💡 提取的关键词：${keywords.join('、')}`);
  console.log('（请确认或修改关键词，直接回车确认，输入新关键词替换）\n');
  
  // 3. 检索相关笔记
  console.log('📚 检索相关笔记...');
  const relatedMemos = await searchRelatedNotes(keywords, 5);
  console.log(`找到 ${relatedMemos.length} 条相关笔记`);
  
  if (relatedMemos.length > 0) {
    console.log('\n相关笔记摘要：');
    relatedMemos.slice(0, 3).forEach((memo, i) => {
      const preview = memo.content?.split('\n')[0]?.slice(0, 50) || '无内容';
      console.log(`  ${i + 1}. ${preview}...`);
    });
  }
  console.log();
  
  // 4. 分析风格并撰写
  console.log('✍️ 撰写笔记...');
  const style = analyzeRelatedStyle(relatedMemos);
  const primaryRelatedId = relatedMemos[0]?.id;
  const noteContent = writeNote(input, relatedMemos, style, primaryRelatedId);
  
  // 5. 推荐标签
  const tagRecommendations = recommendTags(noteContent, relatedMemos, allTags);
  const tagStr = tagRecommendations.map(r => `#${r.tag}`);
  
  // 6. 使用标签重新撰写笔记（标签在标题下、正文上）
  const noteContentWithTags = writeNote(input, relatedMemos, style, primaryRelatedId, tagStr);
  
  // 7. 展示结果
  console.log('─'.repeat(50));
  console.log('📝 撰写的笔记：\n');
  console.log(noteContentWithTags);
  console.log('\n' + '─'.repeat(50));
  
  console.log('\n推荐标签说明：');
  tagRecommendations.forEach(r => {
    console.log(`  #${r.tag} - ${r.reason}`);
  });
  
  console.log('\n✅ 请回复：发送 / 修改 / 取消');
  
  // 返回结果供交互使用
  return {
    keywords,
    relatedMemos,
    noteContent: noteContentWithTags,
    tagRecommendations,
    style
  };
}

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node flomo-manager.mjs "灵感内容"');
    process.exit(1);
  }
  
  main(input).catch(err => {
    console.error('❌ 执行失败:', err.message);
    process.exit(1);
  });
}

export { main, analyzeRelatedStyle, writeNote };
