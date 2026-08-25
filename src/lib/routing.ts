export type InitialWorkspaceView = "command" | "onboarding";

export function resolveInitialWorkspaceView(pathname: string): InitialWorkspaceView {
  return pathname.replace(/\/+$/, "") === "/onboarding" ? "onboarding" : "command";
}

export function hasCheckoutReturn(search: string) {
  return new URLSearchParams(search).has("session_id");
}
