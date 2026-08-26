import { redirect } from 'next/navigation';

export default function FgStockRedirectPage() {
  redirect('/dashboard/store/wip/inventory/fg');
}
