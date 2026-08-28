/**
 * Robustly parses Brazilian currency strings (e.g. "1.500,00" or "1500.00" or "1500") into numbers.
 */
export function parseCurrencyBR(val: string | number | undefined | null): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  
  const str = val.toString().trim();
  // If there are dots and commas, remove dots (thousand separators) and replace comma with dot
  // e.g. "1.500,00" -> "1500,00" -> "1500.00" -> 1500
  // If there is only dot and no comma, e.g. "1500.50", parseFloat works.
  // If there is comma and no dot, e.g. "1500,50", replace comma with dot -> "1500.50".
  let cleaned = str;
  if (str.includes('.') && str.includes(',')) {
    // Check if dot comes before comma (standard BR format "1.500,00")
    if (str.indexOf('.') < str.indexOf(',')) {
      cleaned = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US format "1,500.00"
      cleaned = str.replace(/,/g, '');
    }
  } else if (str.includes(',') && !str.includes('.')) {
    cleaned = str.replace(',', '.');
  } else if (str.includes('.') && !str.includes(',')) {
    // If multiple dots, e.g. "1.500.000", remove all except last or treat as thousands
    const parts = str.split('.');
    if (parts.length > 2) {
      cleaned = parts.join('');
    }
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
