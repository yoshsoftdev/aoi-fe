/**
 * Format number to 2 decimal places
 * Example: 1.23456789 -> 1.23
 * For very large numbers (scientific notation), shows only base with 2 decimals: 1.1900731318791476e+25 -> 1.19
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
  if (isNaN(num) || !isFinite(num)) {
    return String(value)
  }

  // Round to specified decimal places
  const fixedStr = num.toFixed(decimals)
  
  // Check if result is in scientific notation (for very large numbers)
  if (fixedStr.includes('e') || fixedStr.includes('E')) {
    // Parse scientific notation and extract only the base part
    const parts = fixedStr.split(/[eE]/)
    const base = parts[0]
    const baseNum = parseFloat(base)
    
    // Return only the base with specified decimal places (without exponent)
    // This will show as "1.19" for very large numbers like 1.1900731318791476e+25
    return baseNum.toFixed(decimals)
  }
  
  // Normal number, return as is
  return fixedStr
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

