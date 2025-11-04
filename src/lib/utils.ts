import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ClassValue } from 'clsx'

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts the directory path from a file path.
 * Handles both Windows (\) and Unix (/) path separators.
 *
 * @param filePath - The full file path
 * @returns The directory path without the filename
 */
export function getDirectoryFromPath(filePath: string): string {
  // Normalize to forward slashes for consistent handling
  const normalizedPath = filePath.replace(/\\/g, '/')

  // Get the last separator index
  const lastSeparatorIndex = normalizedPath.lastIndexOf('/')

  if (lastSeparatorIndex === -1) {
    // No separator found, return empty string or current directory
    return ''
  }

  // Return everything before the last separator
  return filePath.substring(0, lastSeparatorIndex)
}
