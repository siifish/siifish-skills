#!/usr/bin/env node
/**
 * 从灵感文本中提取关键词
 */

function extractKeywords(text, existingTags = []) {
  // 清理文本
  const cleaned = text
    .replace(/[，。！？、；：""''（）【】]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 提取潜在关键词（长度 2-10 的中文字符串）
  const candidates = [];
  
  // 1. 提取引号中的内容
  const quoted = text.match(/[""']([^""']+)[""']/g);
  if (quoted) {
    quoted.forEach(q => {
      const word = q.replace(/[""']/g, '').trim();
      if (word.length >= 2 && word.length <= 15) {
        candidates.push({ word, score: 10, reason: '引号标注' });
      }
    });
  }

  // 2. 提取技术术语（大写字母组合）
  const techTerms = text.match(/\b[A-Z]{2,}[a-z]*\b/g);
  if (techTerms) {
    techTerms.forEach(term => {
      candidates.push({ word: term, score: 9, reason: '技术术语' });
    });
  }

  // 3. 提取英文单词（可能是专业术语）
  const englishWords = text.match(/\b[a-zA-Z]{3,}\b/g);
  if (englishWords) {
    englishWords.forEach(word => {
      if (!['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'her', 'way', 'many', 'oil', 'sit', 'set', 'run', 'eat', 'far', 'sea', 'eye', 'ago', 'off', 'too', 'any', 'say', 'man', 'try', 'ask', 'end', 'why', 'let', 'put', 'say', 'she', 'try', 'way', 'own', 'say', 'too', 'old', 'tell', 'very', 'when', 'much', 'would', 'there', 'their', 'what', 'said', 'each', 'which', 'will', 'about', 'could', 'other', 'after', 'first', 'never', 'these', 'think', 'where', 'being', 'every', 'great', 'might', 'shall', 'still', 'those', 'while', 'this', 'that', 'with', 'have', 'from', 'they', 'been', 'were', 'said', 'time', 'than', 'them', 'into', 'just', 'like', 'over', 'also', 'back', 'only', 'know', 'take', 'year', 'good', 'some', 'come', 'make', 'well', 'look', 'want', 'here', 'work', 'life', 'even', 'more', 'find', 'give', 'most', 'very', 'what', 'know', 'take', 'year', 'good', 'some', 'come', 'make', 'well', 'look', 'want', 'here', 'work', 'life', 'even', 'more', 'find', 'give', 'most'].includes(word.toLowerCase())) {
        candidates.push({ word, score: 7, reason: '英文术语' });
      }
    });
  }

  // 4. 提取中文名词短语（简单启发式：连续的中文字符）
  const chineseSegments = cleaned.match(/[\u4e00-\u9fa5]{2,8}/g);
  if (chineseSegments) {
    // 统计词频
    const freq = {};
    chineseSegments.forEach(seg => {
      freq[seg] = (freq[seg] || 0) + 1;
    });
    
    Object.entries(freq).forEach(([word, count]) => {
      if (count >= 1) {
        candidates.push({ word, score: count * 2 + 3, reason: '中文关键词' });
      }
    });
  }

  // 5. 检查与现有标签的匹配
  existingTags.forEach(tag => {
    const tagName = tag.split('/').pop();
    if (text.includes(tagName)) {
      candidates.push({ word: tagName, score: 15, reason: '匹配已有标签' });
    }
  });

  // 去重并按分数排序
  const seen = new Set();
  const unique = candidates
    .filter(c => {
      if (seen.has(c.word)) return false;
      seen.add(c.word);
      return true;
    })
    .sort((a, b) => b.score - a.score);

  // 返回前 4 个
  return unique.slice(0, 4).map(c => c.word);
}

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  const text = process.argv[2];
  if (!text) {
    console.error('Usage: node extract-keywords.mjs "灵感文本"');
    process.exit(1);
  }
  
  const keywords = extractKeywords(text);
  console.log(JSON.stringify(keywords, null, 2));
}

export { extractKeywords };
