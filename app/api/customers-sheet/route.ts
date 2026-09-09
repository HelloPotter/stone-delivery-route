import { parseSheet } from '@/lib/sheet';
export async function GET() {
  try {
    const r = await fetch(
      'https://docs.google.com/spreadsheets/d/1adnb9e1pGdQ6LQE1Ou2GmPLg_aCMDHBFf32AFsNKhN8/gviz/tq?tqx=out:csv',
      { cache: 'no-store', signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok) throw Error('暂时无法读取表格');
    const customers = parseSheet(await r.text());
    return Response.json(
      { customers },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : '同步失败' },
      { status: 502 },
    );
  }
}
