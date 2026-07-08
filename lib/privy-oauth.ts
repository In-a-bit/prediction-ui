/** True when the URL contains Privy headless OAuth callback query params. */
export function isPrivyOAuthReturn(search = window.location.search): boolean {
  const params = new URLSearchParams(search);
  return params.has("privy_oauth_code");
}

/** Remove Privy OAuth query params from the current URL without navigation. */
export function stripPrivyOAuthParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("privy_oauth_state");
  url.searchParams.delete("privy_oauth_provider");
  url.searchParams.delete("privy_oauth_code");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}
