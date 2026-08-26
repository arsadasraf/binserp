import { redirect } from 'next/navigation';

export default function RmStockRedirectPage() {
  redirect('/dashboard/store/wip/inventory/rm');
}
