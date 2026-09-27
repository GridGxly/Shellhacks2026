import { trainingRequest } from '@/lib/server/training';

export async function GET(request: Request) { return trainingRequest(request, 'profile'); }
