import { currentUser, publicUser } from '@/lib/db';
import { handled } from '@/lib/server/http';

export async function GET() {
  return handled(async () => {
    const u = await currentUser();
    return Response.json(u ? publicUser(u) : null);
  });
}
