import { redirect } from 'next/navigation';

export default function BoStockRedirectPage() {
  redirect('/dashboard/store/wip/inventory/bo');
}
