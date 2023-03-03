export function limit(str, limit) {
  return str.length > limit ? `${str.slice(0, limit - 3)}...` : str;
}
