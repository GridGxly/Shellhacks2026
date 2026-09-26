import { currentUser, publicUser } from '@/lib/db';

export async function GET() {
  const u = await currentUser().catch(() => null);
  if (!u) return Response.json(null);
  return Response.json(publicUser(u));
}
