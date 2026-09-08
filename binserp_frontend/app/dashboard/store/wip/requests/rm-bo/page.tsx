import { redirect } from 'next/navigation';

export default function RmBoLegacyRedirectPage() {
  redirect('/dashboard/store/wip/requests/rm');
}
