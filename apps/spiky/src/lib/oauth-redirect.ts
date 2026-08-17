import { isLoopbackHostname } from "./mcp-url";

/** Single redirect_uri / redirect_to safety (scheme, credentials, http→loopback). */
export function isSafeOauthRedirectUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.protocol === "http:" && !isLoopbackHostname(parsed.hostname)) {
    return false;
  }
  return true;
}

/**
 * Only navigate to OAuth redirect_to / deny targets that match the consent
 * redirect_uri (same origin + path). Extra query params (code, state, error) OK.
 */
export function isAllowedOauthRedirect(
  redirectTo: string,
  registeredRedirectUri: string,
): boolean {
  if (
    !isSafeOauthRedirectUri(redirectTo) ||
    !isSafeOauthRedirectUri(registeredRedirectUri)
  ) {
    return false;
  }

  let to: URL;
  let expected: URL;
  try {
    to = new URL(redirectTo);
    expected = new URL(registeredRedirectUri);
  } catch {
    return false;
  }

  if (to.origin !== expected.origin) return false;
  if (to.pathname !== expected.pathname) return false;
  return true;
}
