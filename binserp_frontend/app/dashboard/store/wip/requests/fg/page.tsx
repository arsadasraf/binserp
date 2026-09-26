import { redirect } from 'next/navigation';

export default function FgRequestsPage() {
  redirect('/dashboard/store/wip/requests/all?types=fg');
}
