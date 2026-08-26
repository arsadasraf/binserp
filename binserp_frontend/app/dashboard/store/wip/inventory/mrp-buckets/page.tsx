import { redirect } from 'next/navigation';

export default function MrpBucketsRedirectPage() {
  redirect('/dashboard/store/wip/inventory/mrp');
}
