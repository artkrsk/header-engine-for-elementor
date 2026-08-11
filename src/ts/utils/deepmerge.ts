/** Recursive object merge (objects deep, arrays concatenated, scalars overwritten). */
export const deepmerge = <T extends object, U extends object>(target: T, source: U): T & U => {
  const output = { ...target } as T & U
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return output
  }
  for (const key of Object.keys(source)) {
    const targetValue = target[key as keyof T]
    const sourceValue = source[key as keyof U]
    if (
      targetValue &&
      sourceValue &&
      typeof targetValue === 'object' &&
      typeof sourceValue === 'object' &&
      !Array.isArray(targetValue) &&
      !Array.isArray(sourceValue)
    ) {
      output[key as keyof (T & U)] = deepmerge(targetValue as any, sourceValue as any) as any
    } else if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      output[key as keyof (T & U)] = [...targetValue, ...sourceValue] as any
    } else if (sourceValue !== undefined) {
      output[key as keyof (T & U)] = sourceValue as any
    }
  }
  return output
}
