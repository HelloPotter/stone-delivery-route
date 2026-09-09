'use client';
import { useEffect, useRef, useState } from 'react';
import seed from '../data/customers.json';
import { mergeSheet } from '@/lib/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SortableRoutes, SwipeCard } from '@/components/route-gestures';
import {
  blocks,
  coordinate,
  locations,
  makeStop,
  missed,
  moveBlock,
  newTask,
  previousPending,
  resetStops,
  retainSelected,
  target,
  type Customer,
  type Data,
  type Stop,
} from '@/lib/model';
import { readLocal, writeLocal, type Envelope } from '@/lib/storage';
import {
  Check,
  ChevronDown,
  LockKeyhole,
  Link2,
  Navigation,
  Plus,
  Search,
  Truck,
  Users,
  ListOrdered,
  Settings,
  Undo2,
} from 'lucide-react';
const flagKeys = ['meat', 'returns', 'cash'] as const;
const flagText = ['肉', '退', '款'];
type UI = { view: string; search: string; expanded: string; scroll: number };
export default function Home() {
  const [data, setData] = useState<Data | null>(null),
    [ui, setUI] = useState<UI>({
      view: 'route',
      search: '',
      expanded: '',
      scroll: 0,
    }),
    [clockNow, setClockNow] = useState(Date.now()),
    [sheetBusy, setSheetBusy] = useState(false),
    [locating, setLocating] = useState(false),
    [status, setStatus] = useState('正在恢复…'),
    [selected, setSelected] = useState<string[]>([]),
    [groupName, setGroupName] = useState('停一站'),
    [groupOpen, setGroupOpen] = useState(false),
    [editor, setEditor] = useState<Customer | null>(null),
    [original, setOriginal] = useState(''),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState<{
      title: string;
      text: string;
      run: () => void;
    } | null>(null),
    [conflict, setConflict] = useState(false);
  const current = useRef<Envelope | null>(null),
    ready = useRef(false),
    busy = useRef(false),
    conflicted = useRef(false),
    uiRef = useRef(ui);
  useEffect(() => {
    const t = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  uiRef.current = ui;
  function apply(e: Envelope) {
    if (e.data.customerSheetVersion !== '2026-09-08T17:19:03.353Z') {
      const updates = new Map(seed.map((c) => [c.id, c]));
      e = {
        ...e,
        pending: true,
        data: {
          ...e.data,
          customerSheetVersion: '2026-09-08T17:19:03.353Z',
          customers: e.data.customers.map((c) => {
            const fresh = updates.get(c.id);
            return fresh ? { ...c, coords: fresh.coords, note: fresh.note } : c;
          }),
        },
      };
    }
    current.current = e;
    setData(e.data);
    try {
      writeLocal(e);
    } catch {
      setStatus('本机保存失败，请勿关闭页面');
    }
  }
  function change(fn: (d: Data) => Data, remember = true) {
    if (!current.current) return;
    const e = {
      ...current.current,
      data: {
        ...fn(current.current.data),
        ...(remember
          ? { undo: (({ undo, ...rest }) => rest)(current.current.data) }
          : {}),
      },
      pending: true,
    };
    apply(e);
    setStatus('已保存到本机 · 待同步');
    void sync();
  }
  async function sync() {
    if (
      busy.current ||
      !ready.current ||
      conflicted.current ||
      !current.current
    )
      return;
    busy.current = true;
    try {
      const cloud = await fetch('/api/state', {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!cloud.ok) throw Error();
      const r = (await cloud.json()) as { data: Data | null; revision: number };
      const local = current.current;
      if (local.pending && local.revision !== r.revision) {
        conflicted.current = true;
        setConflict(true);
        setStatus('检测到其他修改，待确认');
        return;
      }
      if (!local.pending && r.data && r.revision !== local.revision) {
        apply({ data: r.data, revision: r.revision, pending: false });
        setStatus('已恢复云端记录');
        return;
      }
      if (local.pending) {
        const sent = local.data;
        const res = await fetch('/api/state', {
          method: 'PUT',
          signal: AbortSignal.timeout(10000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: sent, revision: local.revision }),
        });
        if (res.status === 409) {
          conflicted.current = true;
          setConflict(true);
          return;
        }
        if (!res.ok) throw Error();
        const ack = (await res.json()) as { revision: number };
        const next = {
          ...current.current!,
          revision: ack.revision,
          pending: current.current!.data !== sent,
        };
        apply(next);
        setStatus(
          next.pending ? '已保存到本机 · 待同步' : '已保存到本机 · 已同步云端',
        );
      } else setStatus('已保存到本机 · 已同步云端');
    } catch {
      setStatus('已保存到本机 · 联网后重试');
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    let cancelled = false;
    const local = readLocal();
    if (local) {
      apply(local);
    }
    try {
      const saved = JSON.parse(localStorage.getItem('stone-ui') || 'null');
      if (saved) {
        setUI(saved);
        setTimeout(() => window.scrollTo(0, saved.scroll || 0), 200);
      }
    } catch {}
    (async () => {
      if (!local) {
        try {
          const res = await fetch('/api/state', {
            cache: 'no-store',
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) throw Error();
          const r = (await res.json()) as {
            data: Data | null;
            revision: number;
          };
          if (cancelled) return;
          apply(
            r.data
              ? { data: r.data, revision: r.revision, pending: false }
              : {
                  data: {
                    customers: seed,
                    task: newTask(),
                    template: seed.map((c) => makeStop(c.id)),
                    last: [],
                    history: [],
                  },
                  revision: 0,
                  pending: true,
                },
          );
        } catch {
          if (cancelled) return;
          apply({
            data: {
              customers: seed,
              task: newTask(),
              template: seed.map((c) => makeStop(c.id)),
              last: [],
              history: [],
            },
            revision: 0,
            pending: true,
          });
        }
      }
      ready.current = true;
      void sync();
    })();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void sync();
    }, 30000);
    const saveUI = () => {
      try {
        localStorage.setItem(
          'stone-ui',
          JSON.stringify({ ...uiRef.current, scroll: window.scrollY }),
        );
      } catch {}
    };
    const visible = () => {
      saveUI();
      if (document.visibilityState === 'visible') void sync();
    };
    window.addEventListener('scroll', saveUI, { passive: true });
    window.addEventListener('pagehide', saveUI);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', visible);
    if ('serviceWorker' in navigator && location.hostname !== 'localhost')
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    navigator.storage?.persist?.().catch(() => {});
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('scroll', saveUI);
      window.removeEventListener('pagehide', saveUI);
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(
        'stone-ui',
        JSON.stringify({ ...ui, scroll: window.scrollY }),
      );
    } catch {}
  }, [ui]);
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const life = new AbortController();
    Promise.resolve(
      ctx.registerTool(
        {
          name: 'read_delivery_progress',
          description: 'Read the current delivery route and completed count.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () => {
            const t = current.current?.data.task;
            return {
              confirmed: t?.confirmed,
              total: t?.stops.length,
              completed: t?.stops.filter((s) => s.done).length,
            };
          },
        },
        { signal: life.signal },
      ),
    ).catch(() => {});
    return () => life.abort();
  }, []);
  function view(v: string) {
    setUI((x) => ({ ...x, view: v, search: '', expanded: '' }));
    setSelected([]);
    window.scrollTo(0, 0);
  }
  if (!data)
    return (
      <main className="shell">
        <header>
          <h1 className="wordmark">
            Stone Delivery <b>Route</b>
          </h1>
        </header>
        <section className="summary">
          <h2>正在恢复配送清单…</h2>
        </section>
      </main>
    );
  const stops = data.task.stops,
    done = stops.filter((s) => s.done).length,
    percent = stops.length ? Math.round((done / stops.length) * 100) : 0,
    hasMeat = stops.some((s) => s.meat),
    locked = data.task.confirmed,
    groups = blocks(stops),
    missing = missed(stops);
  const customer = (s: Stop) =>
    data.customers.find((c) => c.id === s.customerId)!;
  function setStops(fn: (s: Stop[]) => Stop[]) {
    change((d) => ({ ...d, task: { ...d.task, stops: fn(d.task.stops) } }));
  }
  function ask(title: string, text: string, run: () => void) {
    setConfirm({ title, text, run });
  }
  function load(mode: 'last' | 'template') {
    const src = mode === 'last' ? data!.last : data!.template;
    if (!src.length) {
      setError('还没有上次路线');
      return;
    }
    const run = () => {
      change((d) => ({
        ...d,
        task: {
          ...newTask(),
          selecting: true,
          keepIds: [],
          stops: resetStops(mode === 'last' ? d.last : d.template),
        },
      }));
      view('route');
    };
    if (stops.length)
      ask(
        '替换当前清单？',
        '当前清单将被替换；载入的路线会清除所有附加条件和送达状态。',
        run,
      );
    else run();
  }
  async function importSheet(override = false) {
    setSheetBusy(true);
    try {
      const r = await fetch('/api/customers-sheet', {
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
      const payload = (await r.json()) as {
        customers: Customer[];
        error?: string;
      };
      if (!r.ok) throw Error(payload.error);
      change((d) => mergeSheet(d, payload.customers, override));
      setError(
        '已更新 ' +
          payload.customers.length +
          ' 家客户资料' +
          (override ? '，已采用表格坐标' : '，保留手机记录的坐标'),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '同步失败，原资料保留');
    } finally {
      setSheetBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError('此浏览器不支持定位');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const coords = p.coords.latitude + ', ' + p.coords.longitude;
        const id = original;
        ask(
          '保存当前卸货位置？',
          '定位精度约 ±' +
            Math.round(p.coords.accuracy) +
            ' 米。' +
            (p.coords.accuracy > 50
              ? '当前精度较低，建议取消后移到室外重试。'
              : '') +
            '确认后替换原坐标。',
          () => {
            change((d) => ({
              ...d,
              customers: d.customers.map((c) =>
                c.id === id ? { ...c, coords, coordsSource: 'phone' } : c,
              ),
            }));
            setEditor((c) => (c ? { ...c, coords, coordsSource: 'phone' } : c));
          },
        );
      },
      () => {
        setLocating(false);
        setError('无法定位，请检查定位权限后重试；原坐标未修改');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }
  function toggleCustomer(c: Customer) {
    if (locked) {
      setError('请先在今日配送中点击“修改方案”');
      return;
    }
    setStops((s) =>
      s.some((x) => x.customerId === c.id)
        ? s.filter((x) => x.customerId !== c.id)
        : [...s, makeStop(c.id)],
    );
  }
  function navigate(s?: Stop, coords?: string) {
    const go = () => {
      const dest = s ? target(customer(s)) : coords!;
      window.location.href =
        'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent(dest) +
        '&travelmode=driving&dir_action=navigate';
    };
    const pending = s
      ? previousPending(stops, s.id)
      : stops.filter((x) => !x.done);
    if (pending.length && (!coords || coords === locations[0].coords))
      ask(
        '跳过未送达商户？',
        pending.map((x) => customer(x).name).join('、') +
          ' 尚未送达。继续导航不会将它们标记完成。',
        go,
      );
    else go();
  }
  function group() {
    if (selected.length < 2) return;
    const run = () => {
      const id = crypto.randomUUID();
      setStops((ss) => {
        const first = ss.findIndex((s) => selected.includes(s.id));
        const chosen = ss
          .filter((s) => selected.includes(s.id))
          .map((s) => ({
            ...s,
            group: id,
            groupName: groupName.trim() || '停一站',
          }));
        const touched = new Set(
          chosen
            .map((s) => ss.find((x) => x.id === s.id)?.group)
            .filter(Boolean),
        );
        const rest = ss
          .filter((s) => !selected.includes(s.id))
          .map((s) =>
            touched.has(s.group) ? { ...s, group: '', groupName: '' } : s,
          );
        rest.splice(first, 0, ...chosen);
        return rest;
      });
      setSelected([]);
      setGroupOpen(false);
    };
    run();
  }
  function move(from: number, to: number) {
    setStops((s) => moveBlock(s, from, to));
  }
  function saveCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    const c = {
      ...editor,
      id: editor.id.trim(),
      short: editor.name.trim(),
      name: editor.name.trim(),
      address: editor.address.trim(),
      coords: editor.coords.trim(),
    };
    if (!c.id || !c.name || (!c.address && !c.coords)) {
      setError('请填写编号、客户名称，以及地址或坐标');
      return;
    }
    if (c.coords && !coordinate(c.coords)) {
      setError('坐标格式不正确，例如 49.17, -123.13');
      return;
    }
    if (data!.customers.some((x) => x.id === c.id && x.id !== original)) {
      setError('客户编号已存在');
      return;
    }
    change((d) => ({
      ...d,
      customers: original
        ? d.customers.map((x) => (x.id === original ? c : x))
        : [...d.customers, c],
      template: original ? d.template : [...d.template, makeStop(c.id)],
    }));
    setEditor(null);
  }
  const flags = (s: Stop, editable: boolean) => (
    <span className="flags">
      {flagKeys.map((k, i) =>
        editable ? (
          <button
            key={k}
            className={'flag ' + k + (s[k] ? ' active' : ' inactive')}
            aria-label={['肉类', '退货', '需收款'][i]}
            aria-pressed={s[k]}
            onClick={() =>
              setStops((ss) =>
                ss.map((x) => (x.id === s.id ? { ...x, [k]: !x[k] } : x)),
              )
            }
          >
            {flagText[i]}
          </button>
        ) : s[k] ? (
          <span key={k} className={'flag ' + k}>
            {flagText[i]}
          </span>
        ) : null,
      )}
    </span>
  );
  return (
    <main className="shell">
      <div className="top">
        <header>
          <h1 className="wordmark">
            Stone Delivery <b>Route</b>
          </h1>
          <span className="date">
            {data.task.date.slice(5).replace('-', ' / ')}
          </span>
        </header>
        <section className="summary">
          <div>
            <small>{locked ? '配送进行中' : '今日配送 · 草稿'}</small>
            <h2>
              {done === stops.length && done
                ? '全部送达'
                : locked
                  ? '一路顺利'
                  : '准备出发'}
            </h2>
            <p>
              {done} / {stops.length} 家已送达
            </p>
            {data.task.startedAt ? (
              <p className="elapsed">
                已用时{' '}
                {Math.floor(
                  Math.max(0, clockNow - data.task.startedAt) / 3600000,
                )
                  .toString()
                  .padStart(2, '0')}
                :
                {(
                  Math.floor(
                    Math.max(0, clockNow - data.task.startedAt) / 60000,
                  ) % 60
                )
                  .toString()
                  .padStart(2, '0')}
              </p>
            ) : (
              locked && (
                <button
                  className="start-delivery"
                  onClick={() =>
                    change((d) => ({
                      ...d,
                      task: { ...d.task, startedAt: Date.now() },
                    }))
                  }
                >
                  开始配送
                </button>
              )
            )}
          </div>
          <strong>
            {percent}
            <em>%</em>
          </strong>
        </section>
        <p className="sync" aria-live="polite">
          {status}
        </p>
      </div>
      {ui.view === 'route' && (
        <>
          <div className="toolbar">
            <button onClick={() => view('customers')}>
              <Plus size={17} />
              选择客户
            </button>
            <button disabled={locked} onClick={() => load('last')}>
              载入上次
            </button>
            <button disabled={locked} onClick={() => load('template')}>
              完整路线
            </button>
          </div>
          <div className="sectiontitle">
            <h2>{locked ? '今日方案' : '安排顺序'}</h2>
            {!locked && stops.length > 0 && (
              <button
                className="clear-draft"
                onClick={() =>
                  ask(
                    '全部移除？',
                    '清空当前草稿中的全部商户和附加条件。客户库、上次路线和完整模板会保留。',
                    () => {
                      setStops(() => []);
                      setSelected([]);
                      setGroupOpen(false);
                      setUI((x) => ({ ...x, expanded: '' }));
                    },
                  )
                }
              >
                全部移除
              </button>
            )}
            <span>
              {groups.length} 站 · {stops.length} 家
            </span>
          </div>
          <div className="origin">
            <Truck size={17} />
            <span>公司出发{hasMeat ? ' → 211 → Lefong' : ''}</span>
          </div>
          {hasMeat && (
            <div className="factory">
              {locations.slice(1).map((l) => (
                <button
                  key={l.name}
                  onClick={() => navigate(undefined, l.coords)}
                >
                  {l.name}
                  <Navigation size={14} />
                </button>
              ))}
            </div>
          )}
          {!stops.length && (
            <div className="empty">
              <ListOrdered size={38} />
              <h3>今天，送哪几家？</h3>
              <p>选择商户，或载入已排好的路线。</p>
              <button className="primary" onClick={() => view('customers')}>
                选择配送商户
              </button>
            </div>
          )}
          {!locked && !data.task.selecting && selected.length > 0 && (
            <div className="groupbar">
              <span>已选 {selected.length} 家</span>
              <button
                disabled={selected.length < 2}
                onClick={() => {
                  setGroupName('停一站');
                  setGroupOpen(true);
                }}
              >
                合为停一站
              </button>
              <button onClick={() => setSelected([])}>取消</button>
            </div>
          )}
          {data.task.selecting && stops.length > 0 && <p className="keep-hint">点选要配送的商户：实色保留，半透明移除。</p>}
          <SortableRoutes
            items={groups.map((b) => b[0].group || b[0].id)}
            onMove={move}
            render={(bi, handle) => {
              const block = groups[bi];
              return (
                <section
                  className={'block ' + (block[0].group ? 'grouped' : '')}
                >
                  {block[0].group && (
                    <div className="grouptitle">
                      <LockKeyhole size={15} />
                      <b>{block[0].groupName}</b>
                      <span>
                        {block.filter((x) => x.done).length}/{block.length}
                      </span>
                      {!locked && !data.task.selecting && (
                        <button
                          onClick={() =>
                            setStops((ss) =>
                              ss.map((s) =>
                                s.group === block[0].group
                                  ? { ...s, group: '', groupName: '' }
                                  : s,
                              ),
                            )
                          }
                        >
                          解组
                        </button>
                      )}
                    </div>
                  )}
                  {block.map((s) => {
                    const c = customer(s);
                    return (
                      <SwipeCard
                        key={s.id}
                        enabled={!locked && !data.task.selecting}
                        onRemove={() => {
                          setStops((ss) => ss.filter((x) => x.id !== s.id));
                          setSelected((ids) => ids.filter((id) => id !== s.id));
                        }}
                      >
                        <div
                          role={data.task.selecting ? 'button' : undefined}
                          tabIndex={data.task.selecting ? 0 : undefined}
                          aria-pressed={
                            data.task.selecting
                              ? !!data.task.keepIds?.includes(s.id)
                              : undefined
                          }
                          onKeyDown={(e) => {
                            if (
                              data.task.selecting &&
                              (e.key === 'Enter' || e.key === ' ')
                            ) {
                              e.preventDefault();
                              change(
                                (d) => ({
                                  ...d,
                                  task: {
                                    ...d.task,
                                    keepIds: d.task.keepIds?.includes(s.id)
                                      ? d.task.keepIds.filter(
                                          (id) => id !== s.id,
                                        )
                                      : [...(d.task.keepIds || []), s.id],
                                  },
                                }),
                                false,
                              );
                            }
                          }}
                          onClickCapture={(e) => {
                            if (data.task.selecting) {
                              e.preventDefault();
                              e.stopPropagation();
                              change(
                                (d) => ({
                                  ...d,
                                  task: {
                                    ...d.task,
                                    keepIds: d.task.keepIds?.includes(s.id)
                                      ? d.task.keepIds.filter(
                                          (id) => id !== s.id,
                                        )
                                      : [...(d.task.keepIds || []), s.id],
                                  },
                                }),
                                false,
                              );
                            }
                          }}
                          style={
                            data.task.selecting
                              ? {
                                  opacity: data.task.keepIds?.includes(s.id)
                                    ? 1
                                    : 0.4,
                                }
                              : undefined
                          }
                          className={
                            'cardwrap ' +
                            (s.done ? 'delivered ' : '') +
                            (missing.includes(s.id) ? 'missed' : '')
                          }
                        >
                          <div className="card">
                            {!locked && !data.task.selecting ? (
                              <button
                                className={
                                  'lock-select' +
                                  (selected.includes(s.id) ? ' chosen' : '')
                                }
                                aria-label={'加入停一站分组：' + c.name}
                                aria-pressed={selected.includes(s.id)}
                                onClick={() =>
                                  setSelected((x) =>
                                    x.includes(s.id)
                                      ? x.filter((y) => y !== s.id)
                                      : [...x, s.id],
                                  )
                                }
                              >
                                <Link2 size={15} />
                              </button>
                            ) : (
                              <span className="number">
                                {s.done ? (
                                  <Check size={19} />
                                ) : (
                                  stops.indexOf(s) + 1
                                )}
                              </span>
                            )}
                            <button
                              className="name"
                              onClick={() =>
                                setUI((x) => ({
                                  ...x,
                                  expanded: x.expanded === s.id ? '' : s.id,
                                }))
                              }
                            >
                              <strong>{c.name}</strong>
                              <small>
                                {c.id}
                                {c.note && (
                                  <span className="customer-note">
                                    {' '}
                                    · {c.note}
                                  </span>
                                )}
                                {missing.includes(s.id)
                                  ? ' · 可能漏送'
                                  : s.done
                                    ? ' · 已送达'
                                    : ''}
                              </small>
                            </button>
                            {flags(s, !locked)}
                            {locked ? (
                              <button
                                className="icon"
                                aria-label="展开"
                                onClick={() =>
                                  setUI((x) => ({
                                    ...x,
                                    expanded: x.expanded === s.id ? '' : s.id,
                                  }))
                                }
                              >
                                <ChevronDown size={18} />
                              </button>
                            ) : data.task.selecting ? null : (
                              handle
                            )}
                          </div>
                          {ui.expanded === s.id && (
                            <div className="actions">
                              <button onClick={() => navigate(s)}>
                                <Navigation size={16} />
                                导航
                              </button>
                              <button
                                disabled={!locked}
                                onClick={() =>
                                  setStops((ss) =>
                                    ss.map((x) =>
                                      x.id === s.id
                                        ? { ...x, done: !x.done }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                {s.done ? (
                                  <Undo2 size={16} />
                                ) : (
                                  <Check size={16} />
                                )}{' '}
                                {s.done ? '撤销送达' : '标记送达'}
                              </button>
                            </div>
                          )}
                        </div>
                      </SwipeCard>
                    );
                  })}
                </section>
              );
            }}
          />
          {data.task.selecting && stops.length > 0 && (
            <div className="keep-bar keep-bottom">
              <button onClick={()=>change(d=>({...d,task:{...d.task,stops:retainSelected(d.task.stops,d.task.stops.map(s=>s.id)),selecting:false,keepIds:[]}}))}>全部保留</button>
              <button
                className="primary"
                onClick={() =>
                  ask(
                    '保留所选商户？',
                    '未选商户会从今日草稿移除，模板保持不变。',
                    () =>
                      change((d) => ({
                        ...d,
                        task: {
                          ...d.task,
                          stops: retainSelected(d.task.stops,d.task.keepIds||[]),
                          selecting: false,
                          keepIds: [],
                        },
                      })),
                  )
                }
              >
                保留所选（{data.task.keepIds?.length || 0}）
              </button>
            </div>
          )}
          {stops.length > 0 && (
            <>
              <button
                className="return"
                onClick={() => navigate(undefined, locations[0].coords)}
              >
                <Navigation size={16} />
                返回公司
              </button>
              <div
                className="bottomactions"
                style={data.task.selecting ? { display: 'none' } : undefined}
              >
                {locked ? (
                  <>
                    <button
                      onClick={() =>
                        change((d) => ({
                          ...d,
                          task: { ...d.task, confirmed: false },
                        }))
                      }
                    >
                      修改方案
                    </button>
                    <button
                      className="primary"
                      onClick={() =>
                        ask(
                          '结束当天任务？',
                          `${stops.length - done} 家尚未送达。结束后归档当前方案，并进入新的空白任务。`,
                          () => {
                            change((d) => ({
                              ...d,
                              last: d.task.stops,
                              history: [
                                ...d.history,
                                {
                                  date: d.task.date,
                                  stops: d.task.stops,
                                  startedAt: d.task.startedAt,
                                  endedAt: Date.now(),
                                },
                              ],
                              task: newTask(),
                            }));
                            setSelected([]);
                            setUI((x) => ({ ...x, expanded: '' }));
                          },
                        )
                      }
                    >
                      结束当天任务
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        ask(
                          '更新完整路线模板？',
                          '保留当前排列，未选客户将按原模板顺序追加到末尾。',
                          () =>
                            change((d) => ({
                              ...d,
                              template: resetStops([
                                ...d.task.stops,
                                ...d.template.filter(
                                  (s) =>
                                    !d.task.stops.some(
                                      (t) => t.customerId === s.customerId,
                                    ),
                                ),
                              ]),
                            })),
                        )
                      }
                    >
                      保存完整模板
                    </button>
                    <button
                      className="primary"
                      onClick={() => {
                        change((d) => ({
                          ...d,
                          task: { ...d.task, confirmed: true },
                          last: d.task.stops,
                        }));
                        setSelected([]);
                      }}
                    >
                      确认方案
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
      {ui.view === 'customers' && (
        <>
          <div className="sectiontitle">
            <h2>客户库</h2>
            <button
              onClick={() => {
                setOriginal('');
                setEditor({
                  id: '',
                  short: '',
                  name: '',
                  address: '',
                  coords: '',
                  note: '',
                });
              }}
            >
              <Plus size={17} />
              新增
            </button>
          </div>
          <div className="search">
            <Search size={18} />
            <input
              placeholder="搜索客户名称或编号"
              value={ui.search}
              onChange={(e) => setUI((x) => ({ ...x, search: e.target.value }))}
            />
          </div>
          {data.customers
            .filter((c) =>
              `${c.id} ${c.name}`
                .toLowerCase()
                .includes(ui.search.toLowerCase()),
            )
            .map((c) => {
              const s = stops.find((s) => s.customerId === c.id);
              return (
                <div className="card" key={c.id}>
                  <Checkbox
                    disabled={locked}
                    checked={!!s}
                    onCheckedChange={() => toggleCustomer(c)}
                    aria-label={'配送' + c.name}
                  />
                  <button className="name" onClick={() => toggleCustomer(c)}>
                    <strong>{c.name}</strong>
                    <small>
                      {c.id}
                      {c.note && (
                        <span className="customer-note"> · {c.note}</span>
                      )}
                    </small>
                  </button>
                  {s && flags(s, !locked)}
                  <button
                    className="textbutton"
                    onClick={() => {
                      setOriginal(c.id);
                      setEditor(c);
                    }}
                  >
                    编辑
                  </button>
                </div>
              );
            })}
          <button className="primary full" onClick={() => view('route')}>
            返回清单 · 已选 {stops.length} 家
          </button>
        </>
      )}
      {ui.view === 'settings' && (
        <>
          <div className="sectiontitle">
            <h2>设置与记录 · 2.0</h2>
          </div>
          <div className="setting">
            <h3>客户资料更新</h3>
            <p>从 Google Sheet 更新资料，默认保留手机记录坐标。</p>
            <button disabled={sheetBusy} onClick={() => void importSheet()}>
              {sheetBusy ? '正在同步…' : '一键更新客户资料'}
            </button>
            <button
              disabled={sheetBusy}
              onClick={() =>
                ask(
                  '用表格坐标覆盖？',
                  '这将替换手机记录的卸货坐标，可在设置中撤销。',
                  () => void importSheet(true),
                )
              }
            >
              用表格坐标覆盖
            </button>
          </div>
          <div className="setting">
            <h3>撤销操作</h3>
            <p>
              恢复最近一次操作前的数据，包括清空、筛选、送达、定位及资料同步。
            </p>
            <button
              disabled={!data.undo}
              onClick={() =>
                ask('撤销最近一次操作？', '将恢复上次操作之前的记录。', () => {
                  change(
                    (d) => (d.undo ? { ...d.undo, undo: undefined } : d),
                    false,
                  );
                  setSelected([]);
                  setEditor(null);
                })
              }
            >
              撤销最近一次操作
            </button>
          </div>
          <div className="setting">
            <h3>路线服务</h3>
            <p>
              当前使用手动排序与逐站导航。Google
              自动排序和里程预测将在接入路线服务后启用。
            </p>
          </div>
          <div className="setting">
            <h3>固定取货顺序</h3>
            {locations.map((l) => (
              <p key={l.name}>
                <b>{l.name}</b>
                <br />
                <small>{l.coords}</small>
              </p>
            ))}
          </div>
          <div className="setting">
            <h3>数据保存</h3>
            <p>{status}</p>
            <button onClick={() => void sync()}>立即同步</button>
            <button
              onClick={() => {
                const blob = new Blob(
                  [JSON.stringify(current.current!.data, null, 2)],
                  { type: 'application/json' },
                );
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'stone-delivery-backup.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              }}
            >
              下载备份
            </button>
          </div>
          <div className="setting">
            <h3>恢复备份</h3>
            <input
              aria-label="选择备份文件"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const d = JSON.parse(await f.text()) as Data;
                  if (
                    !Array.isArray(d.customers) ||
                    !Array.isArray(d.task?.stops) ||
                    !Array.isArray(d.template) ||
                    !Array.isArray(d.last) ||
                    !Array.isArray(d.history) ||
                    d.customers.some((c) => !c.id || !c.name) ||
                    d.task.stops.some(
                      (s) => !d.customers.some((c) => c.id === s.customerId),
                    )
                  )
                    throw Error();
                  ask(
                    '恢复这份备份？',
                    '将替换当前客户库、路线与记录，并同步云端。',
                    () => change(() => d),
                  );
                } catch {
                  setError('备份格式不正确，未修改现有数据');
                }
                e.target.value = '';
              }}
            />
          </div>
          <div className="setting">
            <h3>已结束任务</h3>
            {data.history.length ? (
              data.history
                .slice()
                .reverse()
                .map((h, i) => (
                  <p key={i}>
                    {h.date}　{h.stops.filter((s) => s.done).length} /{' '}
                    {h.stops.length} 家已送达
                  </p>
                ))
            ) : (
              <p>尚无已结束任务</p>
            )}
          </div>
          <div className="setting">
            <h3>添加到主屏幕</h3>
            <p>
              在 iPhone Safari
              的分享菜单中选择“添加到主屏幕”。以后从同一个图标进入，继续配送。
            </p>
          </div>
        </>
      )}
      <nav className="nav">
        <button
          className={ui.view === 'route' ? 'active' : ''}
          onClick={() => view('route')}
        >
          <ListOrdered size={21} />
          今日配送
        </button>
        <button
          className={ui.view === 'customers' ? 'active' : ''}
          onClick={() => view('customers')}
        >
          <Users size={21} />
          客户库
        </button>
        <button
          className={ui.view === 'settings' ? 'active' : ''}
          onClick={() => view('settings')}
        >
          <Settings size={21} />
          设置
        </button>
      </nav>
      <Dialog
        open={!!editor}
        onOpenChange={(o) => {
          if (!o) setEditor(null);
        }}
      >
        <DialogContent className="modal">
          <DialogTitle>{original ? '编辑客户' : '新增客户'}</DialogTitle>
          <DialogDescription>
            保存后自动同步，断网时先保存在本机。
          </DialogDescription>
          {editor && (
            <form onSubmit={saveCustomer}>
              {original && (
                <button type="button" disabled={locating} onClick={locate}>
                  {locating ? '正在定位…' : '记录当前卸货位置'}
                </button>
              )}
              {(['id', 'name', 'address', 'coords', 'note'] as const).map(
                (k, i) => (
                  <label key={k}>
                    {
                      [
                        '客户编号',
                        '客户全称',
                        '客户地址',
                        '卸货坐标（可选）',
                        '备注',
                      ][i]
                    }
                    <input
                      disabled={k === 'id' && !!original}
                      required={k === 'id' || k === 'name'}
                      value={editor[k]}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          [k]: e.target.value,
                          ...(k === 'coords'
                            ? { coordsSource: 'phone' as const }
                            : {}),
                        })
                      }
                      placeholder={k === 'coords' ? '49.17, -123.13' : ''}
                    />
                  </label>
                ),
              )}
              <button className="primary full" type="submit">
                保存客户
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="modal">
          <DialogTitle>合为停一站</DialogTitle>
          <DialogDescription>
            选中的客户将按当前顺序合并，整站一起移动。
          </DialogDescription>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <button className="primary" onClick={group}>
            保存分组
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      >
        <DialogContent className="modal">
          <DialogTitle>{confirm?.title}</DialogTitle>
          <DialogDescription>{confirm?.text}</DialogDescription>
          <button
            className="primary"
            onClick={() => {
              const run = confirm?.run;
              setConfirm(null);
              run?.();
            }}
          >
            确认继续
          </button>
          <button onClick={() => setConfirm(null)}>取消</button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!error}
        onOpenChange={(o) => {
          if (!o) setError('');
        }}
      >
        <DialogContent className="modal">
          <DialogTitle>请检查</DialogTitle>
          <DialogDescription>{error}</DialogDescription>
          <button onClick={() => setError('')}>知道了</button>
        </DialogContent>
      </Dialog>
      <Dialog open={conflict} onOpenChange={() => {}}>
        <DialogContent className="modal" showCloseButton={false}>
          <DialogTitle>发现另一份更新</DialogTitle>
          <DialogDescription>
            本机与云端都发生了修改。请选择保留哪一份，避免覆盖进度。
          </DialogDescription>
          <button
            onClick={async () => {
              try {
                const r = await fetch('/api/state', {
                  cache: 'no-store',
                  signal: AbortSignal.timeout(10000),
                });
                if (!r.ok) throw Error();
                const c = (await r.json()) as {
                  data: Data | null;
                  revision: number;
                };
                if (c.data)
                  apply({ data: c.data, revision: c.revision, pending: false });
                conflicted.current = false;
                setConflict(false);
                void sync();
              } catch {
                setError('暂时无法读取云端，请联网后重试');
              }
            }}
          >
            使用云端版本
          </button>
          <button
            className="primary"
            onClick={async () => {
              try {
                const r = await fetch('/api/state', {
                  cache: 'no-store',
                  signal: AbortSignal.timeout(10000),
                });
                if (!r.ok) throw Error();
                const c = (await r.json()) as {
                  data: Data | null;
                  revision: number;
                };
                apply({
                  ...current.current!,
                  revision: c.revision,
                  pending: true,
                });
                conflicted.current = false;
                setConflict(false);
                void sync();
              } catch {
                setError('暂时无法同步，请联网后重试');
              }
            }}
          >
            保留本机并同步
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
