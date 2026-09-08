'use client';
import { useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { GripVertical } from 'lucide-react';

export function SortableRoutes({
  items,
  onMove,
  render,
}: {
  items: string[];
  onMove: (from: number, to: number) => void;
  render: (index: number, handle: ReactNode) => ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    from: number;
    to: number;
    y: number;
    scroll: number;
    delta: number;
    active: boolean;
    timer: ReturnType<typeof setTimeout>;
    rects: DOMRect[];
  } | null>(null);
  const [motion, setMotion] = useState<{
    from: number;
    to: number;
    delta: number;
    settling: boolean;
  } | null>(null);
  function start(e: PointerEvent, index: number) {
    if (gesture.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rects = Array.from(root.current!.children).map((el) =>
      el.getBoundingClientRect(),
    );
    const g = {
      from: index,
      to: index,
      y: e.clientY,
      scroll: window.scrollY,
      delta: 0,
      active: false,
      rects,
      timer: setTimeout(() => {
        g.active = true;
        setMotion({ from: index, to: index, delta: 0, settling: false });
      }, 200),
    };
    gesture.current = g;
  }
  function update(e: PointerEvent) {
    const g = gesture.current;
    if (!g || !g.active) return;
    e.preventDefault();
    const upper = document
      .querySelector('.top')!
      .getBoundingClientRect().bottom;
    if (e.clientY > innerHeight - 100) window.scrollBy(0, 14);
    else if (e.clientY < upper + 30) window.scrollBy(0, -14);
    g.delta = e.clientY - g.y + window.scrollY - g.scroll;
    const center = g.rects[g.from].top + g.rects[g.from].height / 2 + g.delta;
    g.to = g.from;
    g.rects.forEach((r, i) => {
      if (i > g.from && center > r.top + r.height / 2) g.to = i;
      else if (i < g.from && center < r.top + r.height / 2 && g.to === g.from)
        g.to = i;
    });
    setMotion({ from: g.from, to: g.to, delta: g.delta, settling: false });
  }
  function finish(cancel = false) {
    const g = gesture.current;
    if (!g) return;
    clearTimeout(g.timer);
    if (!g.active) {
      gesture.current = null;
      return;
    }
    const to = cancel ? g.from : g.to;
    const delta =
      to > g.from
        ? g.rects[to].bottom - g.rects[g.from].bottom
        : g.rects[to].top - g.rects[g.from].top;
    setMotion({ from: g.from, to, delta, settling: true });
    setTimeout(() => {
      if (to !== g.from) onMove(g.from, to);
      gesture.current = null;
      setMotion(null);
    }, 180);
  }
  return (
    <div ref={root} className="sortable-routes">
      {items.map((id, i) => {
        let offset = 0;
        const g = gesture.current;
        if (motion && g) {
          const step = g.rects[motion.from].height;
          if (i === motion.from) offset = motion.delta;
          else if (motion.to > motion.from && i > motion.from && i <= motion.to)
            offset = -step;
          else if (motion.to < motion.from && i >= motion.to && i < motion.from)
            offset = step;
        }
        return (
          <div
            key={id}
            className={
              'sortable-item' +
              (motion?.from === i ? ' lifted' : '') +
              (motion?.settling ? ' settling' : '')
            }
            style={{ transform: `translateY(${offset}px)` }}
          >
            {render(
              i,
              <button
                className="grip"
                aria-label="长按拖动整站"
                onPointerDown={(e) => start(e, i)}
                onPointerMove={update}
                onPointerUp={() => finish()}
                onPointerCancel={() => finish(true)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' && i > 0) {
                    e.preventDefault();
                    onMove(i, i - 1);
                  }
                  if (e.key === 'ArrowDown' && i < items.length - 1) {
                    e.preventDefault();
                    onMove(i, i + 1);
                  }
                }}
              >
                <GripVertical size={19} />
              </button>,
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SwipeCard({
  children,
  enabled,
  onRemove,
}: {
  children: ReactNode;
  enabled: boolean;
  onRemove: () => void;
}) {
  const [offset, setOffset] = useState(0),
    [moving, setMoving] = useState(false);
  const swipe = useRef<{
    x: number;
    y: number;
    initial: number;
    horizontal: boolean;
  } | null>(null);
  const ignoreClick = useRef(false);
  return (
    <div className="swipe-shell">
      <button
        className="swipe-remove"
        aria-label="从今日路线移除"
        tabIndex={offset < 0 ? 0 : -1}
        disabled={offset >= 0}
        onClick={() => {
          setOffset(0);
          onRemove();
        }}
      >
        移除
      </button>
      <div
        className={'swipe-content' + (moving ? ' swiping' : '')}
        style={{ transform: `translateX(${enabled ? offset : 0}px)` }}
        onPointerDown={(e) => {
          if (
            !enabled ||
            (e.target as HTMLElement).closest('.grip,.flag,.lock-select')
          )
            return;
          swipe.current = {
            x: e.clientX,
            y: e.clientY,
            initial: offset,
            horizontal: false,
          };
          ignoreClick.current = false;
        }}
        onPointerMove={(e) => {
          const g = swipe.current;
          if (!g) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
          if (
            !g.horizontal &&
            Math.abs(dy) > 10 &&
            Math.abs(dy) > Math.abs(dx)
          ) {
            swipe.current = null;
            return;
          }
          if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
            g.horizontal = true;
            ignoreClick.current = true;
            setMoving(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          if (g.horizontal)
            setOffset(Math.min(0, Math.max(-76, g.initial + dx)));
        }}
        onPointerUp={() => {
          if (swipe.current?.horizontal) setOffset(offset < -32 ? -76 : 0);
          swipe.current = null;
          setMoving(false);
        }}
        onPointerCancel={() => {
          swipe.current = null;
          setMoving(false);
          setOffset(0);
        }}
        onClickCapture={(e) => {
          if (ignoreClick.current || offset < 0) {
            e.preventDefault();
            e.stopPropagation();
            if (!ignoreClick.current) setOffset(0);
            ignoreClick.current = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
