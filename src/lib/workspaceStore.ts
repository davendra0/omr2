const WORKSPACE_NAME_KEY = 'workspace_name';
const DEFAULT_NAME = 'Workspace';

export function getWorkspaceName(): string {
  return localStorage.getItem(WORKSPACE_NAME_KEY) || DEFAULT_NAME;
}

export function setWorkspaceName(name: string) {
  localStorage.setItem(WORKSPACE_NAME_KEY, name.trim() || DEFAULT_NAME);
}
