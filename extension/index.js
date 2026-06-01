import { getRequestHeaders } from '/script.js';
import { saveWorldInfo } from '/scripts/world-info.js';

const PLUGIN_ROOT = '/api/plugins/worldbook-backup-helper';
const DB_NAME = 'worldbook-backup-helper';
const DB_VERSION = 2;
const SNAPSHOT_STORE = 'snapshots';
const EXPERIMENT_STORE = 'experiments';

const POSITION_OPTIONS = [
  { value: 0, key: 'position.beforeChar' },
  { value: 1, key: 'position.afterChar' },
  { value: 5, key: 'position.beforeExample' },
  { value: 6, key: 'position.afterExample' },
  { value: 2, key: 'position.topAn' },
  { value: 3, key: 'position.bottomAn' },
  { value: 4, key: 'position.depth' },
];

const ROLE_OPTIONS = [
  { value: 0, key: 'role.system' },
  { value: 1, key: 'role.user' },
  { value: 2, key: 'role.assistant' },
];

const SELECTIVE_LOGIC_OPTIONS = [
  { value: 0, key: 'logic.andAny' },
  { value: 3, key: 'logic.andAll' },
  { value: 2, key: 'logic.notAny' },
  { value: 1, key: 'logic.notAll' },
];

const LIST_FIELDS = new Set(['key', 'keysecondary', 'characterFilterNames', 'characterFilterTags', 'triggers']);
const NUMBER_FIELDS = new Set(['order', 'position', 'depth', 'probability', 'selectiveLogic', 'role', 'groupWeight', 'sticky', 'cooldown', 'delay', 'scanDepth', 'delayUntilRecursion']);
const NULLABLE_NUMBER_FIELDS = new Set(['groupWeight', 'sticky', 'cooldown', 'delay', 'scanDepth']);
const TRI_STATE_BOOLEAN_FIELDS = new Set(['caseSensitive', 'matchWholeWords', 'useGroupScoring']);
const FIND_FIELDS = ['comment', 'content', 'key', 'keysecondary', 'group', 'automationId', 'outletName', 'characterFilterNames', 'characterFilterTags', 'triggers'];
const MAX_UNDO_STEPS = 80;
const THEME_MODES = ['auto', 'light', 'dark'];
const THEME_QUERY = window.matchMedia?.('(prefers-color-scheme: dark)');
const THEME_BACKGROUND_VARS = ['--SmartThemeBodyColor', '--SmartThemeBlurTintColor', '--SmartThemeChatTintColor'];
const LANGUAGE_MODES = ['auto', 'en', 'zh'];
const DIFF_ENTRY_FIELDS = [
  'comment',
  'content',
  'key',
  'keysecondary',
  'constant',
  'disable',
  'selective',
  'vectorized',
  'useProbability',
  'ignoreBudget',
  'position',
  'role',
  'depth',
  'order',
  'probability',
  'scanDepth',
  'selectiveLogic',
  'caseSensitive',
  'matchWholeWords',
  'group',
  'groupWeight',
  'useGroupScoring',
  'groupOverride',
  'excludeRecursion',
  'preventRecursion',
  'delayUntilRecursion',
  'addMemo',
  'sticky',
  'cooldown',
  'delay',
  'automationId',
  'outletName',
  'characterFilterNames',
  'characterFilterTags',
  'triggers',
  'characterFilterExclude',
  'matchPersonaDescription',
  'matchCharacterDescription',
  'matchCharacterPersonality',
  'matchCharacterDepthPrompt',
  'matchScenario',
  'matchCreatorNotes',
];
const DIFF_FIELD_LABELS = {
  comment: 'field.title',
  content: 'field.content',
  key: 'field.keys',
  keysecondary: 'field.secondary',
  constant: 'flag.constant',
  disable: 'field.enabled',
  selective: 'flag.selective',
  vectorized: 'flag.vectorized',
  useProbability: 'flag.useProbability',
  ignoreBudget: 'flag.ignoreBudget',
  position: 'field.position',
  role: 'field.role',
  depth: 'field.depth',
  order: 'field.order',
  probability: 'field.probability',
  scanDepth: 'field.scanDepth',
  selectiveLogic: 'field.selectiveLogic',
  caseSensitive: 'field.caseSensitive',
  matchWholeWords: 'field.wholeWords',
  group: 'field.group',
  groupWeight: 'field.groupWeight',
  useGroupScoring: 'field.groupScoring',
  groupOverride: 'flag.groupOverride',
  excludeRecursion: 'flag.excludeRecursion',
  preventRecursion: 'flag.preventRecursion',
  delayUntilRecursion: 'flag.delayUntilRecursion',
  addMemo: 'flag.addMemo',
  sticky: 'field.sticky',
  cooldown: 'field.cooldown',
  delay: 'field.delay',
  automationId: 'field.automationId',
  outletName: 'field.outletName',
  characterFilterNames: 'field.characterNames',
  characterFilterTags: 'field.characterTags',
  triggers: 'field.triggers',
  characterFilterExclude: 'flag.excludeCharacterFilter',
  matchPersonaDescription: 'field.matchPersona',
  matchCharacterDescription: 'field.matchDescription',
  matchCharacterPersonality: 'field.matchPersonality',
  matchCharacterDepthPrompt: 'field.matchDepthPrompt',
  matchScenario: 'field.matchScenario',
  matchCreatorNotes: 'field.matchCreatorNotes',
};
const BOOLEAN_DIFF_FIELDS = new Set([
  'constant',
  'selective',
  'vectorized',
  'useProbability',
  'ignoreBudget',
  'groupOverride',
  'excludeRecursion',
  'preventRecursion',
  'delayUntilRecursion',
  'addMemo',
  'characterFilterExclude',
  'matchPersonaDescription',
  'matchCharacterDescription',
  'matchCharacterPersonality',
  'matchCharacterDepthPrompt',
  'matchScenario',
  'matchCreatorNotes',
]);

const TRANSLATIONS = {
  en: {
    'app.title': 'Worldbook Backup Helper',
    'menu.open': 'Worldbook Backups',
    'status.extensionMode': 'Extension-only mode: snapshots are stored in this browser.',
    'status.ready': 'Ready',
    'status.refreshing': 'Refreshing',
    'status.viewingExperiment': 'Viewing experiment: {title}',
    'status.experimentRenamed': 'Experiment renamed',
    'status.experimentNoteSaved': 'Experiment note saved',
    'status.experimentJsonExported': 'Experiment JSON exported',
    'status.exportingArchive': 'Exporting worldbook archive',
    'status.archiveExported': 'Worldbook archive JSON exported',
    'status.loadedForEditing': 'Loaded {source} for editing: {label}',
    'status.noMatches': 'No matches',
    'status.matches': '{current}/{total} matches',
    'status.noMatchToReplace': 'No match to replace',
    'status.replacedMatch': 'Replaced match',
    'status.noMatchesToReplace': 'No matches to replace',
    'status.replacedMatches': 'Replaced {count} {noun}',
    'status.unsavedEdits': 'Unsaved edits',
    'status.undo': 'Undo: {label}',
    'status.redo': 'Redo: {label}',
    'status.savingWorldbook': 'Saving worldbook',
    'status.saved': 'Saved',
    'status.reloadingWorldbook': 'Reloading worldbook',
    'status.experimentCreatedFromVersion': 'Experiment created from version',
    'status.creatingSnapshot': 'Creating snapshot',
    'status.skippedDuplicate': 'Skipped duplicate',
    'status.snapshotCreated': 'Snapshot created',
    'status.finishOpenExperiment': 'Finish "{title}" before starting another',
    'status.startingExperiment': 'Starting experiment',
    'status.experimentStarted': 'Experiment started',
    'status.finishingExperiment': 'Finishing experiment',
    'status.updatingExperiment': 'Updating experiment',
    'status.experimentSaved': 'Experiment saved',
    'status.restoring': 'Restoring',
    'status.restored': 'Restored',
    'status.restoredLabel': 'Restored {label}',
    'status.changedEntries': '{current}/{total} changed entries',
    'theme.label': 'Theme',
    'theme.auto': 'Auto',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.autoTitle': 'Auto: following SillyTavern ({resolved})',
    'theme.useTitle': 'Use {mode} theme',
    'language.label': 'Language',
    'language.auto': 'Auto',
    'language.en': 'EN',
    'language.zh': '中文',
    'language.autoTitle': 'Auto: following page/browser ({resolved})',
    'language.useTitle': 'Use {mode}',
    'action.refresh': 'Refresh',
    'action.close': 'Close',
    'action.exportAll': 'Export all',
    'action.start': 'Start',
    'action.finish': 'Finish',
    'action.updateAfter': 'Update After',
    'action.keep': 'Keep',
    'action.reject': 'Reject',
    'action.origin': 'Origin',
    'action.baseline': 'Baseline',
    'action.after': 'After',
    'action.edit': 'Edit',
    'action.diff': 'Diff',
    'action.history': 'History',
    'action.showHistory': 'Show history',
    'action.hideHistory': 'Hide history',
    'action.find': 'Find',
    'action.hideFind': 'Hide find',
    'action.undo': 'Undo',
    'action.redo': 'Redo',
    'action.new': 'New',
    'action.duplicate': 'Duplicate',
    'action.delete': 'Delete',
    'action.reload': 'Reload',
    'action.save': 'Save',
    'action.saveNote': 'Save note',
    'action.snapshot': 'Snapshot',
    'action.current': 'Current',
    'action.previous': 'Previous',
    'action.prev': 'Prev',
    'action.next': 'Next',
    'action.replace': 'Replace',
    'action.all': 'All',
    'action.prevChange': 'Prev change',
    'action.nextChange': 'Next change',
    'action.restore': 'Restore',
    'action.name': 'Name',
    'action.note': 'Note',
    'action.json': 'JSON',
    'action.exp': 'Exp',
    'action.more': 'More',
    'section.worldbooks': 'Worldbooks',
    'section.entries': 'Entries',
    'section.origin': 'Origin',
    'section.experiments': 'Experiments',
    'section.versions': 'Versions',
    'section.activation': 'Activation',
    'section.insertion': 'Insertion',
    'section.logic': 'Logic',
    'section.timingFilters': 'Timing and Filters',
    'section.matchSources': 'Match Sources',
    'empty.noWorldbookSelected': 'No worldbook selected',
    'empty.noExperimentSelected': 'No experiment selected',
    'empty.noEntrySelected': 'No entry selected',
    'empty.noOriginYet': 'No origin yet',
    'empty.noExperimentsYet': 'No experiments yet',
    'empty.noMatchingExperiments': 'No matching experiments',
    'empty.noWorldbookLoaded': 'No worldbook loaded',
    'empty.noEntries': 'No entries',
    'empty.noVersionsYet': 'No versions yet',
    'empty.selectSnapshot': 'Select a snapshot',
    'empty.noPreviousVersion': 'No previous version',
    'empty.noBaseline': 'No baseline',
    'empty.noChanges': 'No changes',
    'placeholder.search': 'Search',
    'placeholder.findEntries': 'Find in entries',
    'placeholder.replace': 'Replace',
    'placeholder.searchExperiments': 'Search experiments',
    'placeholder.note': 'Experiment note, e.g. This version is better for Claude than Gemini',
    'placeholder.noteDisabled': 'Select an experiment to write a note',
    'placeholder.snapshotNote': 'Note, e.g. trimmed xxx',
    'tooltip.hideWorldbooks': 'Hide worldbooks',
    'tooltip.showWorldbooks': 'Show worldbooks',
    'tooltip.history': 'Show or hide the history sidebar',
    'tooltip.findReplace': 'Show or hide find and replace',
    'tooltip.exportExperimentJson': 'Export experiment JSON',
    'tooltip.promoteExperiment': 'Create experiment from this version',
    'tooltip.restoreExperimentReady': 'Restore this experiment result',
    'tooltip.restoreExperimentDisabled': 'Save or finish the experiment before restoring its result',
    'tooltip.roleDepthOnly': 'Role is only used for @ Depth entries',
    'field.title': 'Title',
    'field.content': 'Content',
    'field.keys': 'Keys',
    'field.secondary': 'Secondary',
    'field.position': 'Position',
    'field.role': 'Role',
    'field.depth': 'Depth',
    'field.order': 'Order',
    'field.probability': 'Probability',
    'field.scanDepth': 'Scan Depth',
    'field.selectiveLogic': 'Selective Logic',
    'field.caseSensitive': 'Case Sensitive',
    'field.wholeWords': 'Whole Words',
    'field.group': 'Group',
    'field.groupWeight': 'Group Weight',
    'field.groupScoring': 'Group Scoring',
    'field.sticky': 'Sticky',
    'field.cooldown': 'Cooldown',
    'field.delay': 'Delay',
    'field.automationId': 'Automation ID',
    'field.outletName': 'Outlet Name',
    'field.characterNames': 'Character Names',
    'field.characterTags': 'Character Tags',
    'field.triggers': 'Triggers',
    'field.matchPersona': 'Persona',
    'field.matchDescription': 'Description',
    'field.matchPersonality': 'Personality',
    'field.matchDepthPrompt': 'Depth Prompt',
    'field.matchScenario': 'Scenario',
    'field.matchCreatorNotes': 'Creator Notes',
    'field.enabled': 'Enabled',
    'flag.constant': 'Constant',
    'flag.disabled': 'Disabled',
    'flag.selective': 'Selective',
    'flag.vectorized': 'Vectorized',
    'flag.useProbability': 'Use Probability',
    'flag.ignoreBudget': 'Ignore Budget',
    'flag.groupOverride': 'Group Override',
    'flag.excludeRecursion': 'Exclude Recursion',
    'flag.preventRecursion': 'Prevent Recursion',
    'flag.delayUntilRecursion': 'Delay Until Recursion',
    'flag.addMemo': 'Add Memo',
    'flag.excludeCharacterFilter': 'Exclude Character Filter',
    'value.global': 'Global',
    'value.on': 'On',
    'value.off': 'Off',
    'value.blank': '(blank)',
    'value.untitled': '(untitled)',
    'value.entry': 'entry',
    'value.normal': 'Normal',
    'position.beforeChar': 'Before Char Defs',
    'position.afterChar': 'After Char Defs',
    'position.beforeExample': 'Before Example Messages',
    'position.afterExample': 'After Example Messages',
    'position.topAn': 'Top of AN',
    'position.bottomAn': 'Bottom of AN',
    'position.depth': '@ Depth',
    'position.fallback': 'position {value}',
    'role.system': 'System',
    'role.user': 'User',
    'role.assistant': 'Assistant',
    'role.depth': '{role} depth {depth}',
    'logic.andAny': 'AND any',
    'logic.andAll': 'AND all',
    'logic.notAny': 'NOT any',
    'logic.notAll': 'NOT all',
    'status.testing': 'Testing',
    'status.kept': 'Kept',
    'status.rejected': 'Rejected',
    'count.entries': '{count} entries',
    'count.entry': '{count} entry',
    'count.unsaved': 'unsaved',
    'count.loaded': 'loaded: {source}',
    'count.matches': '{count} matches',
    'count.match': '{count} match',
    'prompt.experimentName': 'Experiment name / problem',
    'prompt.experimentNote': 'Experiment note',
    'prompt.versionName': 'Version name',
    'confirm.replaceMatches': 'Replace {count} {noun}?',
    'confirm.deleteEntry': 'Delete "{title}"?',
    'confirm.discardEdits': 'Discard unsaved workbench edits?',
    'confirm.saveBeforeFinish': 'Save workbench edits before finishing this experiment?',
    'confirm.restoreExperimentPoint': 'Restore "{book}" to {point} of "{title}"?',
    'confirm.restoreSnapshot': 'Restore "{book}" to "{label}"?',
    'label.current': 'Current',
    'label.version': 'Version',
    'label.origin': 'Origin',
    'label.experiment': 'Experiment {date}',
    'label.currentExperiment': 'current experiment',
    'label.untitledExperiment': 'Untitled experiment',
    'label.untitledVersion': 'Untitled version',
    'label.beforeAutoSave': 'Before auto save',
    'label.afterAutoSave': 'After auto save',
    'label.beforeSave': 'Before save: {title}',
    'label.afterSave': 'After save: {title}',
    'label.manualSnapshot': 'Manual snapshot',
    'label.manualSnapshotExperiment': 'Manual snapshot: {title}',
    'label.baseline': 'Baseline: {title}',
    'label.after': 'After: {title}',
    'label.originSnapshot': 'Origin: {name}',
    'label.beforeRestore': 'Before restore {date}',
    'label.beforeRestoreTo': 'Before restore to {label} {date}',
    'label.experimentResult': 'experiment result: {title}',
    'label.fromVersion': 'From version: {label}',
    'label.createdFromVersion': 'Created from saved version',
    'label.savedFromWorkbench': 'Saved from workbench',
    'label.change': 'change',
    'label.workbenchEdit': 'Workbench edit',
    'label.rangeAfter': 'Baseline -> After',
    'label.rangeCurrent': 'Baseline -> Current',
    'diff.summary': '+{added} -{removed} ~{changed} unchanged {unchanged}',
    'diff.summaryWithRange': '{range} | +{added} -{removed} ~{changed} unchanged {unchanged}',
    'diff.entry': 'ENTRY',
    'diff.added': 'ADDED',
    'diff.removed': 'REMOVED',
    'diff.changed': 'CHANGED',
  },
  zh: {
    'app.title': '世界书备份助手',
    'menu.open': '世界书备份',
    'status.extensionMode': '本地扩展模式：快照会保存在此浏览器中。',
    'status.ready': '就绪',
    'status.refreshing': '正在刷新',
    'status.viewingExperiment': '正在查看实验：{title}',
    'status.experimentRenamed': '实验已重命名',
    'status.experimentNoteSaved': '实验备注已保存',
    'status.experimentJsonExported': '实验 JSON 已导出',
    'status.exportingArchive': '正在导出世界书合集',
    'status.archiveExported': '世界书历史合集 JSON 已导出',
    'status.loadedForEditing': '已载入{source}用于编辑：{label}',
    'status.noMatches': '没有匹配项',
    'status.matches': '{current}/{total} 个匹配项',
    'status.noMatchToReplace': '没有可替换的匹配项',
    'status.replacedMatch': '已替换匹配项',
    'status.noMatchesToReplace': '没有可替换的匹配项',
    'status.replacedMatches': '已替换 {count} 个匹配项',
    'status.unsavedEdits': '有未保存编辑',
    'status.undo': '已撤回：{label}',
    'status.redo': '已重做：{label}',
    'status.savingWorldbook': '正在保存世界书',
    'status.saved': '已保存',
    'status.reloadingWorldbook': '正在重新读取世界书',
    'status.experimentCreatedFromVersion': '已从此版本创建实验',
    'status.creatingSnapshot': '正在创建快照',
    'status.skippedDuplicate': '内容重复，已跳过',
    'status.snapshotCreated': '快照已创建',
    'status.finishOpenExperiment': '请先结束“{title}”再开始新实验',
    'status.startingExperiment': '正在开始实验',
    'status.experimentStarted': '实验已开始',
    'status.finishingExperiment': '正在结束实验',
    'status.updatingExperiment': '正在更新实验结果',
    'status.experimentSaved': '实验已保存',
    'status.restoring': '正在回溯',
    'status.restored': '已回溯',
    'status.restoredLabel': '已回溯到 {label}',
    'status.changedEntries': '{current}/{total} 个变更条目',
    'theme.label': '主题',
    'theme.auto': '自动',
    'theme.light': '浅色',
    'theme.dark': '深色',
    'theme.autoTitle': '自动：跟随 SillyTavern（{resolved}）',
    'theme.useTitle': '使用{mode}主题',
    'language.label': '语言',
    'language.auto': '自动',
    'language.en': 'EN',
    'language.zh': '中文',
    'language.autoTitle': '自动：跟随页面/浏览器（{resolved}）',
    'language.useTitle': '使用{mode}',
    'action.refresh': '刷新',
    'action.close': '关闭',
    'action.exportAll': '导出全部',
    'action.start': '开始',
    'action.finish': '完成',
    'action.updateAfter': '更新结果',
    'action.keep': '保留',
    'action.reject': '放弃',
    'action.origin': '原版',
    'action.baseline': '改前',
    'action.after': '改后',
    'action.edit': '编辑',
    'action.diff': '对比',
    'action.history': '历史',
    'action.showHistory': '显示历史',
    'action.hideHistory': '隐藏历史',
    'action.find': '查找',
    'action.hideFind': '隐藏查找',
    'action.undo': '撤回',
    'action.redo': '重做',
    'action.new': '新建',
    'action.duplicate': '复制',
    'action.delete': '删除',
    'action.reload': '重新读取',
    'action.save': '保存',
    'action.saveNote': '保存备注',
    'action.snapshot': '快照',
    'action.current': '当前',
    'action.previous': '上一版',
    'action.prev': '上一个',
    'action.next': '下一个',
    'action.replace': '替换',
    'action.all': '全部',
    'action.prevChange': '上一处变化',
    'action.nextChange': '下一处变化',
    'action.restore': '回溯',
    'action.name': '改名',
    'action.note': '备注',
    'action.json': 'JSON',
    'action.exp': '实验',
    'action.more': '更多',
    'section.worldbooks': '世界书',
    'section.entries': '条目',
    'section.origin': '原版',
    'section.experiments': '实验',
    'section.versions': '版本',
    'section.activation': '激活',
    'section.insertion': '插入',
    'section.logic': '逻辑',
    'section.timingFilters': '额外匹配来源',
    'section.matchSources': '筛选生成触发器',
    'empty.noWorldbookSelected': '未选择世界书',
    'empty.noExperimentSelected': '未选择实验',
    'empty.noEntrySelected': '未选择条目',
    'empty.noOriginYet': '暂无原版',
    'empty.noExperimentsYet': '暂无实验',
    'empty.noMatchingExperiments': '没有匹配的实验',
    'empty.noWorldbookLoaded': '未读取世界书',
    'empty.noEntries': '暂无条目',
    'empty.noVersionsYet': '暂无版本',
    'empty.selectSnapshot': '请选择一个快照',
    'empty.noPreviousVersion': '没有上一版',
    'empty.noBaseline': '没有改前版本',
    'empty.noChanges': '没有变化',
    'placeholder.search': '搜索',
    'placeholder.findEntries': '在条目中查找',
    'placeholder.replace': '替换为',
    'placeholder.searchExperiments': '搜索实验',
    'placeholder.note': '实验备注，例如：这个版本不太适配 Gemini，下次用 Claude 试试',
    'placeholder.noteDisabled': '选择实验后可写备注',
    'placeholder.snapshotNote': '备注，例如：删减了 xxx',
    'tooltip.hideWorldbooks': '隐藏世界书列表',
    'tooltip.showWorldbooks': '显示世界书列表',
    'tooltip.history': '显示或隐藏历史栏',
    'tooltip.findReplace': '显示或隐藏查找替换',
    'tooltip.exportExperimentJson': '导出实验 JSON',
    'tooltip.promoteExperiment': '从此版本创建实验',
    'tooltip.restoreExperimentReady': '回溯到此实验结果',
    'tooltip.restoreExperimentDisabled': '请先保存或完成实验，再回溯实验结果',
    'tooltip.roleDepthOnly': '只有“插入深度 @D”条目会使用 Role',
    'field.title': '标题（备忘）',
    'field.content': '内容',
    'field.keys': '主要关键字',
    'field.secondary': '可选过滤器',
    'field.position': '插入位置',
    'field.role': '角色',
    'field.depth': '深度',
    'field.order': '顺序',
    'field.probability': '触发概率 %',
    'field.scanDepth': '扫描深度',
    'field.selectiveLogic': '逻辑',
    'field.caseSensitive': '区分大小写',
    'field.wholeWords': '完整单词',
    'field.group': '包含组',
    'field.groupWeight': '组权重',
    'field.groupScoring': '组评分',
    'field.sticky': '粘性',
    'field.cooldown': '冷却',
    'field.delay': '延迟',
    'field.automationId': '自动化 ID',
    'field.outletName': '锚点',
    'field.characterNames': '绑定到角色',
    'field.characterTags': '绑定到标签',
    'field.triggers': '触发器',
    'field.matchPersona': '用户描述',
    'field.matchDescription': '角色描述',
    'field.matchPersonality': '角色人格',
    'field.matchDepthPrompt': '深度提示词',
    'field.matchScenario': '场景',
    'field.matchCreatorNotes': '作者备注',
    'field.enabled': '启用状态',
    'flag.constant': '常驻',
    'flag.disabled': '禁用',
    'flag.selective': '可选',
    'flag.vectorized': '向量化',
    'flag.useProbability': '使用触发概率',
    'flag.ignoreBudget': '无视回复限额',
    'flag.groupOverride': '确定优先级',
    'flag.excludeRecursion': '不可递归',
    'flag.preventRecursion': '防止进一步递归',
    'flag.delayUntilRecursion': '延迟到递归',
    'flag.addMemo': '添加备忘',
    'flag.excludeCharacterFilter': '排除',
    'value.global': '使用全局',
    'value.on': '开启',
    'value.off': '关闭',
    'value.blank': '（空）',
    'value.untitled': '（未命名）',
    'value.entry': '条目',
    'value.normal': '普通',
    'position.beforeChar': '角色定义前（↑Char）',
    'position.afterChar': '角色定义后（↓Char）',
    'position.beforeExample': '示例消息前（↑EM）',
    'position.afterExample': '示例消息后（↓EM）',
    'position.topAn': '作者注释前（↑AN）',
    'position.bottomAn': '作者注释后（↓AN）',
    'position.depth': '[系统] 插入深度 @D',
    'position.fallback': '位置 {value}',
    'role.system': '系统',
    'role.user': '用户',
    'role.assistant': 'AI',
    'role.depth': '{role} 深度 {depth}',
    'logic.andAny': '与任意',
    'logic.andAll': '与全部',
    'logic.notAny': '非任意',
    'logic.notAll': '非全部',
    'status.testing': '测试中',
    'status.kept': '已保留',
    'status.rejected': '已放弃',
    'count.entries': '{count} 个条目',
    'count.entry': '{count} 个条目',
    'count.unsaved': '未保存',
    'count.loaded': '已载入：{source}',
    'count.matches': '{count} 个匹配项',
    'count.match': '{count} 个匹配项',
    'prompt.experimentName': '实验名称 / 问题记录',
    'prompt.experimentNote': '实验备注',
    'prompt.versionName': '版本名称',
    'confirm.replaceMatches': '替换 {count} 个匹配项吗？',
    'confirm.deleteEntry': '删除“{title}”吗？',
    'confirm.discardEdits': '放弃未保存的工作台编辑吗？',
    'confirm.saveBeforeFinish': '完成实验前保存工作台编辑吗？',
    'confirm.restoreExperimentPoint': '把“{book}”回溯到“{title}”的{point}吗？',
    'confirm.restoreSnapshot': '把“{book}”回溯到“{label}”吗？',
    'label.current': '当前',
    'label.version': '版本',
    'label.origin': '原版',
    'label.experiment': '实验 {date}',
    'label.currentExperiment': '当前实验',
    'label.untitledExperiment': '未命名实验',
    'label.untitledVersion': '未命名版本',
    'label.beforeAutoSave': '自动保存前',
    'label.afterAutoSave': '自动保存后',
    'label.beforeSave': '保存前：{title}',
    'label.afterSave': '保存后：{title}',
    'label.manualSnapshot': '手动快照',
    'label.manualSnapshotExperiment': '手动快照：{title}',
    'label.baseline': '改前：{title}',
    'label.after': '改后：{title}',
    'label.originSnapshot': '原版：{name}',
    'label.beforeRestore': '回溯前 {date}',
    'label.beforeRestoreTo': '回溯到 {label} 前 {date}',
    'label.experimentResult': '实验结果：{title}',
    'label.fromVersion': '来自版本：{label}',
    'label.createdFromVersion': '从已保存版本创建',
    'label.savedFromWorkbench': '从工作台保存',
    'label.change': '改动',
    'label.workbenchEdit': '工作台编辑',
    'label.rangeAfter': '改前 -> 改后',
    'label.rangeCurrent': '改前 -> 当前',
    'diff.summary': '+{added} -{removed} ~{changed} 未变 {unchanged}',
    'diff.summaryWithRange': '{range} | +{added} -{removed} ~{changed} 未变 {unchanged}',
    'diff.entry': '条目',
    'diff.added': '新增',
    'diff.removed': '删除',
    'diff.changed': '变更',
  },
};

const ENTRY_DEFAULTS = {
  key: [],
  keysecondary: [],
  comment: '',
  content: '',
  constant: false,
  vectorized: false,
  selective: true,
  selectiveLogic: 0,
  addMemo: true,
  order: 100,
  position: 0,
  disable: false,
  ignoreBudget: false,
  excludeRecursion: false,
  preventRecursion: false,
  delayUntilRecursion: 0,
  probability: 100,
  useProbability: true,
  depth: 4,
  role: null,
  scanDepth: null,
  caseSensitive: null,
  matchWholeWords: null,
  useGroupScoring: null,
  outletName: '',
  group: '',
  groupOverride: false,
  groupWeight: null,
  automationId: '',
  sticky: null,
  cooldown: null,
  delay: null,
  characterFilterNames: [],
  characterFilterTags: [],
  characterFilterExclude: false,
  triggers: [],
  matchPersonaDescription: false,
  matchCharacterDescription: false,
  matchCharacterPersonality: false,
  matchCharacterDepthPrompt: false,
  matchScenario: false,
  matchCreatorNotes: false,
};

const app = {
  installed: false,
  snapshotInFlight: false,
  serverPluginAvailable: null,
  books: [],
  snapshots: [],
  experiments: [],
  originSnapshot: null,
  activeBook: null,
  activeData: null,
  activeDataHash: '',
  editorSourceLabel: '',
  activeEntryId: null,
  activeSnapshot: null,
  activeExperiment: null,
  activeView: 'snapshot',
  mainTab: 'edit',
  editorDirty: false,
  findQuery: '',
  replaceText: '',
  findMatches: [],
  activeFindIndex: -1,
  undoStack: [],
  redoStack: [],
  pendingInputHistoryKey: '',
  diffChangeIndex: -1,
  booksCollapsed: readBooleanSetting('wbh-books-collapsed'),
  historyCollapsed: readBooleanSetting('wbh-history-collapsed'),
  findCollapsed: readBooleanSetting('wbh-find-collapsed'),
  themeMode: readStringSetting('wbh-theme-mode', 'auto', THEME_MODES),
  languageMode: readStringSetting('wbh-language-mode', 'auto', LANGUAGE_MODES),
  diffMode: 'current',
};

const ORIGINAL_FETCH = window.fetch.bind(window);

init();

function init() {
  if (app.installed) return;
  app.installed = true;
  installThemeListener();
  installLanguageListener();
  installWorkbenchButton();
  installWorldbookEditInterceptor();
}

function installThemeListener() {
  const render = () => renderThemeMode();
  if (THEME_QUERY && typeof THEME_QUERY.addEventListener === 'function') {
    THEME_QUERY.addEventListener('change', render);
  } else if (THEME_QUERY && typeof THEME_QUERY.addListener === 'function') {
    THEME_QUERY.addListener(render);
  }
  const observer = new MutationObserver(render);
  [document.documentElement, document.body].filter(Boolean).forEach(element => {
    observer.observe(element, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'theme'] });
  });
}

function installLanguageListener() {
  const render = () => {
    if (app.languageMode !== 'auto') return;
    renderLanguageMode();
    renderThemeMode();
    renderEditor();
    renderOriginSnapshot();
    renderExperiments();
    renderSnapshots();
    void renderDiff();
  };
  const observer = new MutationObserver(render);
  [document.documentElement, document.body].filter(Boolean).forEach(element => {
    observer.observe(element, { attributes: true, attributeFilter: ['lang', 'data-language', 'data-locale'] });
  });
}

function installWorkbenchButton() {
  const add = () => {
    const menu = document.querySelector('#extensionsMenu');
    if (!menu || document.querySelector('#wbh-open-workbench')) return;

    const button = document.createElement('div');
    button.id = 'wbh-open-workbench';
    button.className = 'list-group-item flex-container flexGap5 interactable';
    button.tabIndex = 0;
    button.textContent = t('menu.open');
    button.addEventListener('click', openWorkbench);
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openWorkbench();
      }
    });
    menu.append(button);
  };

  add();
  const observer = new MutationObserver(add);
  observer.observe(document.body, { childList: true, subtree: true });
}

async function openWorkbench() {
  if (await hasServerPlugin()) {
    window.open(`${PLUGIN_ROOT}/ui`, '_blank', 'noopener,noreferrer');
    return;
  }

  ensureLocalWorkbench();
  await refreshLocalWorkbench();
  document.querySelector('#wbh-workbench').classList.add('open');
}

async function hasServerPlugin() {
  if (app.serverPluginAvailable !== null) return app.serverPluginAvailable;

  try {
    const response = await ORIGINAL_FETCH(`${PLUGIN_ROOT}/worldbooks`, { credentials: 'include' });
    app.serverPluginAvailable = response.ok;
  } catch {
    app.serverPluginAvailable = false;
  }

  return app.serverPluginAvailable;
}

function installWorldbookEditInterceptor() {
  window.fetch = async function worldbookBackupFetch(input, initOptions = {}) {
    const requestInfo = normalizeRequest(input, initOptions);
    if (shouldSnapshotBeforeSave(requestInfo)) {
      await snapshotBeforeSave(requestInfo.body);
      const response = await ORIGINAL_FETCH(input, initOptions);
      if (response.ok) {
        await snapshotAfterSave(requestInfo.body);
      }
      return response;
    }
    return ORIGINAL_FETCH(input, initOptions);
  };
}

function normalizeRequest(input, initOptions) {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.pathname
      : input?.url || '';
  const method = String(initOptions?.method || input?.method || 'GET').toUpperCase();
  const body = initOptions?.body || input?.body || null;
  return { url, method, body };
}

function shouldSnapshotBeforeSave({ url, method, body }) {
  if (app.snapshotInFlight || method !== 'POST' || !body) return false;
  try {
    const target = new URL(url, window.location.origin);
    return target.pathname === '/api/worldinfo/edit';
  } catch {
    return String(url).includes('/api/worldinfo/edit');
  }
}

async function snapshotBeforeSave(body) {
  let payload = null;
  try {
    payload = typeof body === 'string' ? JSON.parse(body) : null;
  } catch {
    payload = null;
  }

  const name = String(payload?.name || '').trim();
  if (!name) return;

  app.snapshotInFlight = true;
  try {
    if (await createRemoteSnapshot(name)) return;
    await createLocalSnapshot(name, {
      label: 'Before auto save',
      reason: 'auto',
      skipDuplicate: true,
    });
  } catch (error) {
    console.warn('[Worldbook Backup Helper] Auto snapshot failed.', error);
  } finally {
    app.snapshotInFlight = false;
  }
}

async function createRemoteSnapshot(name) {
  if (app.serverPluginAvailable === false) return false;
  try {
    const response = await ORIGINAL_FETCH(`${PLUGIN_ROOT}/snapshots`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        name,
        reason: 'auto',
        label: 'Before auto save',
        skipDuplicate: true,
      }),
      credentials: 'include',
    });
    app.serverPluginAvailable = response.ok;
    return response.ok;
  } catch {
    app.serverPluginAvailable = false;
    return false;
  }
}

async function snapshotAfterSave(body) {
  let payload = null;
  try {
    payload = typeof body === 'string' ? JSON.parse(body) : null;
  } catch {
    payload = null;
  }

  const name = String(payload?.name || '').trim();
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : null;
  if (!name || !data) return;

  try {
    if (await createRemoteSnapshotFromData(name, data)) return;
    await createLocalSnapshotFromData(name, data, {
      label: 'After auto save',
      reason: 'auto-after',
      skipDuplicate: true,
    });
    await syncWorkbenchFromSavedWorldbook(name, data);
  } catch (error) {
    console.warn('[Worldbook Backup Helper] Post-save snapshot failed.', error);
  }
}

async function syncWorkbenchFromSavedWorldbook(name, data) {
  if (app.activeBook?.name !== name || app.editorDirty) return;
  if (app.editorSourceLabel && app.editorSourceLabel !== 'Current') return;
  app.activeData = cloneValue(data);
  app.activeDataHash = await hashObject(app.activeData);
  app.editorSourceLabel = 'Current';
  ensureActiveEntry();
  renderEditor();
}

async function createRemoteSnapshotFromData(name, data) {
  if (app.serverPluginAvailable === false) return false;
  try {
    const response = await ORIGINAL_FETCH(`${PLUGIN_ROOT}/snapshots`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        name,
        data,
        reason: 'auto-after',
        label: 'After auto save',
        skipDuplicate: true,
      }),
      credentials: 'include',
    });
    app.serverPluginAvailable = response.ok;
    return response.ok;
  } catch {
    app.serverPluginAvailable = false;
    return false;
  }
}

function ensureLocalWorkbench() {
  if (document.querySelector('#wbh-workbench')) return;

  const root = document.createElement('div');
  root.id = 'wbh-workbench';
  root.innerHTML = `
    <div class="wbh-panel" role="dialog" aria-modal="true" aria-label="${t('app.title')}">
      <header class="wbh-header">
        <div>
          <h2 data-wbh-i18n="app.title">${t('app.title')}</h2>
          <p id="wbh-status">${t('status.extensionMode')}</p>
        </div>
        <div class="wbh-actions">
          <div class="wbh-language-toggle" role="group" aria-label="${t('language.label')}">
            <button type="button" data-wbh-language="auto" data-wbh-i18n="language.auto">${t('language.auto')}</button>
            <button type="button" data-wbh-language="en" data-wbh-i18n="language.en">${t('language.en')}</button>
            <button type="button" data-wbh-language="zh" data-wbh-i18n="language.zh">${t('language.zh')}</button>
          </div>
          <div class="wbh-theme-toggle" role="group" aria-label="${t('theme.label')}">
            <button type="button" data-wbh-theme="auto" data-wbh-i18n="theme.auto">${t('theme.auto')}</button>
            <button type="button" data-wbh-theme="light" data-wbh-i18n="theme.light">${t('theme.light')}</button>
            <button type="button" data-wbh-theme="dark" data-wbh-i18n="theme.dark">${t('theme.dark')}</button>
          </div>
          <button id="wbh-refresh" type="button" data-wbh-i18n="action.refresh">${t('action.refresh')}</button>
          <button id="wbh-close" type="button" data-wbh-i18n="action.close">${t('action.close')}</button>
        </div>
      </header>
      <main class="wbh-grid">
        <section id="wbh-book-pane" class="wbh-pane wbh-book-pane">
          <div class="wbh-pane-head wbh-book-head">
            <div class="wbh-book-title">
              <h3 data-wbh-i18n="section.worldbooks">${t('section.worldbooks')}</h3>
              <span id="wbh-book-count">0</span>
            </div>
            <button id="wbh-toggle-books" class="wbh-icon-button" type="button" title="${t('tooltip.hideWorldbooks')}" aria-label="${t('tooltip.hideWorldbooks')}">&lt;</button>
          </div>
          <div class="wbh-book-content">
            <input id="wbh-book-search" type="search" placeholder="${t('placeholder.search')}" data-wbh-i18n-placeholder="placeholder.search">
            <div id="wbh-books" class="wbh-list"></div>
          </div>
        </section>
        <section class="wbh-pane wbh-main">
          <div class="wbh-pane-head">
            <h3 id="wbh-active-title">${t('empty.noWorldbookSelected')}</h3>
            <div class="wbh-head-actions">
              <span id="wbh-active-meta">${entriesLabel(0)}</span>
              <button id="wbh-export-all" class="wbh-mini" type="button" disabled data-wbh-i18n="action.exportAll">${t('action.exportAll')}</button>
            </div>
          </div>
          <div class="wbh-experiment">
            <div class="wbh-experiment-text">
              <strong id="wbh-experiment-title">${t('empty.noExperimentSelected')}</strong>
              <small id="wbh-experiment-meta">${t('status.ready')}</small>
            </div>
            <div class="wbh-experiment-actions">
              <button id="wbh-start-experiment" type="button" data-wbh-i18n="action.start">${t('action.start')}</button>
              <button id="wbh-finish-experiment" type="button">${t('action.finish')}</button>
              <button id="wbh-keep-experiment" type="button" data-wbh-i18n="action.keep">${t('action.keep')}</button>
              <button id="wbh-reject-experiment" type="button" data-wbh-i18n="action.reject">${t('action.reject')}</button>
              <button id="wbh-restore-origin" type="button" data-wbh-i18n="action.origin">${t('action.origin')}</button>
              <button id="wbh-restore-baseline" type="button" data-wbh-i18n="action.baseline">${t('action.baseline')}</button>
              <button id="wbh-restore-after" type="button" data-wbh-i18n="action.after">${t('action.after')}</button>
            </div>
          </div>
          <div class="wbh-viewbar">
            <div class="wbh-tabs">
              <button id="wbh-tab-edit" type="button" class="active" data-wbh-i18n="action.edit">${t('action.edit')}</button>
              <button id="wbh-tab-diff" type="button" data-wbh-i18n="action.diff">${t('action.diff')}</button>
            </div>
            <div class="wbh-view-options">
              <button id="wbh-toggle-history" type="button" title="${t('tooltip.history')}">${t('action.history')}</button>
            </div>
            <div class="wbh-editor-actions">
              <button id="wbh-editor-undo" type="button" disabled data-wbh-i18n="action.undo">${t('action.undo')}</button>
              <button id="wbh-editor-redo" type="button" disabled data-wbh-i18n="action.redo">${t('action.redo')}</button>
              <button id="wbh-entry-new" type="button" data-wbh-i18n="action.new">${t('action.new')}</button>
              <button id="wbh-entry-duplicate" type="button" disabled data-wbh-i18n="action.duplicate">${t('action.duplicate')}</button>
              <button id="wbh-entry-delete" type="button" class="danger" disabled data-wbh-i18n="action.delete">${t('action.delete')}</button>
              <button id="wbh-editor-reload" type="button" data-wbh-i18n="action.reload">${t('action.reload')}</button>
              <button id="wbh-editor-save" type="button" disabled data-wbh-i18n="action.save">${t('action.save')}</button>
            </div>
          </div>
          <div id="wbh-editor-view" class="wbh-editor-view">
            <aside class="wbh-entry-pane">
              <div class="wbh-entry-pane-head">
                <strong data-wbh-i18n="section.entries">${t('section.entries')}</strong>
                <button id="wbh-toggle-find" type="button" title="${t('tooltip.findReplace')}">${t('action.find')}</button>
              </div>
              <div class="wbh-findbar">
                <div class="wbh-find-row">
                  <input id="wbh-entry-search" type="search" placeholder="${t('placeholder.findEntries')}" data-wbh-i18n-placeholder="placeholder.findEntries">
                  <span id="wbh-find-count">0/0</span>
                </div>
                <div class="wbh-find-row wbh-find-actions">
                  <button id="wbh-find-prev" type="button" data-wbh-i18n="action.prev">${t('action.prev')}</button>
                  <button id="wbh-find-next" type="button" data-wbh-i18n="action.next">${t('action.next')}</button>
                </div>
                <div class="wbh-find-row">
                  <input id="wbh-replace-text" type="text" placeholder="${t('placeholder.replace')}" data-wbh-i18n-placeholder="placeholder.replace">
                </div>
                <div class="wbh-find-row wbh-find-actions">
                  <button id="wbh-replace-one" type="button" data-wbh-i18n="action.replace">${t('action.replace')}</button>
                  <button id="wbh-replace-all" type="button" data-wbh-i18n="action.all">${t('action.all')}</button>
                </div>
              </div>
              <div id="wbh-entries" class="wbh-list"></div>
            </aside>
            <section class="wbh-entry-editor">
              <div class="wbh-entry-title">
                <h3 id="wbh-entry-title">${t('empty.noEntrySelected')}</h3>
                <span id="wbh-entry-meta"></span>
              </div>
              <label class="wbh-editor-field wbh-title-field">
                <span data-wbh-i18n="field.title">${t('field.title')}</span>
                <input id="wbh-entry-comment" type="text" data-wbh-field="comment">
              </label>
              <label class="wbh-editor-field wbh-editor-field-wide wbh-content-field">
                <span data-wbh-i18n="field.content">${t('field.content')}</span>
                <textarea id="wbh-entry-content" data-wbh-field="content" rows="12"></textarea>
              </label>
              <div class="wbh-editor-section wbh-activation-section">
                <h4 data-wbh-i18n="section.activation">${t('section.activation')}</h4>
                <div class="wbh-editor-grid">
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.keys">${t('field.keys')}</span>
                    <textarea id="wbh-entry-key" data-wbh-field="key" rows="3"></textarea>
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.secondary">${t('field.secondary')}</span>
                    <textarea id="wbh-entry-keysecondary" data-wbh-field="keysecondary" rows="3"></textarea>
                  </label>
                </div>
                <div class="wbh-editor-grid wbh-editor-grid-compact">
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="constant">
                    <span data-wbh-i18n="flag.constant">${t('flag.constant')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="disable">
                    <span data-wbh-i18n="flag.disabled">${t('flag.disabled')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="selective">
                    <span data-wbh-i18n="flag.selective">${t('flag.selective')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="vectorized">
                    <span data-wbh-i18n="flag.vectorized">${t('flag.vectorized')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="useProbability">
                    <span data-wbh-i18n="flag.useProbability">${t('flag.useProbability')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="ignoreBudget">
                    <span data-wbh-i18n="flag.ignoreBudget">${t('flag.ignoreBudget')}</span>
                  </label>
                </div>
              </div>
              <div class="wbh-editor-section wbh-insertion-section">
                <h4 data-wbh-i18n="section.insertion">${t('section.insertion')}</h4>
                <div class="wbh-editor-grid wbh-editor-grid-3">
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.position">${t('field.position')}</span>
                    <select data-wbh-field="position" data-wbh-type="number" data-wbh-options="position">
                      ${POSITION_OPTIONS.map(option => `<option value="${option.value}" data-wbh-key="${option.key}">${optionLabel(option)}</option>`).join('')}
                    </select>
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.role">${t('field.role')}</span>
                    <select data-wbh-field="role" data-wbh-type="number" data-wbh-options="role">
                      <option value=""></option>
                      ${ROLE_OPTIONS.map(option => `<option value="${option.value}" data-wbh-key="${option.key}">${optionLabel(option)}</option>`).join('')}
                    </select>
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.depth">${t('field.depth')}</span>
                    <input type="number" data-wbh-field="depth">
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.order">${t('field.order')}</span>
                    <input type="number" data-wbh-field="order">
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.probability">${t('field.probability')}</span>
                    <input type="number" data-wbh-field="probability" min="0" max="100">
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.scanDepth">${t('field.scanDepth')}</span>
                    <input type="number" data-wbh-field="scanDepth">
                  </label>
                </div>
              </div>
              <div class="wbh-editor-section wbh-logic-section">
                <h4 data-wbh-i18n="section.logic">${t('section.logic')}</h4>
                <div class="wbh-editor-grid wbh-editor-grid-3">
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.selectiveLogic">${t('field.selectiveLogic')}</span>
                    <select data-wbh-field="selectiveLogic" data-wbh-type="number" data-wbh-options="selectiveLogic">
                      ${SELECTIVE_LOGIC_OPTIONS.map(option => `<option value="${option.value}" data-wbh-key="${option.key}">${optionLabel(option)}</option>`).join('')}
                    </select>
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.caseSensitive">${t('field.caseSensitive')}</span>
                    <select data-wbh-field="caseSensitive" data-wbh-type="tri-state">
                      <option value="" data-wbh-key="value.global">${t('value.global')}</option>
                      <option value="true" data-wbh-key="value.on">${t('value.on')}</option>
                      <option value="false" data-wbh-key="value.off">${t('value.off')}</option>
                    </select>
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.wholeWords">${t('field.wholeWords')}</span>
                    <select data-wbh-field="matchWholeWords" data-wbh-type="tri-state">
                      <option value="" data-wbh-key="value.global">${t('value.global')}</option>
                      <option value="true" data-wbh-key="value.on">${t('value.on')}</option>
                      <option value="false" data-wbh-key="value.off">${t('value.off')}</option>
                    </select>
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.group">${t('field.group')}</span>
                    <input type="text" data-wbh-field="group">
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.groupWeight">${t('field.groupWeight')}</span>
                    <input type="number" data-wbh-field="groupWeight">
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.groupScoring">${t('field.groupScoring')}</span>
                    <select data-wbh-field="useGroupScoring" data-wbh-type="tri-state">
                      <option value="" data-wbh-key="value.global">${t('value.global')}</option>
                      <option value="true" data-wbh-key="value.on">${t('value.on')}</option>
                      <option value="false" data-wbh-key="value.off">${t('value.off')}</option>
                    </select>
                  </label>
                </div>
                <div class="wbh-editor-grid wbh-editor-grid-compact">
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="groupOverride">
                    <span data-wbh-i18n="flag.groupOverride">${t('flag.groupOverride')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="excludeRecursion">
                    <span data-wbh-i18n="flag.excludeRecursion">${t('flag.excludeRecursion')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="preventRecursion">
                    <span data-wbh-i18n="flag.preventRecursion">${t('flag.preventRecursion')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="delayUntilRecursion">
                    <span data-wbh-i18n="flag.delayUntilRecursion">${t('flag.delayUntilRecursion')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="addMemo">
                    <span data-wbh-i18n="flag.addMemo">${t('flag.addMemo')}</span>
                  </label>
                </div>
              </div>
              <div class="wbh-editor-section wbh-timing-section">
                <h4 data-wbh-i18n="section.timingFilters">${t('section.timingFilters')}</h4>
                <div class="wbh-editor-grid wbh-editor-grid-3">
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.sticky">${t('field.sticky')}</span>
                    <input type="number" data-wbh-field="sticky">
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.cooldown">${t('field.cooldown')}</span>
                    <input type="number" data-wbh-field="cooldown">
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.delay">${t('field.delay')}</span>
                    <input type="number" data-wbh-field="delay">
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.automationId">${t('field.automationId')}</span>
                    <input type="text" data-wbh-field="automationId">
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.outletName">${t('field.outletName')}</span>
                    <input type="text" data-wbh-field="outletName">
                  </label>
                </div>
                <div class="wbh-editor-grid">
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.characterNames">${t('field.characterNames')}</span>
                    <textarea data-wbh-field="characterFilterNames" rows="3"></textarea>
                  </label>
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.characterTags">${t('field.characterTags')}</span>
                    <textarea data-wbh-field="characterFilterTags" rows="3"></textarea>
                  </label>
                </div>
                <div class="wbh-editor-grid">
                  <label class="wbh-editor-field">
                    <span data-wbh-i18n="field.triggers">${t('field.triggers')}</span>
                    <textarea data-wbh-field="triggers" rows="3"></textarea>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="characterFilterExclude">
                    <span data-wbh-i18n="flag.excludeCharacterFilter">${t('flag.excludeCharacterFilter')}</span>
                  </label>
                </div>
              </div>
              <div class="wbh-editor-section wbh-match-section">
                <h4 data-wbh-i18n="section.matchSources">${t('section.matchSources')}</h4>
                <div class="wbh-editor-grid wbh-editor-grid-compact">
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchPersonaDescription">
                    <span data-wbh-i18n="field.matchPersona">${t('field.matchPersona')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchCharacterDescription">
                    <span data-wbh-i18n="field.matchDescription">${t('field.matchDescription')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchCharacterPersonality">
                    <span data-wbh-i18n="field.matchPersonality">${t('field.matchPersonality')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchCharacterDepthPrompt">
                    <span data-wbh-i18n="field.matchDepthPrompt">${t('field.matchDepthPrompt')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchScenario">
                    <span data-wbh-i18n="field.matchScenario">${t('field.matchScenario')}</span>
                  </label>
                  <label class="wbh-check">
                    <input type="checkbox" data-wbh-field="matchCreatorNotes">
                    <span data-wbh-i18n="field.matchCreatorNotes">${t('field.matchCreatorNotes')}</span>
                  </label>
                </div>
              </div>
            </section>
          </div>
          <div id="wbh-diff-view" class="wbh-diff-view hidden">
            <div class="wbh-form">
              <textarea id="wbh-experiment-note-input" rows="2" placeholder="${t('placeholder.note')}" data-wbh-i18n-placeholder="placeholder.note"></textarea>
              <button id="wbh-save-experiment-note" type="button" data-wbh-i18n="action.saveNote">${t('action.saveNote')}</button>
              <button id="wbh-snapshot" type="button" data-wbh-i18n="action.snapshot">${t('action.snapshot')}</button>
            </div>
            <div class="wbh-toolbar">
              <button id="wbh-mode-current" type="button" class="active" data-wbh-i18n="action.current">${t('action.current')}</button>
              <button id="wbh-mode-previous" type="button" data-wbh-i18n="action.previous">${t('action.previous')}</button>
              <button id="wbh-change-prev" type="button" disabled data-wbh-i18n="action.prevChange">${t('action.prevChange')}</button>
              <button id="wbh-change-next" type="button" disabled data-wbh-i18n="action.nextChange">${t('action.nextChange')}</button>
              <button id="wbh-restore" type="button" disabled data-wbh-i18n="action.restore">${t('action.restore')}</button>
            </div>
            <div id="wbh-diff-summary" class="wbh-diff-summary"></div>
            <div id="wbh-diff" class="wbh-diff">${t('empty.selectSnapshot')}</div>
          </div>
        </section>
        <section class="wbh-pane wbh-side-stack">
          <div class="wbh-side-section wbh-origin-section">
            <div class="wbh-pane-head">
              <h3 data-wbh-i18n="section.origin">${t('section.origin')}</h3>
              <span id="wbh-origin-count">0</span>
            </div>
            <div id="wbh-origin" class="wbh-list"></div>
          </div>
          <div class="wbh-side-section">
            <div class="wbh-pane-head">
              <h3 data-wbh-i18n="section.experiments">${t('section.experiments')}</h3>
              <span id="wbh-experiment-count">0</span>
            </div>
            <input id="wbh-experiment-search" type="search" placeholder="${t('placeholder.searchExperiments')}" data-wbh-i18n-placeholder="placeholder.searchExperiments">
            <div id="wbh-experiments" class="wbh-list"></div>
          </div>
          <div class="wbh-side-section">
            <div class="wbh-pane-head">
              <h3 data-wbh-i18n="section.versions">${t('section.versions')}</h3>
              <span id="wbh-snapshot-count">0</span>
            </div>
            <div id="wbh-snapshots" class="wbh-list"></div>
          </div>
        </section>
      </main>
    </div>
  `;
  document.body.append(root);

  root.querySelector('#wbh-close').addEventListener('click', () => root.classList.remove('open'));
  root.querySelector('#wbh-refresh').addEventListener('click', refreshLocalWorkbench);
  root.querySelector('#wbh-export-all').addEventListener('click', exportActiveBookArchive);
  root.querySelectorAll('[data-wbh-theme]').forEach(button => {
    button.addEventListener('click', () => setThemeMode(button.dataset.wbhTheme));
  });
  root.querySelectorAll('[data-wbh-language]').forEach(button => {
    button.addEventListener('click', () => setLanguageMode(button.dataset.wbhLanguage));
  });
  root.querySelector('#wbh-toggle-books').addEventListener('click', toggleBooksPane);
  root.querySelector('#wbh-toggle-history').addEventListener('click', toggleHistoryPane);
  root.querySelector('#wbh-toggle-find').addEventListener('click', toggleFindPane);
  root.querySelector('#wbh-book-search').addEventListener('input', renderBooks);
  root.querySelector('#wbh-experiment-search').addEventListener('input', renderExperiments);
  root.querySelector('#wbh-entry-search').addEventListener('input', handleFindInput);
  root.querySelector('#wbh-entry-search').addEventListener('keydown', handleFindKeydown);
  root.querySelector('#wbh-replace-text').addEventListener('input', handleReplaceInput);
  root.querySelector('#wbh-find-prev').addEventListener('click', () => navigateFind(-1));
  root.querySelector('#wbh-find-next').addEventListener('click', () => navigateFind(1));
  root.querySelector('#wbh-replace-one').addEventListener('click', replaceCurrentFindMatch);
  root.querySelector('#wbh-replace-all').addEventListener('click', replaceAllFindMatches);
  root.querySelector('#wbh-tab-edit').addEventListener('click', () => setMainTab('edit'));
  root.querySelector('#wbh-tab-diff').addEventListener('click', () => setMainTab('diff'));
  root.querySelector('#wbh-editor-undo').addEventListener('click', undoEditorChange);
  root.querySelector('#wbh-editor-redo').addEventListener('click', redoEditorChange);
  root.querySelector('#wbh-entry-new').addEventListener('click', createEntry);
  root.querySelector('#wbh-entry-duplicate').addEventListener('click', duplicateEntry);
  root.querySelector('#wbh-entry-delete').addEventListener('click', deleteEntry);
  root.querySelector('#wbh-editor-reload').addEventListener('click', reloadEditorWorldbook);
  root.querySelector('#wbh-editor-save').addEventListener('click', saveEditorWorldbook);
  root.querySelector('#wbh-save-experiment-note').addEventListener('click', saveActiveExperimentNote);
  root.querySelector('#wbh-experiment-note-input').addEventListener('keydown', event => {
    if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return;
    event.preventDefault();
    void saveActiveExperimentNote();
  });
  root.querySelector('#wbh-snapshot').addEventListener('click', createManualLocalSnapshot);
  root.querySelector('#wbh-start-experiment').addEventListener('click', startExperiment);
  root.querySelector('#wbh-finish-experiment').addEventListener('click', finishExperiment);
  root.querySelector('#wbh-keep-experiment').addEventListener('click', () => setExperimentStatus('kept'));
  root.querySelector('#wbh-reject-experiment').addEventListener('click', () => setExperimentStatus('rejected'));
  root.querySelector('#wbh-restore-origin').addEventListener('click', restoreOriginSnapshot);
  root.querySelector('#wbh-restore-baseline').addEventListener('click', () => restoreExperimentSnapshot('baseline'));
  root.querySelector('#wbh-restore-after').addEventListener('click', () => restoreExperimentSnapshot('after'));
  root.querySelector('#wbh-mode-current').addEventListener('click', () => setDiffMode('current'));
  root.querySelector('#wbh-mode-previous').addEventListener('click', () => setDiffMode('previous'));
  root.querySelector('#wbh-change-prev').addEventListener('click', () => navigateDiffChange(-1));
  root.querySelector('#wbh-change-next').addEventListener('click', () => navigateDiffChange(1));
  root.querySelector('#wbh-restore').addEventListener('click', restoreLocalSnapshot);
  root.querySelectorAll('[data-wbh-field]').forEach(input => {
    const eventName = input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener('blur', finishInputHistory);
    input.addEventListener(eventName, () => updateActiveEntryFromEditor(input));
  });
  renderBooksPane();
  renderLanguageMode();
  renderThemeMode();
  renderLayoutMode();
}

async function refreshLocalWorkbench() {
  if (!await confirmDiscardEditorChanges()) return;
  setStatus(t('status.refreshing'));
  app.books = await listWorldbooks();
  app.activeBook = app.activeBook
    ? app.books.find(book => book.name === app.activeBook.name) || app.books[0] || null
    : app.books[0] || null;
  await loadEditorWorldbook({ force: true });
  renderBooks();
  await loadLocalSnapshots();
  setStatus(t('status.ready'));
}

async function listWorldbooks() {
  const result = await stPost('/api/worldinfo/list', {});
  return (Array.isArray(result) ? result : [])
    .map(item => ({
      name: String(item.file_id || item.name || '').trim(),
      title: String(item.name || item.file_id || '').trim(),
    }))
    .filter(book => book.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadWorldbook(name) {
  return stPost('/api/worldinfo/get', { name });
}

async function saveWorldbook(name, data) {
  app.snapshotInFlight = true;
  try {
    await saveWorldInfo(name, cloneValue(data), true);
    await refreshNativeWorldInfoEditor(name);
  } finally {
    app.snapshotInFlight = false;
  }
}

async function refreshNativeWorldInfoEditor(name) {
  try {
    const select = document.querySelector('#world_editor_select');
    if (!select) return;

    const selected = select.selectedOptions?.[0];
    const selectedName = selected?.textContent?.trim();
    if (!selectedName || selectedName !== name) return;

    if (typeof window.$ === 'function') {
      window.$(select).trigger('change');
    } else {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } catch (error) {
    console.warn('[Worldbook Backup Helper] Native worldbook editor refresh failed.', error);
  }
}

async function loadEditorWorldbook({ force = false } = {}) {
  if (!app.activeBook) {
    app.activeData = null;
    app.activeDataHash = '';
    app.editorSourceLabel = '';
    app.activeEntryId = null;
    app.editorDirty = false;
    resetEditorHistory({ render: false });
    renderEditor();
    return;
  }

  if (!force && app.activeData) {
    renderEditor();
    return;
  }

  const data = await loadWorldbook(app.activeBook.name);
  app.activeData = cloneValue(data);
  app.activeDataHash = await hashObject(app.activeData);
  app.editorSourceLabel = 'Current';
  await ensureOriginSnapshot(app.activeBook.name, app.activeData);
  app.editorDirty = false;
  resetEditorHistory({ render: false });
  ensureActiveEntry();
  renderEditor();
}

async function loadLocalSnapshots() {
  const activeSnapshotId = app.activeSnapshot?.id;
  const activeExperimentId = app.activeExperiment?.id;
  app.snapshots = app.activeBook ? await getSnapshots(app.activeBook.name) : [];
  app.experiments = app.activeBook ? await getExperiments(app.activeBook.name) : [];
  app.originSnapshot = app.snapshots.find(snapshot => snapshot.reason === 'origin') || null;
  app.activeSnapshot = app.snapshots.find(snapshot => snapshot.id === activeSnapshotId) || app.snapshots[0] || null;
  app.activeExperiment = app.experiments.find(experiment => experiment.id === activeExperimentId) || (app.activeView === 'experiment' ? app.experiments[0] || null : null);
  if (!app.activeExperiment && app.activeView === 'experiment') app.activeView = 'snapshot';
  renderActiveBook();
  renderOriginSnapshot();
  renderExperiments();
  renderSnapshots();
  await renderDiff();
}

function renderBooks() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const filter = root.querySelector('#wbh-book-search').value.trim().toLowerCase();
  const list = root.querySelector('#wbh-books');
  root.querySelector('#wbh-book-count').textContent = String(app.books.length);

  list.replaceChildren(...app.books
    .filter(book => book.name.toLowerCase().includes(filter) || book.title.toLowerCase().includes(filter))
    .map(book => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `wbh-row ${app.activeBook?.name === book.name ? 'active' : ''}`;
      button.innerHTML = '<span></span><small></small>';
      button.querySelector('span').textContent = book.title || book.name;
      button.querySelector('small').textContent = book.name;
      button.addEventListener('click', async () => {
        if (!await confirmDiscardEditorChanges()) return;
        app.activeBook = book;
        app.activeData = null;
        app.activeDataHash = '';
        app.activeEntryId = null;
        app.editorDirty = false;
        resetEditorHistory({ render: false });
        app.activeSnapshot = null;
        app.activeExperiment = null;
        app.activeView = 'snapshot';
        await loadEditorWorldbook({ force: true });
        renderBooks();
        await loadLocalSnapshots();
      });
      return button;
    }));
}

function toggleBooksPane() {
  app.booksCollapsed = !app.booksCollapsed;
  writeBooleanSetting('wbh-books-collapsed', app.booksCollapsed);
  renderBooksPane();
}

function toggleHistoryPane() {
  app.historyCollapsed = !app.historyCollapsed;
  writeBooleanSetting('wbh-history-collapsed', app.historyCollapsed);
  renderLayoutMode();
}

function toggleFindPane() {
  app.findCollapsed = !app.findCollapsed;
  writeBooleanSetting('wbh-find-collapsed', app.findCollapsed);
  renderLayoutMode();
}

function setThemeMode(mode) {
  app.themeMode = THEME_MODES.includes(mode) ? mode : 'auto';
  writeStringSetting('wbh-theme-mode', app.themeMode);
  renderThemeMode();
}

function getResolvedThemeMode() {
  if (app.themeMode === 'light' || app.themeMode === 'dark') return app.themeMode;
  const tavernTheme = detectSillyTavernTheme();
  if (tavernTheme) return tavernTheme;
  return THEME_QUERY?.matches ? 'dark' : 'light';
}

function detectSillyTavernTheme() {
  const themeText = [
    document.documentElement?.dataset?.theme,
    document.body?.dataset?.theme,
    document.documentElement?.getAttribute('theme'),
    document.body?.getAttribute('theme'),
    document.documentElement?.className,
    document.body?.className,
  ].join(' ').toLowerCase();

  if (/\b(light|latte)\b/.test(themeText)) return 'light';
  if (/\b(dark|black|midnight|mocha|dracula)\b/.test(themeText)) return 'dark';

  const elements = [
    document.body,
    document.documentElement,
    document.querySelector('#sheld'),
    document.querySelector('#chat'),
    document.querySelector('#top-bar'),
  ].filter(Boolean);

  for (const element of elements) {
    const styles = getComputedStyle(element);
    const candidates = [
      ...THEME_BACKGROUND_VARS.map(name => styles.getPropertyValue(name)),
      styles.backgroundColor,
    ];
    for (const candidate of candidates) {
      const color = parseCssColor(candidate);
      if (!color || color.a < 0.2) continue;
      return relativeLuminance(color) < 0.45 ? 'dark' : 'light';
    }
  }
  return '';
}

function parseCssColor(value) {
  const text = String(value || '').trim();
  if (!text || text === 'transparent') return null;

  const hex = text.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 || hex.length === 4
      ? [...hex].map(char => `${char}${char}`).join('')
      : hex;
    const hasAlpha = full.length === 8;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: hasAlpha ? parseInt(full.slice(6, 8), 16) / 255 : 1,
    };
  }

  const rgb = text.match(/^rgba?\((.+)\)$/i)?.[1];
  if (!rgb) return null;
  const parts = rgb.replace(/\s*\/\s*/, ' ').split(/[,\s]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const color = {
    r: parseColorChannel(parts[0]),
    g: parseColorChannel(parts[1]),
    b: parseColorChannel(parts[2]),
    a: parts[3] === undefined ? 1 : parseAlphaChannel(parts[3]),
  };
  return [color.r, color.g, color.b, color.a].every(Number.isFinite) ? color : null;
}

function parseColorChannel(value) {
  const text = String(value || '').trim();
  if (text.endsWith('%')) return Math.round(Number.parseFloat(text) * 2.55);
  return Math.max(0, Math.min(255, Number.parseFloat(text)));
}

function parseAlphaChannel(value) {
  const text = String(value || '').trim();
  const alpha = text.endsWith('%') ? Number.parseFloat(text) / 100 : Number.parseFloat(text);
  return Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
}

function relativeLuminance({ r, g, b }) {
  const [red, green, blue] = [r, g, b].map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function setLanguageMode(mode) {
  app.languageMode = LANGUAGE_MODES.includes(mode) ? mode : 'auto';
  writeStringSetting('wbh-language-mode', app.languageMode);
  renderLanguageMode();
  renderThemeMode();
  renderEditor();
  renderOriginSnapshot();
  renderExperiments();
  renderSnapshots();
  void renderDiff();
}

function getResolvedLanguageMode() {
  if (app.languageMode === 'en' || app.languageMode === 'zh') return app.languageMode;
  const storedLanguageCandidates = ['language', 'ui_language', 'uiLanguage', 'locale', 'sillytavern_language']
    .map(key => {
      try {
        return localStorage.getItem(key);
      } catch {
        return '';
      }
    });
  const selectLanguageCandidates = [
    '#ui_language_select',
    '#language_select',
    '#ui_language',
    'select[name="language"]',
    'select[id*="language" i]',
    'select[id*="locale" i]',
  ].map(selector => document.querySelector(selector)?.value);
  const candidates = [
    document.documentElement?.lang,
    document.body?.lang,
    document.documentElement?.dataset?.language,
    document.body?.dataset?.language,
    document.documentElement?.dataset?.locale,
    document.body?.dataset?.locale,
    ...selectLanguageCandidates,
    ...storedLanguageCandidates,
    navigator.language,
    ...(navigator.languages || []),
  ].filter(Boolean).map(value => String(value).toLowerCase());
  return candidates.some(value => value.startsWith('zh') || value.includes('chinese')) ? 'zh' : 'en';
}

function t(key, values = {}) {
  const lang = getResolvedLanguageMode();
  const text = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  return String(text).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}

function optionLabel(option) {
  return t(option.key);
}

function entriesLabel(count) {
  const key = getResolvedLanguageMode() === 'en' && Number(count) === 1 ? 'count.entry' : 'count.entries';
  return t(key, { count });
}

function matchesLabel(count) {
  const key = getResolvedLanguageMode() === 'en' && Number(count) === 1 ? 'count.match' : 'count.matches';
  return t(key, { count });
}

function diffStatusLabel(status) {
  if (status === 'unchanged') return t('diff.entry');
  if (status === 'added') return t('diff.added');
  if (status === 'removed') return t('diff.removed');
  if (status === 'changed') return t('diff.changed');
  return status.toUpperCase();
}

function displaySnapshotLabel(label) {
  const text = String(label || '');
  const replacements = [
    [/^Before auto save$/i, 'label.beforeAutoSave'],
    [/^After auto save$/i, 'label.afterAutoSave'],
    [/^Manual snapshot$/i, 'label.manualSnapshot'],
    [/^Before save:\s*(.+)$/i, 'label.beforeSave'],
    [/^After save:\s*(.+)$/i, 'label.afterSave'],
    [/^Manual snapshot:\s*(.+)$/i, 'label.manualSnapshotExperiment'],
    [/^Baseline:\s*(.+)$/i, 'label.baseline'],
    [/^After:\s*(.+)$/i, 'label.after'],
    [/^Origin:\s*(.+)$/i, 'label.originSnapshot'],
  ];
  for (const [pattern, key] of replacements) {
    const match = text.match(pattern);
    if (match) return t(key, { title: match[1] || '', name: match[1] || '' });
  }
  return text;
}

function renderStaticTranslations(root = document.querySelector('#wbh-workbench')) {
  if (!root) return;
  root.querySelectorAll('[data-wbh-i18n]').forEach(element => {
    element.textContent = t(element.dataset.wbhI18n);
  });
  root.querySelectorAll('[data-wbh-i18n-placeholder]').forEach(element => {
    element.placeholder = t(element.dataset.wbhI18nPlaceholder);
  });
  root.querySelectorAll('[data-wbh-i18n-title]').forEach(element => {
    const title = t(element.dataset.wbhI18nTitle);
    element.title = title;
    if (element.hasAttribute('aria-label')) element.setAttribute('aria-label', title);
  });
  updateSelectOptionLabels(root);
}

function updateSelectOptionLabels(root = document.querySelector('#wbh-workbench')) {
  if (!root) return;
  root.querySelectorAll('select[data-wbh-options="position"] option[data-wbh-key]').forEach(option => {
    option.textContent = t(option.dataset.wbhKey);
  });
  root.querySelectorAll('select[data-wbh-options="role"] option[data-wbh-key]').forEach(option => {
    option.textContent = t(option.dataset.wbhKey);
  });
  root.querySelectorAll('select[data-wbh-options="selectiveLogic"] option[data-wbh-key]').forEach(option => {
    option.textContent = t(option.dataset.wbhKey);
  });
  root.querySelectorAll('option[data-wbh-key="value.global"]').forEach(option => {
    option.textContent = t('value.global');
  });
  root.querySelectorAll('option[data-wbh-key="value.on"]').forEach(option => {
    option.textContent = t('value.on');
  });
  root.querySelectorAll('option[data-wbh-key="value.off"]').forEach(option => {
    option.textContent = t('value.off');
  });
}

function renderLanguageMode() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const resolved = getResolvedLanguageMode();
  root.dataset.language = resolved;
  root.dataset.languageMode = app.languageMode;
  root.querySelector('.wbh-panel')?.setAttribute('aria-label', t('app.title'));
  root.querySelector('.wbh-language-toggle')?.setAttribute('aria-label', t('language.label'));
  root.querySelector('.wbh-theme-toggle')?.setAttribute('aria-label', t('theme.label'));
  root.querySelectorAll('[data-wbh-language]').forEach(button => {
    const active = button.dataset.wbhLanguage === app.languageMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    if (button.dataset.wbhLanguage === 'auto') {
      button.title = t('language.autoTitle', { resolved });
    } else {
      button.title = t('language.useTitle', { mode: t(`language.${button.dataset.wbhLanguage}`) });
    }
  });
  renderStaticTranslations(root);
  document.querySelector('#wbh-open-workbench')?.replaceChildren(document.createTextNode(t('menu.open')));
}

function renderThemeMode() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const resolved = getResolvedThemeMode();
  root.dataset.theme = resolved;
  root.dataset.themeMode = app.themeMode;
  root.querySelectorAll('[data-wbh-theme]').forEach(button => {
    const active = button.dataset.wbhTheme === app.themeMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    if (button.dataset.wbhTheme === 'auto') {
      button.title = t('theme.autoTitle', { resolved });
    } else {
      button.title = t('theme.useTitle', { mode: t(`theme.${button.dataset.wbhTheme}`) });
    }
  });
}

function renderBooksPane() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const grid = root.querySelector('.wbh-grid');
  const pane = root.querySelector('#wbh-book-pane');
  const toggle = root.querySelector('#wbh-toggle-books');
  grid.classList.toggle('books-collapsed', app.booksCollapsed);
  pane.classList.toggle('collapsed', app.booksCollapsed);
  toggle.textContent = app.booksCollapsed ? '>' : '<';
  toggle.title = app.booksCollapsed ? t('tooltip.showWorldbooks') : t('tooltip.hideWorldbooks');
  toggle.setAttribute('aria-label', toggle.title);
  renderLayoutMode();
}

function renderLayoutMode() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const grid = root.querySelector('.wbh-grid');
  const entryPane = root.querySelector('.wbh-entry-pane');
  const historyPane = root.querySelector('.wbh-side-stack');
  const history = root.querySelector('#wbh-toggle-history');
  const find = root.querySelector('#wbh-toggle-find');

  grid?.classList.toggle('history-collapsed', app.historyCollapsed);
  entryPane?.classList.toggle('find-collapsed', app.findCollapsed);
  historyPane?.setAttribute('data-wbh-history-label', t('action.history'));

  if (history) {
    history.classList.toggle('active', !app.historyCollapsed);
    history.textContent = app.historyCollapsed ? t('action.showHistory') : t('action.hideHistory');
    history.setAttribute('aria-pressed', String(!app.historyCollapsed));
  }
  if (find) {
    find.classList.toggle('active', !app.findCollapsed);
    find.textContent = app.findCollapsed ? t('action.find') : t('action.hideFind');
    find.setAttribute('aria-pressed', String(!app.findCollapsed));
  }
}

function renderActiveBook() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  root.querySelector('#wbh-active-title').textContent = app.activeBook?.title || app.activeBook?.name || t('empty.noWorldbookSelected');
  const entryCount = app.activeData ? countEntries(app.activeData) : 0;
  const parts = [entriesLabel(entryCount)];
  if (app.editorDirty) parts.push(t('count.unsaved'));
  if (app.editorSourceLabel && app.editorSourceLabel !== 'Current') {
    parts.push(t('count.loaded', { source: displaySnapshotLabel(app.editorSourceLabel) }));
  }
  root.querySelector('#wbh-active-meta').textContent = app.activeBook ? parts.join(' | ') : entriesLabel(0);
  root.querySelector('#wbh-export-all').disabled = !app.activeBook;
  root.querySelector('#wbh-restore').disabled = !app.activeBook || app.activeView !== 'snapshot' || !app.activeSnapshot;
  renderExperimentPanel();
  renderEditorState();
}

async function ensureOriginSnapshot(name, data) {
  const snapshots = await getSnapshots(name);
  if (snapshots.some(snapshot => snapshot.reason === 'origin')) return;

  const sourceHash = await hashObject(data);
  const now = new Date();
  await putSnapshot({
    id: `${name}:origin:${formatDateForFile(now)}:${sourceHash.slice(0, 10)}`,
    bookName: name,
    label: `Origin: ${name}`,
    reason: 'origin',
    createdAt: now.toISOString(),
    createdAtMs: now.getTime(),
    sourceHash,
    entryCount: countEntries(data),
    data: cloneValue(data),
  });
}

function renderExperimentPanel() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const experiment = app.activeView === 'experiment' ? app.activeExperiment : null;
  const title = root.querySelector('#wbh-experiment-title');
  const meta = root.querySelector('#wbh-experiment-meta');
  const noteInput = root.querySelector('#wbh-experiment-note-input');
  const saveNote = root.querySelector('#wbh-save-experiment-note');
  const start = root.querySelector('#wbh-start-experiment');
  const finish = root.querySelector('#wbh-finish-experiment');
  const keep = root.querySelector('#wbh-keep-experiment');
  const reject = root.querySelector('#wbh-reject-experiment');
  const origin = root.querySelector('#wbh-restore-origin');
  const baseline = root.querySelector('#wbh-restore-baseline');
  const after = root.querySelector('#wbh-restore-after');
  const openExperiment = getOpenExperiment();
  const experimentOpen = isExperimentOpen(experiment);

  title.textContent = experiment?.title || t('empty.noExperimentSelected');
  meta.textContent = experiment
    ? [
      statusLabel(experiment.status),
      formatDate(experiment.startedAt),
      experiment.changeNote || '',
    ].filter(Boolean).join(' | ')
    : t('status.ready');
  if (noteInput) {
    noteInput.disabled = !experiment;
    noteInput.placeholder = experiment
      ? t('placeholder.note')
      : t('placeholder.noteDisabled');
    if (document.activeElement !== noteInput) noteInput.value = experiment?.resultNote || '';
  }
  if (saveNote) saveNote.disabled = !experiment;

  start.disabled = !app.activeBook || Boolean(openExperiment);
  start.title = openExperiment
    ? t('status.finishOpenExperiment', { title: openExperiment.title || t('label.currentExperiment') })
    : '';
  finish.disabled = !app.activeBook || !experiment;
  finish.textContent = experimentOpen ? t('action.finish') : experiment?.afterSnapshotId ? t('action.updateAfter') : t('action.finish');
  keep.disabled = !experiment;
  reject.disabled = !experiment;
  origin.disabled = !app.activeBook || !app.originSnapshot;
  baseline.disabled = !experiment?.baselineSnapshotId;
  after.disabled = !experiment?.afterSnapshotId;
}

function getOpenExperiment() {
  return app.activeBook
    ? app.experiments.find(experiment => experiment.bookName === app.activeBook.name && isExperimentOpen(experiment)) || null
    : null;
}

function isExperimentOpen(experiment) {
  return Boolean(experiment && !experiment.finishedAt && !experiment.finishedAtMs);
}

function renderOriginSnapshot() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const list = root.querySelector('#wbh-origin');
  root.querySelector('#wbh-origin-count').textContent = app.originSnapshot ? '1' : '0';

  if (!app.originSnapshot) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = t('empty.noOriginYet');
    list.replaceChildren(empty);
    return;
  }

  const row = document.createElement('div');
  row.className = `wbh-history-row ${app.activeView === 'snapshot' && app.activeSnapshot?.id === app.originSnapshot.id ? 'active' : ''}`;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'wbh-row';
  button.innerHTML = '<span></span><small></small>';
  button.querySelector('span').textContent = displaySnapshotLabel(app.originSnapshot.label || t('label.origin'));
  button.querySelector('small').textContent = `${formatDate(app.originSnapshot.createdAt)} | ${entriesLabel(app.originSnapshot.entryCount || 0)}`;
  button.addEventListener('click', async () => {
    await loadSnapshotIntoEditor(app.originSnapshot, t('label.origin'));
  });

  const restore = document.createElement('button');
  restore.type = 'button';
  restore.className = 'wbh-mini';
  restore.textContent = t('action.restore');
  restore.addEventListener('click', async () => restoreSnapshot(app.originSnapshot, t('label.origin')));

  row.append(button, restore);
  list.replaceChildren(row);
}

function createHistoryActionMenu(actions) {
  const details = document.createElement('details');
  details.className = 'wbh-history-actions';

  const summary = document.createElement('summary');
  summary.className = 'wbh-mini';
  summary.textContent = '...';
  summary.title = t('action.more');
  summary.setAttribute('aria-label', t('action.more'));
  details.append(summary);

  const menu = document.createElement('div');
  menu.className = 'wbh-history-menu';
  actions.forEach(action => {
    action.classList.add('wbh-history-menu-item');
    action.addEventListener('click', () => {
      details.open = false;
    });
    menu.append(action);
  });
  details.append(menu);

  return details;
}

function renderExperiments() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const list = root.querySelector('#wbh-experiments');
  const search = root.querySelector('#wbh-experiment-search').value.trim().toLowerCase();
  const visibleExperiments = search
    ? app.experiments.filter(experiment => experimentSearchText(experiment).toLowerCase().includes(search))
    : app.experiments;
  root.querySelector('#wbh-experiment-count').textContent = search
    ? `${visibleExperiments.length}/${app.experiments.length}`
    : String(app.experiments.length);

  if (!app.experiments.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = t('empty.noExperimentsYet');
    list.replaceChildren(empty);
    return;
  }

  if (!visibleExperiments.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = t('empty.noMatchingExperiments');
    list.replaceChildren(empty);
    return;
  }

  list.replaceChildren(...visibleExperiments.map(experiment => {
    const row = document.createElement('div');
    row.className = `wbh-history-row ${app.activeView === 'experiment' && app.activeExperiment?.id === experiment.id ? 'active' : ''}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wbh-row';
    button.innerHTML = '<span></span><small></small>';
    button.querySelector('span').textContent = experiment.title || t('label.untitledExperiment');
    button.querySelector('small').textContent = experimentMeta(experiment);
    button.addEventListener('click', async () => {
      app.activeView = 'experiment';
      app.mainTab = 'diff';
      app.activeExperiment = experiment;
      app.activeSnapshot = await getSnapshotById(experiment.afterSnapshotId || experiment.baselineSnapshotId) || app.activeSnapshot;
      renderActiveBook();
      renderOriginSnapshot();
      renderExperiments();
      renderSnapshots();
      await renderDiff({ focusChange: true });
      setStatus(t('status.viewingExperiment', { title: experiment.title || t('label.untitledExperiment') }));
    });

    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'wbh-mini';
    rename.textContent = t('action.name');
    rename.addEventListener('click', async () => renameExperiment(experiment));

    const note = document.createElement('button');
    note.type = 'button';
    note.className = 'wbh-mini';
    note.textContent = t('action.note');
    note.addEventListener('click', async () => editExperimentNote(experiment));

    const exportJson = document.createElement('button');
    exportJson.type = 'button';
    exportJson.className = 'wbh-mini';
    exportJson.textContent = t('action.json');
    exportJson.title = t('tooltip.exportExperimentJson');
    exportJson.addEventListener('click', async () => exportExperimentJson(experiment));

    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'wbh-mini';
    restore.textContent = t('action.restore');
    restore.title = experiment.afterSnapshotId ? t('tooltip.restoreExperimentReady') : t('tooltip.restoreExperimentDisabled');
    restore.disabled = !experiment.afterSnapshotId;
    restore.addEventListener('click', async () => restoreExperimentResult(experiment));

    row.append(button, createHistoryActionMenu([restore, exportJson, note, rename]));
    return row;
  }));
}

function experimentMeta(experiment) {
  const parts = [statusLabel(experiment.status), formatDate(experiment.startedAt)];
  if (experiment.changeNote) parts.push(`${t('label.change')}: ${experiment.changeNote}`);
  if (experiment.resultNote) parts.push(`${t('action.note')}: ${experiment.resultNote}`);
  return parts.join(' | ');
}

function experimentSearchText(experiment) {
  return [
    experiment.title,
    statusLabel(experiment.status),
    experiment.status,
    experiment.changeNote,
    experiment.resultNote,
    experiment.startedAt,
    experiment.finishedAt,
  ].map(comparableField).join('\n');
}

async function renameExperiment(experiment) {
  if (!experiment) return;
  const title = window.prompt(t('prompt.experimentName'), experiment.title || '');
  if (title === null) return;

  const updated = {
    ...experiment,
    title: title.trim() || t('label.untitledExperiment'),
  };
  await putExperiment(updated);
  if (app.activeExperiment?.id === updated.id) app.activeExperiment = updated;
  await loadLocalSnapshots();
  setStatus(t('status.experimentRenamed'));
}

async function editExperimentNote(experiment) {
  if (!experiment) return;
  const note = window.prompt(t('prompt.experimentNote'), experiment.resultNote || experiment.changeNote || '');
  if (note === null) return;

  const updated = {
    ...experiment,
    resultNote: note.trim(),
  };
  await putExperiment(updated);
  if (app.activeExperiment?.id === updated.id) app.activeExperiment = updated;
  await loadLocalSnapshots();
  setStatus(t('status.experimentNoteSaved'));
}

async function saveActiveExperimentNote() {
  const root = document.querySelector('#wbh-workbench');
  const experiment = app.activeView === 'experiment' ? app.activeExperiment : null;
  if (!root || !experiment) return;

  const note = root.querySelector('#wbh-experiment-note-input')?.value.trim() || '';
  const updated = {
    ...experiment,
    resultNote: note,
  };
  await putExperiment(updated);
  if (app.activeExperiment?.id === updated.id) app.activeExperiment = updated;
  await loadLocalSnapshots();
  setStatus(t('status.experimentNoteSaved'));
}

async function exportExperimentJson(experiment) {
  if (!experiment) return;

  const baseline = await getSnapshotById(experiment.baselineSnapshotId);
  const after = await getSnapshotById(experiment.afterSnapshotId);
  const payload = {
    type: 'worldbook-backup-helper-experiment',
    version: 1,
    exportedAt: new Date().toISOString(),
    bookName: experiment.bookName,
    experiment: cloneValue(experiment),
    versions: {
      baseline: baseline ? cloneValue(baseline) : null,
      after: after ? cloneValue(after) : null,
    },
  };
  const filename = `${safeFileName(experiment.title || 'experiment')}-${formatDateForFile(new Date())}.json`;
  downloadJson(filename, payload);
  setStatus(t('status.experimentJsonExported'));
}

async function exportActiveBookArchive() {
  if (!app.activeBook) return;
  setStatus(t('status.exportingArchive'));

  const current = app.activeData ? cloneValue(app.activeData) : await loadWorldbook(app.activeBook.name);
  const payload = {
    type: 'worldbook-backup-helper-archive',
    version: 1,
    exportedAt: new Date().toISOString(),
    book: cloneValue(app.activeBook),
    current: {
      entryCount: countEntries(current),
      data: current,
    },
    origin: app.originSnapshot ? cloneValue(app.originSnapshot) : null,
    snapshots: app.snapshots.map(cloneValue),
    experiments: app.experiments.map(cloneValue),
  };
  const filename = `${safeFileName(app.activeBook.title || app.activeBook.name)}-wbh-archive-${formatDateForFile(new Date())}.json`;
  downloadJson(filename, payload);
  setStatus(t('status.archiveExported'));
}

async function loadSnapshotIntoEditor(snapshot, sourceName = t('label.version')) {
  if (!app.activeBook || !snapshot) return;
  if (!await confirmDiscardEditorChanges()) return;

  app.activeData = cloneValue(snapshot.data);
  app.activeDataHash = await hashObject(app.activeData);
  app.editorSourceLabel = snapshot.label || sourceName;
  app.editorDirty = false;
  resetEditorHistory({ render: false });
  app.activeEntryId = null;
  ensureActiveEntry();
  app.activeView = 'snapshot';
  const showChanges = sourceName === 'Version' || sourceName === t('label.version');
  app.mainTab = showChanges ? 'diff' : 'edit';
  if (showChanges) {
    app.diffMode = 'previous';
    app.diffChangeIndex = -1;
  }
  app.activeExperiment = null;
  app.activeSnapshot = snapshot;
  renderEditor();
  renderOriginSnapshot();
  renderExperiments();
  renderSnapshots();
  if (showChanges) await renderDiff({ focusChange: true });
  setStatus(t('status.loadedForEditing', {
    source: String(sourceName).toLowerCase(),
    label: displaySnapshotLabel(snapshot.label || formatDate(snapshot.createdAt)),
  }));
}

function setMainTab(tab) {
  app.mainTab = tab;
  renderEditorState();
  if (tab === 'diff') void renderDiff();
}

function renderEditor() {
  renderActiveBook();
  renderEditorState();
  renderEntryList();
  renderEntryEditor();
}

function renderEditorState() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  root.querySelector('#wbh-tab-edit').classList.toggle('active', app.mainTab === 'edit');
  root.querySelector('#wbh-tab-diff').classList.toggle('active', app.mainTab === 'diff');
  root.querySelector('#wbh-mode-current').classList.toggle('active', app.diffMode === 'current');
  root.querySelector('#wbh-mode-previous').classList.toggle('active', app.diffMode === 'previous');
  root.querySelector('#wbh-editor-view').classList.toggle('hidden', app.mainTab !== 'edit');
  root.querySelector('#wbh-diff-view').classList.toggle('hidden', app.mainTab !== 'diff');
  root.querySelector('#wbh-editor-undo').disabled = !app.activeData || !app.undoStack.length;
  root.querySelector('#wbh-editor-redo').disabled = !app.activeData || !app.redoStack.length;
  root.querySelector('#wbh-editor-save').disabled = !app.activeBook || !app.activeData || !app.editorDirty;
  root.querySelector('#wbh-editor-reload').disabled = !app.activeBook;
  root.querySelector('#wbh-entry-new').disabled = !app.activeBook || !app.activeData;
  root.querySelector('#wbh-entry-duplicate').disabled = !getActiveEntryRecord();
  root.querySelector('#wbh-entry-delete').disabled = !getActiveEntryRecord();
  renderLayoutMode();
  renderFindControls();
  updateDiffChangeControls();
}

function handleFindInput() {
  refreshFindMatches({ resetIndex: true });
  renderEntryList();
  renderFindControls();
}

function handleFindKeydown(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  navigateFind(event.shiftKey ? -1 : 1);
}

function handleReplaceInput() {
  const root = document.querySelector('#wbh-workbench');
  app.replaceText = root?.querySelector('#wbh-replace-text')?.value || '';
}

function renderEntryList() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const list = root.querySelector('#wbh-entries');
  refreshFindMatches();
  const search = app.findQuery.trim();
  const matchesByEntry = getFindCountsByEntry();
  const entries = getSortedEntryRecords(app.activeData)
    .filter(record => {
      if (!search) return true;
      return matchesByEntry.has(record.id);
    });

  if (!app.activeData) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = t('empty.noWorldbookLoaded');
    list.replaceChildren(empty);
    renderFindControls();
    return;
  }

  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = t('empty.noEntries');
    list.replaceChildren(empty);
    renderFindControls();
    return;
  }

  const activeMatch = getActiveFindMatch();
  list.replaceChildren(...entries.map(record => {
    const matchCount = matchesByEntry.get(record.id) || 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `wbh-row ${app.activeEntryId === record.id ? 'active' : ''} ${activeMatch?.entryId === record.id ? 'find-active' : ''}`;
    button.innerHTML = '<span></span><small></small>';
    button.querySelector('span').textContent = entryTitle(record.entry);
    button.querySelector('small').textContent = matchCount
      ? `${matchesLabel(matchCount)} | ${entryMeta(record.entry)}`
      : entryMeta(record.entry);
    button.addEventListener('click', () => {
      app.activeEntryId = record.id;
      const firstMatch = app.findMatches.findIndex(match => match.entryId === record.id);
      if (firstMatch >= 0) app.activeFindIndex = firstMatch;
      renderEntryList();
      renderEntryEditor();
      if (firstMatch >= 0) queueFocusActiveFindMatch();
    });
    return button;
  }));
  renderFindControls();
}

function renderEntryEditor() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const record = getActiveEntryRecord();
  const inputs = getEditorInputs(root);
  const disabled = !record;

  root.querySelector('#wbh-entry-title').textContent = record ? entryTitle(record.entry) : t('empty.noEntrySelected');
  root.querySelector('#wbh-entry-meta').textContent = record ? entryMeta(record.entry) : '';
  Object.values(inputs).forEach(input => {
    input.disabled = disabled;
  });

  if (!record) {
    setEditorInputValues(inputs, {});
    renderFindControls();
    return;
  }

  setEditorInputValues(inputs, record.entry);
  renderFindControls();
}

function refreshFindMatches({ resetIndex = false } = {}) {
  const root = document.querySelector('#wbh-workbench');
  const previousMatch = getActiveFindMatch();
  const query = root?.querySelector('#wbh-entry-search')?.value ?? app.findQuery ?? '';
  const queryChanged = query !== app.findQuery;
  app.findQuery = query;
  app.findMatches = app.activeData && app.findQuery.trim()
    ? collectFindMatches(app.findQuery.trim())
    : [];

  if (!app.findMatches.length) {
    app.activeFindIndex = -1;
    return;
  }

  if (resetIndex || queryChanged) {
    const activeEntryIndex = app.activeEntryId
      ? app.findMatches.findIndex(match => match.entryId === app.activeEntryId)
      : -1;
    app.activeFindIndex = activeEntryIndex >= 0 ? activeEntryIndex : 0;
    return;
  }

  if (previousMatch) {
    const sameIndex = app.findMatches.findIndex(match => sameFindMatch(match, previousMatch));
    if (sameIndex >= 0) {
      app.activeFindIndex = sameIndex;
      return;
    }
  }

  if (app.activeFindIndex < 0) {
    app.activeFindIndex = 0;
  } else if (app.activeFindIndex >= app.findMatches.length) {
    app.activeFindIndex = app.findMatches.length - 1;
  }
}

function collectFindMatches(query) {
  const needle = query.toLowerCase();
  if (!needle) return [];

  const matches = [];
  for (const record of getSortedEntryRecords(app.activeData)) {
    for (const field of FIND_FIELDS) {
      const value = findFieldText(record.entry, field);
      const haystack = value.toLowerCase();
      let start = haystack.indexOf(needle);
      while (start >= 0) {
        matches.push({
          entryId: record.id,
          field,
          start,
          end: start + query.length,
        });
        start = haystack.indexOf(needle, start + Math.max(needle.length, 1));
      }
    }
  }
  return matches;
}

function getFindCountsByEntry() {
  const counts = new Map();
  for (const match of app.findMatches) {
    counts.set(match.entryId, (counts.get(match.entryId) || 0) + 1);
  }
  return counts;
}

function renderFindControls() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  const total = app.findMatches.length;
  const count = root.querySelector('#wbh-find-count');
  const hasQuery = Boolean(app.findQuery.trim());
  count.textContent = hasQuery ? `${total ? app.activeFindIndex + 1 : 0}/${total}` : '0/0';
  root.querySelector('#wbh-find-prev').disabled = !total;
  root.querySelector('#wbh-find-next').disabled = !total;
  root.querySelector('#wbh-replace-one').disabled = !total;
  root.querySelector('#wbh-replace-all').disabled = !total;
}

function navigateFind(direction) {
  refreshFindMatches();
  if (!app.findMatches.length) {
    renderEntryList();
    renderFindControls();
    setStatus(app.findQuery.trim() ? t('status.noMatches') : t('status.ready'));
    return;
  }

  const total = app.findMatches.length;
  if (app.activeFindIndex < 0) {
    app.activeFindIndex = direction < 0 ? total - 1 : 0;
  } else {
    app.activeFindIndex = (app.activeFindIndex + direction + total) % total;
  }

  openActiveFindMatch();
}

function openActiveFindMatch() {
  const match = getActiveFindMatch();
  if (!match) return;

  app.activeEntryId = match.entryId;
  app.mainTab = 'edit';
  renderEditor();
  queueFocusActiveFindMatch();
  setStatus(t('status.matches', { current: app.activeFindIndex + 1, total: app.findMatches.length }));
}

function queueFocusActiveFindMatch() {
  const match = getActiveFindMatch();
  if (!match) return;
  window.requestAnimationFrame(() => focusFindMatch(match));
}

function focusFindMatch(match) {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const input = root.querySelector(`[data-wbh-field="${match.field}"]`);
  if (!input || typeof input.setSelectionRange !== 'function') return;

  input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  input.focus();
  input.setSelectionRange(match.start, match.end);
  scrollTextControlToPosition(input, match.start);
}

function scrollTextControlToPosition(input, start) {
  if (input.tagName !== 'TEXTAREA') return;
  const before = input.value.slice(0, start);
  const line = before.split(/\r?\n/).length - 1;
  const lineHeight = Number.parseFloat(window.getComputedStyle(input).lineHeight) || 20;
  input.scrollTop = Math.max(0, (line * lineHeight) - (input.clientHeight / 2));
}

function replaceCurrentFindMatch() {
  const root = document.querySelector('#wbh-workbench');
  app.replaceText = root?.querySelector('#wbh-replace-text')?.value || '';
  refreshFindMatches();

  const match = getActiveFindMatch();
  const record = match ? getEntryRecordById(match.entryId) : null;
  if (!match || !record) {
    setStatus(t('status.noMatchToReplace'));
    return;
  }

  captureUndoState(t('action.replace'));
  replaceMatchInRecord(record, match, app.replaceText);
  app.activeEntryId = match.entryId;
  setEditorDirty(true);
  const nextIndex = app.activeFindIndex;
  app.findMatches = collectFindMatches(app.findQuery.trim());
  app.activeFindIndex = app.findMatches.length ? Math.min(nextIndex, app.findMatches.length - 1) : -1;
  renderEditor();
  queueFocusActiveFindMatch();
  setStatus(t('status.replacedMatch'));
}

function replaceAllFindMatches() {
  const root = document.querySelector('#wbh-workbench');
  app.replaceText = root?.querySelector('#wbh-replace-text')?.value || '';
  refreshFindMatches();

  const total = app.findMatches.length;
  if (!total) {
    setStatus(t('status.noMatchesToReplace'));
    return;
  }

  const ok = window.confirm(t('confirm.replaceMatches', { count: total, noun: total === 1 ? 'match' : 'matches' }));
  if (!ok) return;

  captureUndoState(t('action.all'));
  const grouped = new Map();
  for (const match of app.findMatches) {
    const key = `${match.entryId}\u0000${match.field}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(match);
  }

  for (const matches of grouped.values()) {
    const first = matches[0];
    const record = getEntryRecordById(first.entryId);
    if (!record) continue;
    const sorted = [...matches].sort((left, right) => right.start - left.start);
    for (const match of sorted) {
      replaceMatchInRecord(record, match, app.replaceText);
    }
  }

  setEditorDirty(true);
  app.findMatches = collectFindMatches(app.findQuery.trim());
  app.activeFindIndex = app.findMatches.length ? 0 : -1;
  renderEditor();
  queueFocusActiveFindMatch();
  setStatus(t('status.replacedMatches', { count: total, noun: total === 1 ? 'match' : 'matches' }));
}

function replaceMatchInRecord(record, match, replacement) {
  const value = findFieldText(record.entry, match.field);
  const nextValue = `${value.slice(0, match.start)}${replacement}${value.slice(match.end)}`;
  writeFindFieldText(record.entry, match.field, nextValue);
}

function getActiveFindMatch() {
  return app.activeFindIndex >= 0 ? app.findMatches[app.activeFindIndex] || null : null;
}

function sameFindMatch(left, right) {
  return left.entryId === right.entryId
    && left.field === right.field
    && left.start === right.start
    && left.end === right.end;
}

function findFieldText(entry, field) {
  return LIST_FIELDS.has(field) ? listField(entry?.[field]) : stringField(entry?.[field]);
}

function writeFindFieldText(entry, field, value) {
  entry[field] = LIST_FIELDS.has(field) ? parseListField(value) : value;
}

function fieldLabel(field) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^\w/, letter => letter.toUpperCase());
}

function setEditorInputValues(inputs, entry) {
  for (const input of inputs) {
    const field = input.dataset.wbhField;
    const value = entry[field];
    if (input.type === 'checkbox') {
      input.checked = Boolean(value);
    } else if (LIST_FIELDS.has(field)) {
      input.value = listField(value);
    } else if (TRI_STATE_BOOLEAN_FIELDS.has(field)) {
      input.value = value === null || value === undefined ? '' : String(Boolean(value));
    } else if (NUMBER_FIELDS.has(field)) {
      input.value = numberField(value);
    } else {
      input.value = stringField(value);
    }
  }
  updateRoleControl(entry);
}

function updateRoleControl(entry) {
  const root = document.querySelector('#wbh-workbench');
  const role = root?.querySelector('[data-wbh-field="role"]');
  if (!role) return;

  const atDepth = Number(entry?.position) === 4;
  role.disabled = !atDepth;
  role.title = atDepth ? '' : t('tooltip.roleDepthOnly');
  if (!atDepth) {
    role.value = '';
  } else if (role.value === '') {
    role.value = String(entry?.role ?? 0);
  }
}

function normalizeEntryRole(entry) {
  if (!entry) return;
  if (Number(entry.position) === 4) {
    if (entry.role === undefined || entry.role === null || entry.role === '') entry.role = 0;
    return;
  }
  delete entry.role;
}

function normalizeWorldbookRoles(data) {
  getEntryRecords(data).forEach(record => normalizeEntryRole(record.entry));
}

function getEditorInputs(root) {
  return [...root.querySelectorAll('.wbh-entry-editor [data-wbh-field]')];
}

function beginInputHistory(input) {
  const record = getActiveEntryRecord();
  if (!record || !app.activeData) return;
  const field = input.dataset.wbhField;
  if (!field) return;
  const key = `${record.id}:${field}`;
  if (app.pendingInputHistoryKey === key) return;
  captureUndoState(`${t('action.edit')} ${diffFieldLabel(field)}`);
  app.pendingInputHistoryKey = key;
}

function finishInputHistory() {
  app.pendingInputHistoryKey = '';
}

function updateActiveEntryFromEditor(input) {
  const record = getActiveEntryRecord();
  if (!record) return;

  const field = input.dataset.wbhField;
  if (!field) return;

  const nextValue = readEditorInputValue(input);
  if (comparableField(record.entry[field]) === comparableField(nextValue)) return;

  beginInputHistory(input);
  record.entry[field] = nextValue;
  normalizeEntryRole(record.entry);

  setEditorDirty(true);
  if (field === 'comment') {
    document.querySelector('#wbh-entry-title').textContent = entryTitle(record.entry);
  }
  document.querySelector('#wbh-entry-meta').textContent = entryMeta(record.entry);
  if (field === 'position') updateRoleControl(record.entry);
}

function readEditorInputValue(input) {
  const field = input.dataset.wbhField;
  if (input.type === 'checkbox') return input.checked;
  if (LIST_FIELDS.has(field)) return parseListField(input.value);
  if (TRI_STATE_BOOLEAN_FIELDS.has(field)) {
    if (input.value === '') return null;
    return input.value === 'true';
  }
  if (NUMBER_FIELDS.has(field)) {
    if (field === 'role' && input.value === '') return null;
    if (input.value === '') return NULLABLE_NUMBER_FIELDS.has(field) ? null : 0;
    return Number(input.value);
  }
  return input.value;
}

function createEntry() {
  if (!app.activeData) return;
  finishInputHistory();
  captureUndoState(t('action.new'));
  const uid = getFreeEntryUid(app.activeData);
  const entry = createEntryTemplate(uid, t('action.new'));
  insertEntry(app.activeData, entry);
  app.activeEntryId = String(uid);
  setEditorDirty(true);
  renderEditor();
}

function duplicateEntry() {
  const record = getActiveEntryRecord();
  if (!app.activeData || !record) return;

  finishInputHistory();
  captureUndoState(t('action.duplicate'));
  const uid = getFreeEntryUid(app.activeData);
  const entry = {
    ...cloneValue(record.entry),
    uid,
    comment: `${t('action.duplicate')} ${entryTitle(record.entry)}`,
  };
  insertEntry(app.activeData, entry);
  app.activeEntryId = String(uid);
  setEditorDirty(true);
  renderEditor();
}

function deleteEntry() {
  const record = getActiveEntryRecord();
  if (!app.activeData || !record) return;
  const ok = window.confirm(t('confirm.deleteEntry', { title: entryTitle(record.entry) }));
  if (!ok) return;

  finishInputHistory();
  captureUndoState(t('action.delete'));
  removeEntry(app.activeData, record);
  ensureActiveEntry();
  setEditorDirty(true);
  renderEditor();
}

function setEditorDirty(dirty) {
  app.editorDirty = dirty;
  renderActiveBook();
  renderEntryList();
  if (dirty) setStatus(t('status.unsavedEdits'));
}

function captureUndoState(label = '') {
  if (!app.activeData) return;
  const historyLabel = label || t('action.edit');
  app.undoStack.push({
    label: historyLabel,
    data: cloneValue(app.activeData),
    activeEntryId: app.activeEntryId,
    editorDirty: app.editorDirty,
    editorSourceLabel: app.editorSourceLabel,
    activeFindIndex: app.activeFindIndex,
  });
  if (app.undoStack.length > MAX_UNDO_STEPS) app.undoStack.shift();
  app.redoStack = [];
  renderEditorState();
}

function resetEditorHistory({ render = true } = {}) {
  app.undoStack = [];
  app.redoStack = [];
  app.pendingInputHistoryKey = '';
  if (render) renderEditorState();
}

function undoEditorChange() {
  finishInputHistory();
  if (!app.undoStack.length || !app.activeData) return;

  const previous = app.undoStack.pop();
  const current = createHistoryState(previous.label);
  app.redoStack.push(current);
  restoreHistoryState(previous);
  setStatus(t('status.undo', { label: previous.label }));
}

function redoEditorChange() {
  finishInputHistory();
  if (!app.redoStack.length || !app.activeData) return;

  const next = app.redoStack.pop();
  const current = createHistoryState(next.label);
  app.undoStack.push(current);
  restoreHistoryState(next);
  setStatus(t('status.redo', { label: next.label }));
}

function createHistoryState(label) {
  return {
    label,
    data: cloneValue(app.activeData),
    activeEntryId: app.activeEntryId,
    editorDirty: app.editorDirty,
    editorSourceLabel: app.editorSourceLabel,
    activeFindIndex: app.activeFindIndex,
  };
}

function restoreHistoryState(state) {
  app.activeData = cloneValue(state.data);
  app.activeEntryId = state.activeEntryId;
  app.editorDirty = state.editorDirty;
  app.editorSourceLabel = state.editorSourceLabel;
  app.activeFindIndex = state.activeFindIndex;
  ensureActiveEntry();
  refreshFindMatches();
  renderEditor();
  queueFocusActiveFindMatch();
}

async function saveEditorWorldbook() {
  if (!app.activeBook || !app.activeData || !app.editorDirty) return;

  setStatus(t('status.savingWorldbook'));
  const name = app.activeBook.name;
  const title = app.activeExperiment?.title || 'Workbench edit';
  const before = await loadWorldbook(name);
  await createLocalSnapshotFromData(name, before, {
    label: `Before save: ${title}`,
    reason: 'editor-before',
    skipDuplicate: true,
  });

  normalizeWorldbookRoles(app.activeData);
  await saveWorldbook(name, app.activeData);
  const saved = await loadWorldbook(name);
  app.activeData = cloneValue(saved);
  app.activeDataHash = await hashObject(app.activeData);
  app.editorSourceLabel = 'Current';
  app.editorDirty = false;
  resetEditorHistory({ render: false });
  ensureActiveEntry();

  const after = await createLocalSnapshotFromData(name, app.activeData, {
    label: `After save: ${title}`,
    reason: 'editor-after',
    skipDuplicate: false,
  });

  app.activeSnapshot = after.snapshot;
  if (app.activeExperiment) {
    app.activeExperiment = {
      ...app.activeExperiment,
      status: app.activeExperiment.status || 'testing',
      afterSnapshotId: after.snapshot.id,
      changeNote: app.activeExperiment.changeNote || 'Saved from workbench',
    };
    await putExperiment(app.activeExperiment);
    app.activeView = 'experiment';
  } else {
    app.activeView = 'snapshot';
  }

  await loadLocalSnapshots();
  renderEditor();
  setStatus(t('status.saved'));
}

async function reloadEditorWorldbook() {
  if (!await confirmDiscardEditorChanges()) return;
  setStatus(t('status.reloadingWorldbook'));
  await loadEditorWorldbook({ force: true });
  await loadLocalSnapshots();
  setStatus(t('status.ready'));
}

async function confirmDiscardEditorChanges() {
  if (!app.editorDirty) return true;
  return window.confirm(t('confirm.discardEdits'));
}

function renderSnapshots() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const list = root.querySelector('#wbh-snapshots');
  const visibleSnapshots = app.snapshots.filter(snapshot => snapshot.reason !== 'origin');
  root.querySelector('#wbh-snapshot-count').textContent = String(visibleSnapshots.length);

  if (!visibleSnapshots.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = t('empty.noVersionsYet');
    list.replaceChildren(empty);
    return;
  }

  list.replaceChildren(...visibleSnapshots.map(snapshot => {
    const row = document.createElement('div');
    row.className = `wbh-history-row ${app.activeView === 'snapshot' && app.activeSnapshot?.id === snapshot.id ? 'active' : ''}`;

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'wbh-row';
    main.innerHTML = '<span></span><small></small>';
    main.querySelector('span').textContent = displaySnapshotLabel(snapshot.label || t('label.untitledVersion'));
    main.querySelector('small').textContent = `${formatDate(snapshot.createdAt)} | ${entriesLabel(snapshot.entryCount || 0)}`;
    main.addEventListener('click', async () => {
      await loadSnapshotIntoEditor(snapshot, t('label.version'));
    });

    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'wbh-mini';
    restore.textContent = t('action.restore');
    restore.addEventListener('click', async () => restoreSnapshot(snapshot, displaySnapshotLabel(snapshot.label || t('label.version'))));

    const promote = document.createElement('button');
    promote.type = 'button';
    promote.className = 'wbh-mini';
    promote.textContent = t('action.exp');
    promote.title = t('tooltip.promoteExperiment');
    promote.addEventListener('click', async () => createExperimentFromSnapshot(snapshot));

    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'wbh-mini';
    rename.textContent = t('action.name');
    rename.addEventListener('click', async () => {
      const label = window.prompt(t('prompt.versionName'), snapshot.label || '');
      if (label === null) return;
      snapshot.label = label.trim();
      await putSnapshot(snapshot);
      await loadLocalSnapshots();
    });

    row.append(main, createHistoryActionMenu([restore, promote, rename]));
    return row;
  }));
}

async function createExperimentFromSnapshot(snapshot) {
  if (!app.activeBook || !snapshot) return;

  const defaultTitle = snapshot.label
    ? snapshot.label.replace(/^(After save:|After:|Manual snapshot)\s*/i, '').trim()
    : '';
  const title = window.prompt(t('prompt.experimentName'), defaultTitle || t('label.experiment', { date: formatDate(snapshot.createdAt) }));
  if (title === null) return;

  const baseline = getPreviousSnapshot(snapshot) || app.originSnapshot || snapshot;
  const now = new Date();
  const cleanTitle = title.trim() || t('label.experiment', { date: formatDate(now.toISOString()) });
  const experiment = {
    id: `${app.activeBook.name}:experiment:${formatDateForFile(now)}:${randomId()}`,
    bookName: app.activeBook.name,
    title: cleanTitle,
    status: 'testing',
    startedAt: baseline.createdAt || snapshot.createdAt || now.toISOString(),
    startedAtMs: Number(baseline.createdAtMs || snapshot.createdAtMs || now.getTime()),
    finishedAt: snapshot.createdAt || now.toISOString(),
    finishedAtMs: Number(snapshot.createdAtMs || now.getTime()),
    baselineSnapshotId: baseline.id,
    afterSnapshotId: snapshot.id,
    changeNote: snapshot.label ? t('label.fromVersion', { label: displaySnapshotLabel(snapshot.label) }) : t('label.createdFromVersion'),
    resultNote: '',
    parentExperimentId: '',
  };

  await putExperiment(experiment);
  app.activeView = 'experiment';
  app.mainTab = 'diff';
  app.activeExperiment = experiment;
  app.activeSnapshot = snapshot;
  await loadLocalSnapshots();
  setStatus(t('status.experimentCreatedFromVersion'));
}

async function createManualLocalSnapshot() {
  if (!app.activeBook) return;
  setStatus(t('status.creatingSnapshot'));
  const label = app.activeExperiment?.title
    ? `Manual snapshot: ${app.activeExperiment.title}`
    : 'Manual snapshot';
  const result = await createLocalSnapshot(app.activeBook.name, {
    label,
    reason: 'manual',
    skipDuplicate: false,
  });
  app.activeView = 'snapshot';
  app.activeExperiment = null;
  app.activeSnapshot = result.snapshot;
  setStatus(result.skipped ? t('status.skippedDuplicate') : t('status.snapshotCreated'));
  await loadLocalSnapshots();
}

async function createLocalSnapshot(name, { label = '', reason = 'manual', skipDuplicate = true } = {}) {
  const data = await loadWorldbook(name);
  return createLocalSnapshotFromData(name, data, { label, reason, skipDuplicate });
}

async function createLocalSnapshotFromData(name, data, { label = '', reason = 'manual', skipDuplicate = true } = {}) {
  const sourceHash = await hashObject(data);
  const snapshots = await getSnapshots(name);
  if (skipDuplicate && snapshots[0]?.sourceHash === sourceHash) {
    return { skipped: true, snapshot: snapshots[0] };
  }

  const now = new Date();
  const snapshot = {
    id: `${name}:${formatDateForFile(now)}:${sourceHash.slice(0, 10)}`,
    bookName: name,
    label,
    reason,
    createdAt: now.toISOString(),
    createdAtMs: now.getTime(),
    sourceHash,
    entryCount: countEntries(data),
    data,
  };
  await putSnapshot(snapshot);
  return { skipped: false, snapshot };
}

async function startExperiment() {
  if (!app.activeBook) return;
  const openExperiment = getOpenExperiment();
  if (openExperiment) {
    app.activeView = 'experiment';
    app.activeExperiment = openExperiment;
    app.mainTab = 'edit';
    renderActiveBook();
    renderExperiments();
    setStatus(t('status.finishOpenExperiment', { title: openExperiment.title || t('label.currentExperiment') }));
    return;
  }

  const title = window.prompt(t('prompt.experimentName'), '');
  if (title === null) return;

  const cleanTitle = title.trim() || t('label.experiment', { date: formatDate(new Date().toISOString()) });
  setStatus(t('status.startingExperiment'));
  const baseline = await createLocalSnapshot(app.activeBook.name, {
    label: `Baseline: ${cleanTitle}`,
    reason: 'experiment-baseline',
    skipDuplicate: false,
  });
  const now = new Date();
  const experiment = {
    id: `${app.activeBook.name}:experiment:${formatDateForFile(now)}:${randomId()}`,
    bookName: app.activeBook.name,
    title: cleanTitle,
    status: 'testing',
    startedAt: now.toISOString(),
    startedAtMs: now.getTime(),
    finishedAt: '',
    finishedAtMs: 0,
    baselineSnapshotId: baseline.snapshot.id,
    afterSnapshotId: '',
    changeNote: '',
    resultNote: '',
    parentExperimentId: app.activeView === 'experiment' ? app.activeExperiment?.id || '' : '',
  };

  await putExperiment(experiment);
  app.activeView = 'experiment';
  app.mainTab = 'edit';
  app.activeExperiment = experiment;
  app.activeSnapshot = baseline.snapshot;
  setStatus(t('status.experimentStarted'));
  await loadLocalSnapshots();
}

async function finishExperiment() {
  if (!app.activeBook || !app.activeExperiment) return;
  if (app.editorDirty) {
    const saveFirst = window.confirm(t('confirm.saveBeforeFinish'));
    if (!saveFirst) return;
    await saveEditorWorldbook();
  }

  const experiment = app.activeExperiment;
  setStatus(isExperimentOpen(experiment) ? t('status.finishingExperiment') : t('status.updatingExperiment'));
  let afterSnapshot = experiment.afterSnapshotId ? await getSnapshotById(experiment.afterSnapshotId) : null;
  if (!afterSnapshot || !isExperimentOpen(experiment)) {
    const after = await createLocalSnapshot(app.activeBook.name, {
      label: `After: ${experiment.title}`,
      reason: 'experiment-after',
      skipDuplicate: false,
    });
    afterSnapshot = after.snapshot;
  }
  const now = new Date();
  const updated = {
    ...experiment,
    status: experiment.status || 'testing',
    finishedAt: now.toISOString(),
    finishedAtMs: now.getTime(),
    afterSnapshotId: afterSnapshot.id,
    changeNote: experiment.changeNote || '',
  };

  await putExperiment(updated);
  app.activeView = 'experiment';
  app.activeExperiment = updated;
  app.activeSnapshot = afterSnapshot;
  setStatus(t('status.experimentSaved'));
  await loadLocalSnapshots();
}

async function restoreExperimentResult(experiment) {
  if (!app.activeBook || !experiment?.afterSnapshotId) return;
  const snapshot = await getSnapshotById(experiment.afterSnapshotId);
  if (!snapshot) return;
  await restoreSnapshot(snapshot, t('label.experimentResult', { title: experiment.title || t('label.untitledExperiment') }));
}

async function setExperimentStatus(status) {
  if (!app.activeExperiment) return;
  const updated = {
    ...app.activeExperiment,
    status,
    decidedAt: new Date().toISOString(),
  };
  await putExperiment(updated);
  app.activeExperiment = updated;
  await loadLocalSnapshots();
}

async function restoreOriginSnapshot() {
  if (!app.activeBook || !app.originSnapshot) return;
  await restoreSnapshot(app.originSnapshot, t('label.origin'));
}

async function restoreExperimentSnapshot(point) {
  if (!app.activeBook || !app.activeExperiment) return;
  const snapshotId = point === 'baseline'
    ? app.activeExperiment.baselineSnapshotId
    : app.activeExperiment.afterSnapshotId;
  const snapshot = await getSnapshotById(snapshotId);
  if (!snapshot) return;

  const label = point === 'baseline' ? t('action.baseline') : t('action.after');
  const ok = window.confirm(t('confirm.restoreExperimentPoint', {
    book: app.activeBook.name,
    label,
    point: label,
    title: app.activeExperiment.title,
  }));
  if (!ok) return;

  setStatus(t('status.restoring'));
  await createLocalSnapshot(app.activeBook.name, {
    label: `Before restore ${formatDate(new Date().toISOString())}`,
    reason: 'pre-restore',
    skipDuplicate: false,
  });
  await saveWorldbook(app.activeBook.name, snapshot.data);
  await loadEditorWorldbook({ force: true });
  app.activeView = 'experiment';
  app.activeSnapshot = snapshot;
  await loadLocalSnapshots();
  setStatus(t('status.restored'));
}

function setDiffMode(mode) {
  app.diffMode = mode;
  app.diffChangeIndex = -1;
  const root = document.querySelector('#wbh-workbench');
  root.querySelector('#wbh-mode-current').classList.toggle('active', mode === 'current');
  root.querySelector('#wbh-mode-previous').classList.toggle('active', mode === 'previous');
  void renderDiff({ focusChange: true });
}

async function renderDiff({ focusChange = false } = {}) {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;

  renderActiveBook();
  const summary = root.querySelector('#wbh-diff-summary');
  const view = root.querySelector('#wbh-diff');

  if (app.activeView === 'experiment' && app.activeExperiment) {
    await renderExperimentDiff(summary, view);
    return;
  }

  if (!app.activeBook || !app.activeSnapshot) {
    summary.textContent = '';
    view.className = 'wbh-diff';
    view.textContent = t('empty.selectSnapshot');
    updateDiffChangeControls();
    return;
  }

  let base = app.activeSnapshot.data;
  let target = null;
  if (app.diffMode === 'current') {
    target = await loadWorldbook(app.activeBook.name);
  } else {
    const previous = getPreviousSnapshot(app.activeSnapshot);
    if (!previous) {
      summary.textContent = '';
      view.textContent = t('empty.noPreviousVersion');
      updateDiffChangeControls();
      return;
    }
    base = previous.data;
    target = app.activeSnapshot.data;
  }

  const diff = diffWorldbooks(base, target);
  summary.textContent = t('diff.summary', diff.summary);
  view.replaceChildren(...renderDiffPreview(base, target, diff));
  updateDiffChangeControls();
  if (focusChange) queueFocusDiffChange(0);
}

async function renderExperimentDiff(summary, view) {
  const baseline = await getSnapshotById(app.activeExperiment.baselineSnapshotId);
  if (!app.activeBook || !baseline) {
    summary.textContent = '';
    view.textContent = t('empty.noBaseline');
    updateDiffChangeControls();
    return;
  }

  const after = app.activeExperiment.afterSnapshotId
    ? await getSnapshotById(app.activeExperiment.afterSnapshotId)
    : null;
  const target = after?.data || await loadWorldbook(app.activeBook.name);
  const diff = diffWorldbooks(baseline.data, target);
  const range = after ? t('label.rangeAfter') : t('label.rangeCurrent');
  summary.textContent = t('diff.summaryWithRange', { range, ...diff.summary });
  view.replaceChildren(...renderDiffPreview(baseline.data, target, diff));
  updateDiffChangeControls();
}

function navigateDiffChange(direction) {
  const changes = getDiffChangeElements();
  if (!changes.length) {
    updateDiffChangeControls();
    return;
  }

  const next = app.diffChangeIndex < 0
    ? (direction < 0 ? changes.length - 1 : 0)
    : (app.diffChangeIndex + direction + changes.length) % changes.length;
  focusDiffChange(next);
}

function queueFocusDiffChange(index = 0) {
  window.requestAnimationFrame(() => focusDiffChange(index));
}

function focusDiffChange(index = 0) {
  const changes = getDiffChangeElements();
  if (!changes.length) {
    app.diffChangeIndex = -1;
    updateDiffChangeControls();
    return;
  }

  app.diffChangeIndex = Math.min(Math.max(index, 0), changes.length - 1);
  changes.forEach(element => element.classList.remove('change-active'));
  const active = changes[app.diffChangeIndex];
  active.classList.add('change-active');
  active.scrollIntoView({ block: 'center', behavior: 'smooth' });
  updateDiffChangeControls();
  setStatus(t('status.changedEntries', { current: app.diffChangeIndex + 1, total: changes.length }));
}

function updateDiffChangeControls() {
  const root = document.querySelector('#wbh-workbench');
  if (!root) return;
  const changes = getDiffChangeElements();
  root.querySelector('#wbh-change-prev').disabled = !changes.length;
  root.querySelector('#wbh-change-next').disabled = !changes.length;
  if (!changes.length) app.diffChangeIndex = -1;
}

function getDiffChangeElements() {
  return [...document.querySelectorAll('#wbh-diff [data-wbh-change="true"]')];
}

function renderDiffPreview(base, target, diff) {
  const baseEntries = normalizeEntries(base?.entries);
  const targetEntries = normalizeEntries(target?.entries);
  const diffById = new Map((diff?.entries || []).map(entry => [entry.id, entry]));
  const ids = [...new Set([
    ...Object.keys(targetEntries),
    ...[...diffById.values()].filter(entry => entry.status === 'removed').map(entry => entry.id),
  ])].sort((left, right) => entryTitle(targetEntries[left] || baseEntries[left]).localeCompare(entryTitle(targetEntries[right] || baseEntries[right])));

  if (!ids.length) {
    const empty = document.createElement('div');
    empty.className = 'wbh-empty';
    empty.textContent = t('empty.noEntries');
    return [empty];
  }

  return ids.map(id => {
    const diffEntry = diffById.get(id);
    const status = diffEntry?.status || 'unchanged';
    const entry = targetEntries[id] || baseEntries[id] || {};
    const section = document.createElement('section');
    section.className = `wbh-diff-entry ${status}`;
    if (status !== 'unchanged') section.dataset.wbhChange = 'true';
    const title = document.createElement('h4');
    title.textContent = `${diffStatusLabel(status)} ${entryTitle(entry)}`;
    section.append(title);

    const meta = document.createElement('div');
    meta.className = 'wbh-preview-meta';
    meta.textContent = entryMeta(entry);
    section.append(meta);

    const fields = diffEntry?.fields || [];
    const summary = renderDiffFieldSummaries(fields);
    if (summary) section.append(summary);
    fields.filter(field => field.name !== 'content').forEach(field => section.append(renderDiffField(field)));
    section.append(renderPreviewContentField(entry, fields.find(field => field.name === 'content'), status));
    return section;
  });
}

function renderDiffFieldSummaries(fields) {
  const summaryFields = fields.filter(field => field.name !== 'content');
  if (!summaryFields.length) return null;

  const list = document.createElement('div');
  list.className = 'wbh-change-summary';
  summaryFields.forEach(field => {
    const item = document.createElement('span');
    item.className = 'wbh-change-pill';
    item.textContent = diffFieldSummary(field);
    list.append(item);
  });
  return list;
}

function renderDiffField(field) {
  const block = document.createElement('div');
  block.className = 'wbh-field';
  const name = document.createElement('strong');
  name.textContent = diffFieldLabel(field.name);
  block.append(name);

  if (field.lines?.length) {
    block.append(renderDiffLines(field.lines));
  } else {
    const grid = document.createElement('div');
    grid.className = 'wbh-field-grid';
    const before = document.createElement('pre');
    const after = document.createElement('pre');
    before.textContent = formatDiffFieldValue(field.name, field.before);
    after.textContent = formatDiffFieldValue(field.name, field.after);
    grid.append(before, after);
    block.append(grid);
  }

  return block;
}

function renderPreviewContentField(entry, contentDiff, status) {
  const block = document.createElement('div');
  block.className = 'wbh-field';
  const name = document.createElement('strong');
  name.textContent = t('field.content');
  block.append(name);

  if (contentDiff?.lines?.length) {
    block.append(renderDiffLines(contentDiff.lines));
  } else if (status === 'added' || status === 'removed') {
    const lines = String(entry?.content || '').split(/\r?\n/).map(text => ({
      type: status === 'added' ? 'added' : 'removed',
      text,
    }));
    block.append(renderDiffLines(lines));
  } else {
    const pre = document.createElement('pre');
    pre.textContent = entry?.content || '';
    block.append(pre);
  }

  return block;
}

function diffFieldLabel(field) {
  const key = DIFF_FIELD_LABELS[field];
  return key ? t(key) : fieldLabel(field);
}

function diffFieldSummary(field) {
  const before = shortDiffValue(formatDiffFieldValue(field.name, field.before));
  const after = shortDiffValue(formatDiffFieldValue(field.name, field.after));
  return `${diffFieldLabel(field.name)}: ${before} -> ${after}`;
}

function shortDiffValue(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim() || t('value.blank');
  return text.length > 84 ? `${text.slice(0, 81)}...` : text;
}

function formatDiffFieldValue(field, value) {
  if (value === '' || value === null || value === undefined) return t('value.blank');
  if (field === 'position') return positionLabel(value);
  if (field === 'role') return roleLabel(value);
  if (field === 'selectiveLogic') {
    const option = SELECTIVE_LOGIC_OPTIONS.find(item => item.value === Number(value));
    return option ? optionLabel(option) : blankable(value);
  }
  if (field === 'disable') return truthyString(value) ? t('flag.disabled') : t('field.enabled');
  if (field === 'constant') return truthyString(value) ? t('flag.constant') : t('value.normal');
  if (TRI_STATE_BOOLEAN_FIELDS.has(field)) return triStateLabel(value);
  if (BOOLEAN_DIFF_FIELDS.has(field)) return truthyString(value) ? t('value.on') : t('value.off');
  if (LIST_FIELDS.has(field)) return formatListDiffValue(value);
  if (field === 'probability' && value !== '') return `${value}%`;
  return blankable(value);
}

function blankable(value) {
  return value === undefined || value === null || value === '' ? t('value.blank') : String(value);
}

function truthyString(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function triStateLabel(value) {
  if (value === '' || value === null || value === undefined) return t('value.global');
  return truthyString(value) ? t('value.on') : t('value.off');
}

function formatListDiffValue(value) {
  if (value === '' || value === null || value === undefined) return t('value.blank');
  const text = String(value);
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.join('\n') || t('value.blank');
    } catch {
      return text;
    }
  }
  return text;
}

function renderDiffLines(lines) {
  const pre = document.createElement('pre');
  for (const line of lines) {
    const row = document.createElement('span');
    row.className = line.type;
    row.textContent = `${line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}${line.text}\n`;
    pre.append(row);
  }
  return pre;
}

async function restoreLocalSnapshot() {
  await restoreSnapshot(app.activeSnapshot, displaySnapshotLabel(app.activeSnapshot?.label || t('label.version')));
}

async function restoreSnapshot(snapshot, label = 'version') {
  if (!app.activeBook || !snapshot) return;
  const restoreLabel = label || displaySnapshotLabel(snapshot.label) || snapshot.createdAt || t('label.version');
  const ok = window.confirm(t('confirm.restoreSnapshot', { book: app.activeBook.name, label: restoreLabel }));
  if (!ok) return;

  setStatus(t('status.restoring'));
  await createLocalSnapshot(app.activeBook.name, {
    label: `Before restore to ${restoreLabel} ${formatDate(new Date().toISOString())}`,
    reason: 'pre-restore',
    skipDuplicate: false,
  });
  await saveWorldbook(app.activeBook.name, snapshot.data);
  await loadEditorWorldbook({ force: true });
  app.activeView = 'snapshot';
  app.mainTab = 'edit';
  app.activeExperiment = null;
  app.activeSnapshot = snapshot;
  await loadLocalSnapshots();
  setStatus(t('status.restoredLabel', { label: restoreLabel }));
}

function getPreviousSnapshot(snapshot) {
  const index = app.snapshots.findIndex(item => item.id === snapshot.id);
  return index >= 0 ? app.snapshots[index + 1] : null;
}

async function stPost(url, body) {
  const response = await ORIGINAL_FETCH(url, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(body || {}),
    credentials: 'include',
    cache: 'no-cache',
  });
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.json();
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        const store = db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
        store.createIndex('bookName', 'bookName', { unique: false });
        store.createIndex('createdAtMs', 'createdAtMs', { unique: false });
      }
      if (!db.objectStoreNames.contains(EXPERIMENT_STORE)) {
        const store = db.createObjectStore(EXPERIMENT_STORE, { keyPath: 'id' });
        store.createIndex('bookName', 'bookName', { unique: false });
        store.createIndex('startedAtMs', 'startedAtMs', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSnapshots(bookName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
    const store = tx.objectStore(SNAPSHOT_STORE);
    const index = store.index('bookName');
    const request = index.getAll(bookName);
    request.onsuccess = () => {
      resolve((request.result || []).sort((left, right) => Number(right.createdAtMs || 0) - Number(left.createdAtMs || 0)));
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function putSnapshot(snapshot) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
    tx.objectStore(SNAPSHOT_STORE).put(snapshot);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function getSnapshotById(id) {
  if (!id) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
    const request = tx.objectStore(SNAPSHOT_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function getExperiments(bookName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPERIMENT_STORE, 'readonly');
    const store = tx.objectStore(EXPERIMENT_STORE);
    const index = store.index('bookName');
    const request = index.getAll(bookName);
    request.onsuccess = () => {
      resolve((request.result || []).sort((left, right) => Number(right.startedAtMs || 0) - Number(left.startedAtMs || 0)));
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function putExperiment(experiment) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPERIMENT_STORE, 'readwrite');
    tx.objectStore(EXPERIMENT_STORE).put(experiment);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

function diffWorldbooks(base, current) {
  const baseEntries = normalizeEntries(base?.entries);
  const currentEntries = normalizeEntries(current?.entries);
  const allIds = [...new Set([...Object.keys(baseEntries), ...Object.keys(currentEntries)])]
    .sort((left, right) => entryTitle(baseEntries[left] || currentEntries[left]).localeCompare(entryTitle(baseEntries[right] || currentEntries[right])));
  const entries = [];

  for (const id of allIds) {
    const before = baseEntries[id] || null;
    const after = currentEntries[id] || null;
    if (!before) {
      entries.push({ id, status: 'added', title: entryTitle(after), fields: [] });
      continue;
    }
    if (!after) {
      entries.push({ id, status: 'removed', title: entryTitle(before), fields: [] });
      continue;
    }
    const fields = diffEntryFields(before, after);
    if (fields.length) entries.push({ id, status: 'changed', title: entryTitle(after), fields });
  }

  return {
    summary: {
      added: entries.filter(item => item.status === 'added').length,
      removed: entries.filter(item => item.status === 'removed').length,
      changed: entries.filter(item => item.status === 'changed').length,
      unchanged: allIds.length - entries.length,
    },
    entries,
  };
}

function diffEntryFields(before, after) {
  return DIFF_ENTRY_FIELDS.map(field => {
    const left = comparableEntryField(before, field);
    const right = comparableEntryField(after, field);
    if (left === right) return null;
    return {
      name: field,
      before: left,
      after: right,
      lines: field === 'content' || field === 'comment' ? diffLines(String(left), String(right)) : [],
    };
  }).filter(Boolean);
}

function comparableEntryField(entry, field) {
  const hasValue = Object.prototype.hasOwnProperty.call(entry || {}, field);
  const fallback = Object.prototype.hasOwnProperty.call(ENTRY_DEFAULTS, field) ? ENTRY_DEFAULTS[field] : '';
  const value = hasValue ? entry[field] : fallback;

  if (field === 'role') {
    const isBlank = value === undefined || value === null || value === '';
    if (isBlank) return Number(entry?.position) === 4 ? '0' : '';
  }
  if (field === 'disable' || BOOLEAN_DIFF_FIELDS.has(field)) {
    return truthyString(value) ? 'true' : 'false';
  }
  if (TRI_STATE_BOOLEAN_FIELDS.has(field)) {
    return value === undefined || value === null || value === '' ? '' : truthyString(value) ? 'true' : 'false';
  }
  return comparableField(value);
}

function diffLines(before, after) {
  const a = String(before || '').split(/\r?\n/);
  const b = String(after || '').split(/\r?\n/);
  const table = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      rows.push({ type: 'removed', text: a[i++] });
    } else {
      rows.push({ type: 'added', text: b[j++] });
    }
  }
  while (i < a.length) rows.push({ type: 'removed', text: a[i++] });
  while (j < b.length) rows.push({ type: 'added', text: b[j++] });
  return rows;
}

function normalizeEntries(entries) {
  if (!entries || typeof entries !== 'object') return {};
  if (Array.isArray(entries)) {
    return Object.fromEntries(entries.map((entry, index) => [String(entry.uid ?? entry.id ?? index), entry]));
  }
  return entries;
}

function getEntryRecords(data) {
  const entries = data?.entries;
  if (!entries || typeof entries !== 'object') return [];
  if (Array.isArray(entries)) {
    return entries.map((entry, index) => ({
      id: String(entry?.uid ?? entry?.id ?? index),
      storageKey: index,
      index,
      entry,
    }));
  }
  return Object.entries(entries).map(([key, entry], index) => ({
    id: String(key),
    storageKey: key,
    index,
    entry,
  }));
}

function insertEntry(data, entry) {
  if (!data.entries || typeof data.entries !== 'object') data.entries = {};
  if (Array.isArray(data.entries)) {
    data.entries.push(entry);
    return;
  }
  data.entries[String(entry.uid)] = entry;
}

function removeEntry(data, record) {
  if (!data?.entries || typeof data.entries !== 'object') return;
  if (Array.isArray(data.entries)) {
    data.entries.splice(record.storageKey, 1);
    return;
  }
  delete data.entries[record.storageKey];
}

function createEntryTemplate(uid, comment = '') {
  return {
    uid,
    ...cloneValue(ENTRY_DEFAULTS),
    comment,
  };
}

function getFreeEntryUid(data) {
  const used = new Set(getEntryRecords(data).flatMap(record => [
    String(record.id),
    String(record.entry?.uid ?? ''),
  ]));

  let uid = 0;
  while (used.has(String(uid))) uid++;
  return uid;
}

function getSortedEntryRecords(data) {
  return getEntryRecords(data).sort((left, right) => {
    const orderDiff = numericSort(left.entry?.order) - numericSort(right.entry?.order);
    if (orderDiff) return orderDiff;
    return left.index - right.index;
  });
}

function getActiveEntryRecord() {
  return getEntryRecords(app.activeData).find(record => record.id === app.activeEntryId) || null;
}

function getEntryRecordById(id) {
  return getEntryRecords(app.activeData).find(record => record.id === id) || null;
}

function ensureActiveEntry() {
  const records = getSortedEntryRecords(app.activeData);
  if (!records.length) {
    app.activeEntryId = null;
    return;
  }
  if (!records.some(record => record.id === app.activeEntryId)) {
    app.activeEntryId = records[0].id;
  }
}

function entryTitle(entry) {
  return cleanText(entry?.comment) || cleanText(entry?.name) || cleanText(entry?.uid) || t('value.untitled');
}

function entryMeta(entry) {
  const parts = [];
  if (entry?.constant) parts.push(t('flag.constant').toLowerCase());
  if (entry?.disable) parts.push(t('flag.disabled').toLowerCase());
  if (entry?.position !== undefined) parts.push(positionLabel(entry.position));
  if (Number(entry?.position) === 4) parts.push(t('role.depth', { role: roleLabel(entry.role), depth: entry?.depth ?? 0 }));
  if (entry?.order !== undefined) parts.push(`${t('field.order').toLowerCase()} ${entry.order}`);
  return parts.join(' | ') || t('value.entry');
}

function positionLabel(value) {
  const option = POSITION_OPTIONS.find(item => item.value === Number(value));
  return option ? optionLabel(option) : t('position.fallback', { value });
}

function roleLabel(value) {
  const option = ROLE_OPTIONS.find(item => item.value === Number(value));
  return option ? optionLabel(option) : t('role.system');
}

function downloadJson(filename, data) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value) {
  return String(value || 'export')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'export';
}

function numericSort(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
}

function comparableField(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === 'object') return stableStringify(value);
  return value === undefined || value === null ? '' : String(value);
}

function stringField(value) {
  return value === undefined || value === null ? '' : String(value);
}

function numberField(value) {
  return value === undefined || value === null || Number.isNaN(Number(value)) ? '' : String(value);
}

function listField(value) {
  if (Array.isArray(value)) return value.join('\n');
  if (value === undefined || value === null || value === '') return '';
  return String(value);
}

function parseListField(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(item => String(item));
    } catch {
      return [text];
    }
  }
  return text
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function countEntries(data) {
  const entries = data?.entries;
  if (!entries || typeof entries !== 'object') return 0;
  return Array.isArray(entries) ? entries.length : Object.keys(entries).length;
}

async function hashObject(value) {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function statusLabel(status) {
  if (status === 'kept') return t('status.kept');
  if (status === 'rejected') return t('status.rejected');
  return t('status.testing');
}

function randomId() {
  return [...crypto.getRandomValues(new Uint8Array(6))]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function readBooleanSetting(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function readStringSetting(key, fallback, allowedValues = null) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    if (allowedValues && !allowedValues.includes(value)) return fallback;
    return value;
  } catch {
    return fallback;
  }
}

function writeBooleanSetting(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // The toggle is cosmetic; ignore storage failures.
  }
}

function writeStringSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The toggle is cosmetic; ignore storage failures.
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function formatDateForFile(date) {
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    '-',
    pad(date.getMinutes()),
    '-',
    pad(date.getSeconds()),
    '-',
    pad(date.getMilliseconds(), 3),
  ].join('');
}

function setStatus(message) {
  const status = document.querySelector('#wbh-status');
  if (status) status.textContent = message;
}
