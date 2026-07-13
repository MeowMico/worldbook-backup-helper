'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../../webview-ui/i18n.js');

test('language preference follows the editor and supports explicit overrides', () => {
  assert.equal(i18n.resolveLanguage('auto', 'zh-cn'), 'zh');
  assert.equal(i18n.resolveLanguage('auto', 'zh-tw'), 'zh');
  assert.equal(i18n.resolveLanguage('auto', 'fr'), 'en');
  assert.equal(i18n.resolveLanguage('en', 'zh-cn'), 'en');
  assert.equal(i18n.resolveLanguage('zh-cn', 'en'), 'zh');
  assert.equal(i18n.normalizePreference('unknown'), 'auto');
});

test('translations interpolate values and fall back to English source text', () => {
  assert.equal(i18n.translate('zh', 'Snapshot created: {label}', { label: 'A' }), '已创建快照：A');
  assert.equal(i18n.translate('zh', 'Preview Setup'), '预览设置');
  assert.equal(i18n.translate('zh', 'Open user guide'), '打开使用手册');
  assert.equal(i18n.translate('zh', 'Untranslated text'), 'Untranslated text');
  assert.equal(i18n.translate('en', 'Snapshot created: {label}', { label: 'A' }), 'Snapshot created: A');
});

test('SillyTavern world-info terms match the 1.18.0 Simplified Chinese locale', () => {
  const expected = {
    WI_Entry_Status_Normal: '关键词',
    Constant: '永久',
    Position: '插入位置',
    'Before Character': '角色定义前（↑Char）',
    'After Character': '角色定义后（↓Char）',
    'Before Example Messages': '示例消息前（↑EM）',
    'After Example Messages': '示例消息后（↓EM）',
    'Top of Author Note': '作者注释前（↑AN）',
    'Bottom of Author Note': '作者注释后（↓AN）',
    'at Depth System': '[系统⚙] 插入深度 @D',
    'at Depth User': '[用户👤] 插入深度 @D',
    'at Depth AI': '[AI🤖] 插入深度 @D',
    Outlet: '➡️ 锚点',
    'Primary Keywords': '主要关键字',
    'Secondary Keywords': '可选过滤器',
    'Selective Logic': '逻辑',
    'AND Any': '与任意',
    'AND All': '与所有',
    'NOT Any': '非任何',
    'NOT All': '非所有',
    'Use Optional Filter': '选择性',
    'Use Probability': '使用概率',
    'Non-recursable': '不可递归（不会被其他条目激活）',
    'Prevent further recursion': '防止进一步递归',
    'Delay until recursion': '延迟到递归',
    'Ignore budget': '无视回复限额',
    'Recursion Level': '递归等级',
    Sticky: '黏性',
    'Not sticky': '无黏性',
    Continue: '续写',
    Impersonate: 'AI 帮答',
    Swipe: '备选回复',
    'Context %': '上下文百分比',
    'Budget Cap': 'Token 预算上限',
    'Min Activations': '最小激活数',
    'Max Recursion Steps': '最大递归深度',
    'Include Names': '包括名称',
    'Match Whole Words': '匹配整个单词',
    'Use Group Scoring': '使用群组评分',
    'Alert On Overflow': '溢出警报',
  };

  for (const [source, translated] of Object.entries(expected)) {
    assert.equal(i18n.translate('zh', source), translated, source);
  }
  assert.equal(i18n.translate('en', 'WI_Entry_Status_Normal'), 'Normal');
});

test('DOM localizer switches captured static text and attributes without losing English sources', () => {
  const textNode = { nodeValue: '  Save  ' };
  const attributes = new Map([['title', 'Undo worldbook edit']]);
  const element = {
    hasAttribute: name => attributes.has(name),
    getAttribute: name => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const nodes = [textNode];
  const document = {
    documentElement: { lang: 'en' },
    body: { querySelectorAll: () => [element] },
    createTreeWalker: () => ({
      nextNode: () => nodes.shift() || null,
    }),
  };
  const localizer = i18n.createDomLocalizer(document);

  localizer.apply('zh');
  assert.equal(textNode.nodeValue, '  保存  ');
  assert.equal(attributes.get('title'), '撤销世界书编辑');
  assert.equal(document.documentElement.lang, 'zh-CN');

  localizer.apply('en');
  assert.equal(textNode.nodeValue, '  Save  ');
  assert.equal(attributes.get('title'), 'Undo worldbook edit');
  assert.equal(document.documentElement.lang, 'en');
});
