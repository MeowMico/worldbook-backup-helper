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
