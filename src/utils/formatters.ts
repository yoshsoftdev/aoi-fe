/**
 * Format number to 2 decimal places
 * Example: 1.23456789 -> 1.23
 * 
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number as string, or original value if not a number
 */
export function formatNumber(value: any, decimals: number = 2): string {
  // If value is null, undefined, or not a number, return as string
  if (value === null || value === undefined) {
    return String(value)
  }

  // Convert to number
  const num = Number(value)

  // If not a valid number, return original value as string
  if (isNaN(num)) {
    return String(value)
  }

  // Round to specified decimal places
  return num.toFixed(decimals)
}

/**
 * Format number to 2 decimal places and remove trailing zeros
 * Example: 1.23456789 -> "1.23", 1.00 -> "1"
 * 
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number as string without trailing zeros
 */
export function formatNumberCompact(value: any, decimals: number = 2): string {
  const formatted = formatNumber(value, decimals)
  
  // Remove trailing zeros and decimal point if not needed
  return formatted.replace(/\.?0+$/, '')
}

