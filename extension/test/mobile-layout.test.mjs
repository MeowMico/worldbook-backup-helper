import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MOBILE_WORKBENCH_PANES,
  normalizeMobileWorkbenchPane,
  resolveMobileWorkbenchState,
} from '../mobile-layout.mjs';

test('mobile workbench exposes the four focused panes', () => {
  assert.deepEqual(MOBILE_WORKBENCH_PANES, ['books', 'entries', 'editor', 'history']);
  assert.equal(normalizeMobileWorkbenchPane('history'), 'history');
  assert.equal(normalizeMobileWorkbenchPane('unknown'), 'entries');
});

test('opening entries or the editor returns to edit mode', () => {
  assert.deepEqual(resolveMobileWorkbenchState({ mainTab: 'diff' }, 'entries'), {
    mobilePane: 'entries',
    mainTab: 'edit',
  });
  assert.deepEqual(resolveMobileWorkbenchState({ mainTab: 'mvu' }, 'editor'), {
    mobilePane: 'editor',
    mainTab: 'edit',
  });
});

test('programmatic editor navigation can preserve diff or MVU mode', () => {
  assert.deepEqual(resolveMobileWorkbenchState({ mainTab: 'diff' }, 'editor', { preserveMainTab: true }), {
    mobilePane: 'editor',
    mainTab: 'diff',
  });
  assert.deepEqual(resolveMobileWorkbenchState({ mainTab: 'mvu' }, 'history'), {
    mobilePane: 'history',
    mainTab: 'mvu',
  });
  assert.equal(resolveMobileWorkbenchState({ mainTab: 'edit' }, 'unknown'), null);
});
