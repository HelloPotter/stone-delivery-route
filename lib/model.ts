export type Customer = {
  id: string;
  short: string;
  name: string;
  address: string;
  coords: string;
  note: string;
  coordsSource?: 'phone' | 'sheet';
};
export type Stop = {
  id: string;
  customerId: string;
  meat: boolean;
  returns: boolean;
  cash: boolean;
  done: boolean;
  group: string;
  groupName: string;
};
export type Task = {
  id: string;
  date: string;
  confirmed: boolean;
  stops: Stop[];
  startedAt?: number;
  selecting?: boolean;
  keepIds?: string[];
};
export type Data = {
  undo?: Omit<Data, 'undo'>;
  customerSheetVersion?: string;
  customers: Customer[];
  task: Task;
  template: Stop[];
  last: Stop[];
  history: {
    date: string;
    stops: Stop[];
    startedAt?: number;
    endedAt?: number;
  }[];
};
export const locations = [
  { name: '公司', coords: '49.16156230599801, -122.96131901745241' },
  { name: '211 肉厂', coords: '49.16051109260114, -122.96235143803088' },
  { name: 'Lefong 肉厂', coords: '49.16853107341961, -122.98640260871574' },
];
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function newTask(): Task {
  return {
    id: crypto.randomUUID(),
    date: today(),
    confirmed: false,
    stops: [],
  };
}
export function makeStop(id: string): Stop {
  return {
    id: crypto.randomUUID(),
    customerId: id,
    meat: false,
    returns: false,
    cash: false,
    done: false,
    group: '',
    groupName: '',
  };
}
export function resetStops(stops: Stop[]) {
  return stops.map((s) => ({
    ...s,
    id: crypto.randomUUID(),
    meat: false,
    returns: false,
    cash: false,
    done: false,
  }));
}
export function blocks(stops: Stop[]) {
  const result: Stop[][] = [];
  for (const s of stops) {
    if (s.group && result.at(-1)?.[0].group === s.group) result.at(-1)!.push(s);
    else result.push([s]);
  }
  return result;
}
export function moveBlock(stops: Stop[], from: number, to: number) {
  const b = blocks(stops);
  if (from < 0 || to < 0 || from >= b.length || to >= b.length) return stops;
  const [item] = b.splice(from, 1);
  b.splice(to, 0, item);
  return b.flat();
}
export function missed(stops: Stop[]) {
  let last = -1;
  stops.forEach((s, i) => {
    if (s.done) last = i;
  });
  return stops.filter((s, i) => !s.done && i < last).map((s) => s.id);
}
export function previousPending(stops: Stop[], id: string) {
  const at = stops.findIndex((s) => s.id === id);
  const current = stops[at];
  return stops
    .slice(0, at)
    .filter((s) => !s.done && (!current?.group || s.group !== current.group));
}
export function coordinate(value: string): string | null {
  const plain = value
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (plain) {
    const a = Number(plain[1]),
      b = Number(plain[2]);
    return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? `${a},${b}` : null;
  }
  const d = value.match(
    /(\d+)°\s*(\d+)'\s*([\d.]+)"?\s*([NS])\s+(\d+)°\s*(\d+)'\s*([\d.]+)"?\s*([EW])/i,
  );
  if (d) {
    const a =
        (+d[1] + +d[2] / 60 + +d[3] / 3600) *
        (d[4].toUpperCase() === 'S' ? -1 : 1),
      b =
        (+d[5] + +d[6] / 60 + +d[7] / 3600) *
        (d[8].toUpperCase() === 'W' ? -1 : 1);
    return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? `${a},${b}` : null;
  }
  return null;
}
export function target(c: Customer) {
  return (
    coordinate(c.coords) ||
    (/[a-z]+,?\s*BC/i.test(c.address)
      ? c.address
      : `${c.address}, Richmond, BC, Canada`)
  );
}

export function retainSelected(stops:Stop[],ids:string[]):Stop[]{const kept=stops.filter(s=>ids.includes(s.id));const counts=new Map<string,number>();for(const s of kept)if(s.group)counts.set(s.group,(counts.get(s.group)||0)+1);return kept.map(s=>s.group&&counts.get(s.group)===1?{...s,group:'',groupName:''}:s)}
