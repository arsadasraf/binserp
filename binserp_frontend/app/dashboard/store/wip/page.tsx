import { redirect } from 'next/navigation';

export default function WipPage() {
  redirect('/dashboard/store/wip/requests');
}
