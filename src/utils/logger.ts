/**
 * Utilitaire pour ajouter des timestamps lisibles aux logs
 */

/**
 * Formate la date actuelle en timestamp lisible
 * Format: [2025-10-27 21:30:45]
 */
function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}]`;
}

/**
 * Console.log avec timestamp
 */
export function log(...args: any[]): void {
  console.log(getTimestamp(), ...args);
}

/**
 * Console.error avec timestamp
 */
export function error(...args: any[]): void {
  console.error(getTimestamp(), ...args);
}

/**
 * Console.warn avec timestamp
 */
export function warn(...args: any[]): void {
  console.warn(getTimestamp(), ...args);
}

/**
 * Console.info avec timestamp
 */
export function info(...args: any[]): void {
  console.info(getTimestamp(), ...args);
}
