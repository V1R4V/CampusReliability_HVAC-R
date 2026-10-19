/*
 * Reorderable: a grid or list whose cards the user can drag into their own order.
 *
 * Drag starts from the grip handle that appears on hover (top-right of each card), so
 * sliders, links and buttons inside a card keep working. The order is remembered per
 * `storageKey` in localStorage; cards the saved order doesn't know about are appended
 * in their natural position. Native HTML5 drag and drop, no library.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface ReorderableItem {
  id: string;
  node: React.ReactNode;
  /** Extra classes on the wrapping <li>, e.g. `xl:col-span-2` for a full-width card. */
  className?: string;
}

export interface ReorderableProps {
  /** localStorage key; use one per page (and per tab if the set of cards differs). */
  storageKey: string;
  items: ReorderableItem[];
  /** Layout classes for the <ul>, e.g. `grid gap-4 sm:grid-cols-2`. */
  className?: string;
  itemClassName?: string;
}

const STORAGE_PREFIX = 'bib.order.';

function readOrder(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function applyOrder(items: ReorderableItem[], order: string[]): ReorderableItem[] {
  if (order.length === 0) return items;
  const rank = new Map(order.map((id, i) => [id, i] as const));
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ra = rank.get(a.item.id);
      const rb = rank.get(b.item.id);
      if (ra != null && rb != null) return ra - rb;
      if (ra != null) return -1;
      if (rb != null) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export default function Reorderable({ storageKey, items, className, itemClassName }: ReorderableProps) {
  const [order, setOrder] = useState<string[]>(() => readOrder(storageKey));
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const liRefs = useRef(new Map<string, HTMLLIElement>());

  const ordered = useMemo(() => applyOrder(items, order), [items, order]);

  useEffect(() => {
    if (order.length === 0) return;
    try {
      window.localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(order));
    } catch {
      // Storage unavailable: the order still holds for this session.
    }
  }, [order, storageKey]);

  const move = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const ids = ordered.map((i) => i.id);
      const from = ids.indexOf(fromId);
      const to = ids.indexOf(toId);
      if (from < 0 || to < 0) return;
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      setOrder(ids);
    },
    [ordered],
  );

  const endDrag = () => {
    setDragging(null);
    setOver(null);
  };

  return (
    <ul className={className}>
      {ordered.map((item) => (
        <li
          key={item.id}
          ref={(el) => {
            if (el) liRefs.current.set(item.id, el);
            else liRefs.current.delete(item.id);
          }}
          onDragOver={(event) => {
            if (!dragging) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (over !== item.id) setOver(item.id);
          }}
          onDragLeave={() => {
            if (over === item.id) setOver(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const fromId = event.dataTransfer.getData('text/plain') || dragging;
            if (fromId) move(fromId, item.id);
            endDrag();
          }}
          className={cn(
            'group/reorder relative min-w-0 rounded-[var(--c3-style-border-radius-6)] transition-shadow',
            itemClassName,
            item.className,
            dragging === item.id && 'opacity-50',
            over === item.id && dragging && dragging !== item.id && 'shadow-[0_0_0_2px_var(--bib-ink-muted)]',
          )}
        >
          <button
            type="button"
            draggable
            aria-label="Drag to reorder"
            title="Drag to reorder"
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', item.id);
              const li = liRefs.current.get(item.id);
              if (li) event.dataTransfer.setDragImage(li, 24, 24);
              setDragging(item.id);
            }}
            onDragEnd={endDrag}
            className={cn(
              'absolute right-2 top-2 z-10 inline-flex size-6 cursor-grab items-center justify-center rounded border border-[var(--bib-border)] bg-[var(--bib-surface)] text-[var(--bib-ink-muted)] opacity-0 transition-opacity',
              'group-hover/reorder:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
            )}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
          {item.node}
        </li>
      ))}
    </ul>
  );
}
