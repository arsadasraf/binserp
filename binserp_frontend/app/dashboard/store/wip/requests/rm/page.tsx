import { redirect } from 'next/navigation';

export default function RmRequestsPage() {
  redirect('/dashboard/store/wip/requests/all?types=rm');
}
