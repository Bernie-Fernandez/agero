import { redirect } from 'next/navigation';

// Clerk handles sign-out via its own mechanisms.
// This route is a fallback redirect to the login page.
export async function POST() {
  redirect('/portal/login');
}

export async function GET() {
  redirect('/portal/login');
}
