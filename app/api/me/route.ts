import { guarded } from '@/lib/server/api-guard';
import { currentUser, publicUser } from '@/lib/db';

export async function GET(request: Request) {
  return guarded(request, async () => {
    const u = await currentUser();
    return Response.json(u ? publicUser(u) : null);
  });
}
