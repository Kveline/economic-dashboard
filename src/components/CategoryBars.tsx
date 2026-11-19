import { formatSigned } from "@/lib/format";

type Item = { name: string; value: number };

/**
 * Horizontal bars of % changes on a light track, scaled to the largest
 * absolute value, with each value in its own right-hand column. With a
 * `reference` (e.g. overall CPI) the list splits into two groups — faster and
 * slower than the reference — divided by a labelled line, so no marker has to
 * cross the bars.
 */
export function CategoryBars({ items, reference }: { items: Item[]; reference?: { value: number; label: string } }) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), reference?.value ?? 0, 0.1);
  const sorted = [...items].sort((a, b) => b.value - a.value);

  if (!reference) {
    return (
      <ul className="space-y-1">
        {sorted.map((item, i) => (
          <Row key={item.name} item={item} max={max} index={i} fill={item.value < 0 ? "bg-bad-mark" : item.value === 0 ? "bg-faint/50" : "bg-primary-mark"} />
        ))}
      </ul>
    );
  }

  const faster = sorted.filter((i) => i.value > reference.value);
  const slower = sorted.filter((i) => i.value <= reference.value);

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        <strong className="font-semibold text-ink">{faster.length}</strong> of {items.length} categories rose faster than prices overall.
      </p>
      <Group label="Faster than overall" items={faster} max={max} fill="bg-primary-mark" offset={0} />
      <div className="my-3 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="rounded-full bg-inset px-2.5 py-1 text-[11px] font-medium text-muted tabular-nums">{reference.label}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <Group label="Slower than overall" items={slower} max={max} fill="bg-soft" offset={faster.length} />
    </div>
  );
}

function Group({ label, items, max, fill, offset }: { label: string; items: Item[]; max: number; fill: string; offset: number }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 px-2 text-[11px] text-faint">{label}</p>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <Row key={item.name} item={item} max={max} index={offset + i} fill={item.value < 0 ? "bg-faint/50" : fill} />
        ))}
      </ul>
    </div>
  );
}

function Row({ item, max, index, fill }: { item: Item; max: number; index: number; fill: string }) {
  return (
    <li className="group grid grid-cols-[minmax(0,8rem)_1fr_3.25rem] items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-inset sm:grid-cols-[minmax(0,12.5rem)_1fr_3.5rem]">
      <span className="truncate text-muted transition-colors group-hover:text-ink" title={item.name}>
        {item.name}
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-chip group-hover:bg-soft/40">
        <span
          className={`animate-grow-x block h-full origin-left rounded-full ${fill}`}
          style={{ width: `${Math.max(2, (Math.abs(item.value) / max) * 100)}%`, animationDelay: `${150 + index * 50}ms` }}
        />
      </span>
      <span className="text-right text-[13px] font-medium tabular-nums">{formatSigned(item.value, "%")}</span>
    </li>
  );
}
