/**
 * Backward-compatible re-export of flow state from useAppState.
 * Existing (flow) screens import { useFlowState } from here — this
 * delegates to the broader AppStateProvider so everything shares one context.
 */
export { AppStateProvider as FlowStateProvider, useFlowState } from './useAppState';
