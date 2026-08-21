#!/usr/bin/env node
/**
 * 更新用户偏好
 * 记录用户选择的标签和风格调整
 */

import { readFileSync, writeFileSync } from 'fs';

const CACHE_DIR = process.argv[3] || './cache';

function updateUserPreferences(note, userModifications = {}) {
  const prefsPath = `${CACHE_DIR}/user_preferences.json`;
  
  let prefs = {
    preferredTags: [],
    styleAdjustments: [],
    tagAssociations: {}
  };
  
  try {
    prefs = JSON.parse(readFileSync(prefsPath, 'utf-8'));
  } catch (e) {
    // 文件不存在，使用默认值
  }
  
  // 1. 记录使用的标签（增加权重）
  (note.tags || []).forEach(tag => {
    const existing = prefs.preferredTags.find(p => p.tag === tag);
    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.lastUsed = new Date().toISOString();
    } else {
      prefs.preferredTags.push({
        tag,
        count: 1,
        firstUsed: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      });
    }
    
    // 记录标签关联（哪些标签经常一起使用）
    (note.tags || []).forEach(otherTag => {
      if (otherTag !== tag) {
        if (!prefs.tagAssociations[tag]) {
          prefs.tagAssociations[tag] = {};
        }
        prefs.tagAssociations[tag][otherTag] = (prefs.tagAssociations[tag][otherTag] || 0) + 1;
      }
    });
  });
  
  // 2. 记录风格调整
  if (userModifications.styleChanges) {
    prefs.styleAdjustments.push({
      date: new Date().toISOString(),
      changes: userModifications.styleChanges,
      noteId: note.id
    });
    
    // 只保留最近 20 条调整记录
    if (prefs.styleAdjustments.length > 20) {
      prefs.styleAdjustments = prefs.styleAdjustments.slice(-20);
    }
  }
  
  // 保存
  writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));
  
  return prefs;
}

function getPreferredTags(limit = 10) {
  const prefsPath = `${CACHE_DIR}/user_preferences.json`;
  
  try {
    const prefs = JSON.parse(readFileSync(prefsPath, 'utf-8'));
    return prefs.preferredTags
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, limit)
      .map(p => p.tag);
  } catch (e) {
    return [];
  }
}

function getRelatedTags(tag, limit = 5) {
  const prefsPath = `${CACHE_DIR}/user_preferences.json`;
  
  try {
    const prefs = JSON.parse(readFileSync(prefsPath, 'utf-8'));
    const associations = prefs.tagAssociations[tag] || {};
    
    return Object.entries(associations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([t]) => t);
  } catch (e) {
    return [];
  }
}

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'get-preferred') {
    const limit = parseInt(process.argv[3]) || 10;
    console.log(JSON.stringify(getPreferredTags(limit), null, 2));
  } else if (command === 'get-related') {
    const tag = process.argv[3];
    if (!tag) {
      console.error('Usage: node update-preferences.mjs get-related "标签名"');
      process.exit(1);
    }
    const limit = parseInt(process.argv[4]) || 5;
    console.log(JSON.stringify(getRelatedTags(tag, limit), null, 2));
  } else {
    console.log('Usage:');
    console.log('  node update-preferences.mjs get-preferred [limit]');
    console.log('  node update-preferences.mjs get-related "标签名" [limit]');
    process.exit(1);
  }
}

export { updateUserPreferences, getPreferredTags, getRelatedTags };
