import { redirect } from 'next/navigation';

// This page now acts as a redirect to the first child page in the menu.
export default function ApiProxyPage() {
  redirect('/api-proxy/github');
}
