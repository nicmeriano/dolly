export function resolveUrl(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  const relative = url.startsWith("/") ? url.slice(1) : url;
  return new URL(relative, base).href;
}
