import { tavernRequest } from '@/lib/server/tavern';

export async function POST(request: Request) {
  return tavernRequest(request, 'host');
}
