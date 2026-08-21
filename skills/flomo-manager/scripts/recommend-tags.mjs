#!/usr/bin/env node
/**
 * 根据内容和相关笔记推荐标签
 */

import { readFileSync } from 'fs';

const CACHE_DIR = process.argv[4] || './cache';

function recommendTags(content, relatedMemos = [], allTags = []) {
  const recommendations = [];
  
  // 1. 从相关笔记中提取标签
  const relatedTags = new Map();
  relatedMemos.forEach(memo => {
    (memo.tags || []).forEach(tag => {
      relatedTags.set(tag, (relatedTags.get(tag) || 0) + 1);
    });
  });
  
  // 按出现频率排序，取前3个
  const topRelatedTags = Array.from(relatedTags.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => ({ tag, reason: '来自相关笔记', score: 10 }));
  
  recommendations.push(...topRelatedTags);
  
  // 2. 根据内容匹配标签树中的标签
  allTags.forEach(tag => {
    const tagName = tag.split('/').pop();
    if (content.includes(tagName)) {
      recommendations.push({ tag, reason: '内容匹配', score: 8 });
    }
  });
  
  // 3. 检查用户偏好
  try {
    const prefs = JSON.parse(readFileSync(`${CACHE_DIR}/user_preferences.json`, 'utf-8'));
    (prefs.preferredTags || []).forEach(tag => {
      if (content.toLowerCase().includes(tag.toLowerCase())) {
        recommendations.push({ tag, reason: '用户偏好', score: 9 });
      }
    });
  } catch (e) {
    // 无偏好文件，忽略
  }
  
  // 4. 智能推测（基于内容关键词）
  const contentLower = content.toLowerCase();
  
  // 技术领域
  if (contentLower.includes('llm') || contentLower.includes('大模型') || contentLower.includes('gpt')) {
    recommendations.push({ tag: '领域路线/LLM', reason: '内容推测', score: 7 });
  }
  if (contentLower.includes('agent') || contentLower.includes('智能体')) {
    recommendations.push({ tag: '领域路线/AI_Agent', reason: '内容推测', score: 7 });
  }
  if (contentLower.includes('vla') || contentLower.includes('具身') || contentLower.includes('导航')) {
    recommendations.push({ tag: '领域路线/具身智能', reason: '内容推测', score: 7 });
  }
  
  // 笔记类型
  if (contentLower.includes('论文') || contentLower.includes('arxiv') || contentLower.includes('研究')) {
    recommendations.push({ tag: 'RESO/📍摘要卡', reason: '内容推测', score: 7 });
  }
  if (contentLower.includes('心得') || contentLower.includes('思考') || contentLower.includes('感悟')) {
    recommendations.push({ tag: 'AREA/AI心得/认知', reason: '内容推测', score: 6 });
  }
  
  // 去重并排序
  const seen = new Set();
  const unique = recommendations
    .filter(r => {
      if (seen.has(r.tag)) return false;
      seen.add(r.tag);
      return true;
    })
    .sort((a, b) => b.score - a.score);
  
  // 返回前 5 个
  return unique.slice(0, 5);
}

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  const content = process.argv[2];
  if (!content) {
    console.error('Usage: node recommend-tags.mjs "笔记内容" [relatedMemosJson] [allTagsJson]');
    process.exit(1);
  }
  
  const relatedMemos = process.argv[3] ? JSON.parse(process.argv[3]) : [];
  const allTags = process.argv[4] ? JSON.parse(process.argv[4]) : [];
  
  const tags = recommendTags(content, relatedMemos, allTags);
  console.log(JSON.stringify(tags, null, 2));
}

export { recommendTags };
