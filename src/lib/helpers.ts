export function limit(str: string, limit: number): string {
  return str.length > limit ? `${str.slice(0, limit - 3)}...` : str;
}
