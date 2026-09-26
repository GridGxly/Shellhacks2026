import { tavernRequest } from '@/lib/server/tavern';

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  return tavernRequest(request, 'audio', (await params).code);
}
