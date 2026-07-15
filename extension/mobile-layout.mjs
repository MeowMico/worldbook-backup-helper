export const MOBILE_WORKBENCH_PANES = Object.freeze(['books', 'entries', 'editor', 'history']);

export function normalizeMobileWorkbenchPane(pane, fallback = 'entries') {
  if (MOBILE_WORKBENCH_PANES.includes(pane)) return pane;
  return MOBILE_WORKBENCH_PANES.includes(fallback) ? fallback : 'entries';
}

export function resolveMobileWorkbenchState(currentState, pane, { preserveMainTab = false } = {}) {
  if (!MOBILE_WORKBENCH_PANES.includes(pane)) return null;

  const currentMainTab = currentState?.mainTab || 'edit';
  const shouldOpenEdit = !preserveMainTab && (pane === 'entries' || pane === 'editor');
  return {
    mobilePane: pane,
    mainTab: shouldOpenEdit ? 'edit' : currentMainTab,
  };
}
