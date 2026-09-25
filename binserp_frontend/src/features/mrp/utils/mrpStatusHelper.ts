/**
 * Helper to compute dynamic lock status and transaction restrictions for MRP Plans
 */
export function calculateMRPLockStatus(plan: any, currentTime: number = Date.now(), policyHours: number = 24) {
  const createdAtMs = new Date(plan.createdAt || Date.now()).getTime();
  const isUnlimited = policyHours === -1;
  const isImmediatelyLocked = policyHours <= 0;

  let remainingMs = 0;
  let isExpired = false;
  let countdownText = '';

  if (isUnlimited) {
    remainingMs = Infinity;
    isExpired = false;
    countdownText = 'Unlimited';
  } else if (isImmediatelyLocked) {
    remainingMs = 0;
    isExpired = true;
    countdownText = 'Locked';
  } else {
    remainingMs = Math.max(0, (createdAtMs + policyHours * 3600 * 1000) - currentTime);
    isExpired = remainingMs <= 0;
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    countdownText = `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s left`;
  }

  const hasTransactions = Boolean(
    plan.hasTransactions || 
    (plan.linkedPOCount && plan.linkedPOCount > 0) || 
    (plan.rmRequirements || []).some((r: any) => r.status === 'PO Raised' || (r.orderedQuantity && r.orderedQuantity > 0) || (r.receivedQuantity && r.receivedQuantity > 0)) ||
    (plan.boRequirements || []).some((b: any) => b.status === 'PO Raised' || (b.orderedQuantity && b.orderedQuantity > 0) || (b.receivedQuantity && b.receivedQuantity > 0)) ||
    (plan.fgItems || []).some((f: any) => f.receivedQuantity && f.receivedQuantity > 0) ||
    plan.status !== 'Planned' || 
    plan.ppcStatus === 'Sent'
  );

  const canEdit = !isExpired && !hasTransactions;
  const canDelete = !isExpired && !hasTransactions;

  return {
    remainingMs,
    is24hExpired: isExpired,
    countdownText,
    hasTransactions,
    canEdit,
    canDelete,
    linkedPOCount: plan.linkedPOCount || 0
  };
}
