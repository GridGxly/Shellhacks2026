import { trainingRequest } from '@/lib/server/training';

export async function POST(request: Request) { return trainingRequest(request, 'pause'); }
