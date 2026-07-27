export function cleanWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
