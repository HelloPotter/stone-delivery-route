import { coordinate, type Customer, type Data, makeStop } from './model.ts';
export function parseSheet(text: string): Customer[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' && !quoted) {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const h = rows.shift() || [];
  const index = (s: string) => h.findIndex((x) => x.trim() === s);
  const id = index('客户编号'),
    name = index('客户注册名称'),
    address = index('客户地址'),
    coords = index('卸货地点'),
    note = index('备注');
  if ([id, name, address, coords, note].some((i) => i < 0))
    throw Error('表格缺少必要列');
  const result: Customer[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const get = (i: number) => (row[i] || '').trim();
    const key = get(id);
    if (!key || ['A', 'B', 'C'].includes(key)) continue;
    if (seen.has(key)) throw Error('客户编号重复：' + key);
    seen.add(key);
    const loc = get(coords);
    if (loc && !coordinate(loc)) throw Error('坐标格式错误：' + key);
    if (!get(name)) throw Error('缺少客户名称：' + key);
    result.push({
      id: key,
      name: get(name),
      short: get(name),
      address: get(address),
      coords: loc,
      note: get(note),
      coordsSource: 'sheet',
    });
  }
  if (!result.length) throw Error('未找到客户');
  return result;
}
export function mergeSheet(d: Data, rows: Customer[], override = false): Data {
  const map = new Map(rows.map((c) => [c.id, c]));
  const existing = new Set(d.customers.map((c) => c.id));
  const added = rows.filter((c) => !existing.has(c.id));
  return {
    ...d,
    customers: [
      ...d.customers.map((c) => {
        const fresh = map.get(c.id);
        if (!fresh) return c;
        return {
          ...c,
          ...fresh,
          ...(c.coordsSource === 'phone' && !override
            ? { coords: c.coords, coordsSource: 'phone' as const }
            : {}),
        };
      }),
      ...added,
    ],
    template: [...d.template, ...added.map((c) => makeStop(c.id))],
  };
}
