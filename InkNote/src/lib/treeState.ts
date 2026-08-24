import { getStoredValue, setStoredValue } from "./settingsStore";

const KEY = "mdnote.treeExpansion";

export interface TreeExpansionState {
  rootExpanded: boolean;
  expanded: string[];
}

type StoredTreeStates = Record<string, TreeExpansionState>;

function readStates(): StoredTreeStates {
  try {
    const parsed = JSON.parse(getStoredValue(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as StoredTreeStates
      : {};
  } catch {
    return {};
  }
}

export function getTreeExpansion(rootPath: string): TreeExpansionState {
  const value = readStates()[rootPath];
  return {
    rootExpanded: value?.rootExpanded !== false,
    expanded: Array.isArray(value?.expanded)
      ? value.expanded.filter((path): path is string => typeof path === "string")
      : [],
  };
}

export function setTreeExpansion(rootPath: string, value: TreeExpansionState) {
  const states = readStates();
  states[rootPath] = {
    rootExpanded: value.rootExpanded,
    expanded: [...new Set(value.expanded)],
  };
  setStoredValue(KEY, JSON.stringify(states));
}

export function removeTreeExpansion(rootPath: string) {
  const states = readStates();
  if (!(rootPath in states)) return;
  delete states[rootPath];
  setStoredValue(KEY, JSON.stringify(states));
}
