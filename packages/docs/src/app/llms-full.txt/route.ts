import { getRawContent } from '@/lib/content';

export const dynamic = 'force-static';

export function GET() {
  return new Response(getRawContent());
}
