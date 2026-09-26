import { redirect } from 'next/navigation';

export default function ConsumablesRequestsPage() {
  redirect('/dashboard/store/wip/requests/all?types=consumable');
}
