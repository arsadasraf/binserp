import { redirect } from 'next/navigation';

export default function BoRequestsPage() {
  redirect('/dashboard/store/wip/requests/all?types=bo');
}
