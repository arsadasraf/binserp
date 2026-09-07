/**
 * Utility functions to calculate and format attendance work durations
 * in hours and minutes (e.g., "1 hour 40 minutes" instead of "1.4 hours" or "1.67 h").
 */

export interface WorkDurationRecord {
  checkIn?: { time?: string | Date | null } | null;
  checkOut?: { time?: string | Date | null } | null;
  hoursWorked?: number | string | null;
  workedText?: string | null;
}

/**
 * Calculates the exact duration worked in integer minutes.
 * Prioritizes actual check-in & check-out timestamps to avoid rounding discrepancies.
 * Falls back to hoursWorked (in decimal hours) if check-out time is unavailable.
 */
export function getWorkDurationMinutes(record?: WorkDurationRecord | null): number {
  if (!record) return 0;

  if (record.checkIn?.time && record.checkOut?.time) {
    const inTime = new Date(record.checkIn.time).getTime();
    const outTime = new Date(record.checkOut.time).getTime();
    if (!isNaN(inTime) && !isNaN(outTime) && outTime > inTime) {
      return Math.round((outTime - inTime) / 60000);
    }
  }

  if (record.hoursWorked !== undefined && record.hoursWorked !== null) {
    const numHours = typeof record.hoursWorked === "string" ? parseFloat(record.hoursWorked) : record.hoursWorked;
    if (!isNaN(numHours) && numHours > 0) {
      return Math.round(numHours * 60);
    }
  }

  return 0;
}

/**
 * Formats a record or minutes into a human-readable "X hour(s) Y minute(s)" string.
 * Examples:
 *  - 100 minutes -> "1 hour 40 minutes"
 *  - 120 minutes -> "2 hours"
 *  - 45 minutes -> "45 minutes"
 *  - 0 minutes -> "-"
 */
export function formatWorkDuration(
  recordOrMinutes?: WorkDurationRecord | number | string | null,
  options?: { compact?: boolean; zeroPlaceholder?: string }
): string {
  const zeroPlaceholder = options?.zeroPlaceholder ?? "-";
  if (recordOrMinutes === undefined || recordOrMinutes === null || recordOrMinutes === "") {
    return zeroPlaceholder;
  }

  let totalMinutes = 0;
  if (typeof recordOrMinutes === "number") {
    totalMinutes = Math.round(recordOrMinutes);
  } else if (typeof recordOrMinutes === "string") {
    const parsed = parseFloat(recordOrMinutes);
    if (isNaN(parsed)) return zeroPlaceholder;
    totalMinutes = parsed < 30 && parsed % 1 !== 0 ? Math.round(parsed * 60) : Math.round(parsed);
  } else {
    totalMinutes = getWorkDurationMinutes(recordOrMinutes);
  }

  if (totalMinutes <= 0) {
    return zeroPlaceholder;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}
