import { redirect } from 'next/navigation';

export default function WipRequestsIndexPage() {
  redirect('/dashboard/store/wip/requests/all');
}
