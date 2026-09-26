import { tavernRequest } from '@/lib/server/tavern';

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  return tavernRequest(request, 'done', (await params).code);
}
