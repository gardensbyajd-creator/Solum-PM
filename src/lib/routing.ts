export type InitialWorkspaceView = "command" | "onboarding";

export function resolveInitialWorkspaceView(pathname: string): InitialWorkspaceView {
  return pathname.replace(/\/+$/, "") === "/onboarding" ? "onboarding" : "command";
}

export function isPublicLandingPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized === "" || normalized === "/";
}

export function hasCheckoutReturn(search: string) {
  return new URLSearchParams(search).has("session_id");
}
