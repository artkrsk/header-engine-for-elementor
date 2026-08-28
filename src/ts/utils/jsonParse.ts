/** Lenient JSON parse: falls back to a relaxed→canonical rewrite before giving up on `{}`. */
export const JSONParse = (strObj: string): Record<string, unknown> => {
  if (!strObj || typeof strObj !== 'string') {
    return {}
  }
  try {
    return JSON.parse(strObj)
  } catch {
    try {
      return JSON.parse(convertToStandardJSON(strObj))
    } catch {
      return {}
    }
  }
}

function convertToStandardJSON(strObj: string): string {
  if (!strObj) {
    return '{}'
  }
  return strObj
    .replace(/'/g, '"')
    .replace(/(?<=\{|,)(\s*)([a-zA-Z0-9_$]+)(\s*):/g, '$1"$2"$3:')
    .replace(/}"/g, '},"')
    .replace(/]"/g, '],"')
    .replace(/}'/g, '},')
    .replace(/]'/g, '],')
}
