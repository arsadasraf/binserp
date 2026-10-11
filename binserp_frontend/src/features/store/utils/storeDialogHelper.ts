import Swal from 'sweetalert2';

/**
 * Returns dark-mode aware default styling options for SweetAlert2
 */
function getBaseSwalOptions() {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return {
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    customClass: {
      popup: 'rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 font-sans p-5 sm:p-6',
      title: 'text-base sm:text-lg font-bold text-slate-900 dark:text-white',
      htmlContainer: 'text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2',
      confirmButton: 'px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-xs cursor-pointer transition-all active:scale-95',
      cancelButton: 'px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-xs cursor-pointer transition-all active:scale-95'
    },
    buttonsStyling: true,
  };
}

export type DestructiveConfirmOptions = {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
};

/**
 * Destructive Confirmation Dialog (e.g. Deleting Records, Cancelling Orders)
 * Accepts either an options object or positional arguments.
 */
export async function showDestructiveConfirm(
  titleOrOptions: string | DestructiveConfirmOptions,
  text?: string,
  confirmButtonText?: string
): Promise<boolean> {
  let title = '';
  let msg = '';
  let btnText = 'Yes, Delete';
  let cancelText = 'Cancel';

  if (typeof titleOrOptions === 'object' && titleOrOptions !== null) {
    title = titleOrOptions.title;
    msg = titleOrOptions.text || '';
    btnText = titleOrOptions.confirmButtonText || 'Yes, Delete';
    cancelText = titleOrOptions.cancelButtonText || 'Cancel';
  } else {
    title = titleOrOptions;
    msg = text || '';
    btnText = confirmButtonText || 'Yes, Delete';
  }

  const base = getBaseSwalOptions();
  const result = await Swal.fire({
    ...base,
    title,
    text: msg,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48', // Rose 600
    cancelButtonColor: '#64748b',  // Slate 500
    confirmButtonText: btnText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true
  } as any);
  return Boolean(result.isConfirmed);
}

export type ConfirmDialogOptions = {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  icon?: 'question' | 'info' | 'warning';
  confirmButtonColor?: string;
};

/**
 * Standard Action Confirmation Dialog (e.g. Planning, Approvals, Imports)
 * Accepts either an options object or positional arguments.
 */
export async function showConfirmDialog(
  titleOrOptions: string | ConfirmDialogOptions,
  text?: string,
  confirmButtonText?: string,
  cancelButtonText?: string,
  icon?: 'question' | 'info' | 'warning'
): Promise<boolean> {
  let title = '';
  let msg = '';
  let btnText = 'Confirm';
  let cancelText = 'Cancel';
  let iconType: 'question' | 'info' | 'warning' = 'question';
  let btnColor = '#4f46e5';

  if (typeof titleOrOptions === 'object' && titleOrOptions !== null) {
    title = titleOrOptions.title;
    msg = titleOrOptions.text || '';
    btnText = titleOrOptions.confirmButtonText || 'Confirm';
    cancelText = titleOrOptions.cancelButtonText || 'Cancel';
    iconType = titleOrOptions.icon || 'question';
    btnColor = titleOrOptions.confirmButtonColor || '#4f46e5';
  } else {
    title = titleOrOptions;
    msg = text || '';
    btnText = confirmButtonText || 'Confirm';
    cancelText = cancelButtonText || 'Cancel';
    iconType = icon || 'question';
  }

  const base = getBaseSwalOptions();
  const result = await Swal.fire({
    ...base,
    title,
    text: msg,
    icon: iconType,
    showCancelButton: true,
    confirmButtonColor: btnColor,
    cancelButtonColor: '#64748b',  // Slate 500
    confirmButtonText: btnText,
    cancelButtonText: cancelText,
    reverseButtons: true
  } as any);
  return Boolean(result.isConfirmed);
}

/**
 * Deactivate Fallback Dialog
 * Used when an item cannot be deleted because of foreign key / transaction dependencies
 */
export async function showDeactivatePrompt(options: {
  itemName: string;
  errorMessage?: string;
}): Promise<boolean> {
  const base = getBaseSwalOptions();
  const { itemName, errorMessage } = options;
  const description = errorMessage
    ? `${errorMessage}\n\nWould you like to DEACTIVATE this item instead? Deactivated items will be archived and hidden from new transactions.`
    : `This item is linked to inventory, orders, or transactions and cannot be permanently deleted.\n\nWould you like to DEACTIVATE "${itemName}" instead?`;

  const result = await Swal.fire({
    ...base,
    title: `Unable to Delete ${itemName}`,
    text: description,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d97706', // Amber 600
    cancelButtonColor: '#64748b',  // Slate 500
    confirmButtonText: 'Deactivate Item',
    cancelButtonText: 'Keep As Is',
    reverseButtons: true
  } as any);
  return Boolean(result.isConfirmed);
}

/**
 * Warning Dialog (e.g. 24h Lockouts, Missing Required Fields, Permissions)
 */
export async function showWarningDialog(title: string, text: string): Promise<void> {
  const base = getBaseSwalOptions();
  await Swal.fire({
    ...base,
    title,
    text,
    icon: 'warning',
    confirmButtonColor: '#4f46e5',
    confirmButtonText: 'Understood'
  } as any);
}

/**
 * Error Dialog (e.g. Server Failure, PDF Failure, Validation Rejections)
 */
export async function showErrorDialog(title: string, text: string): Promise<void> {
  const base = getBaseSwalOptions();
  await Swal.fire({
    ...base,
    title,
    text,
    icon: 'error',
    confirmButtonColor: '#e11d48',
    confirmButtonText: 'Dismiss'
  } as any);
}

/**
 * Informational Dialog (e.g. E-Way Bill Notice, Instructions)
 */
export async function showInfoDialog(title: string, text: string): Promise<void> {
  const base = getBaseSwalOptions();
  await Swal.fire({
    ...base,
    title,
    text,
    icon: 'info',
    confirmButtonColor: '#4f46e5',
    confirmButtonText: 'OK'
  } as any);
}

/**
 * Success Dialog (Modal with OK button)
 */
export async function showSuccessDialog(title: string, text: string): Promise<void> {
  const base = getBaseSwalOptions();
  await Swal.fire({
    ...base,
    title,
    text,
    icon: 'success',
    confirmButtonColor: '#10b981', // Emerald 500
    confirmButtonText: 'Great'
  } as any);
}

/**
 * Top-Right Auto-Dismissing Toast for Success Notifications
 */
export function showSuccessToast(message: string, durationMs: number = 2500): void {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: durationMs,
    timerProgressBar: true,
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    }
  });

  Toast.fire({
    icon: 'success',
    title: message
  });
}

/**
 * Top-Right Auto-Dismissing Toast for Warning Notifications
 */
export function showWarningToast(message: string, durationMs: number = 3000): void {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: durationMs,
    timerProgressBar: true,
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a'
  });

  Toast.fire({
    icon: 'warning',
    title: message
  });
}

/**
 * Top-Right Auto-Dismissing Toast for Error Notifications
 */
export function showErrorToast(message: string, durationMs: number = 3500): void {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: durationMs,
    timerProgressBar: true,
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a'
  });

  Toast.fire({
    icon: 'error',
    title: message
  });
}
