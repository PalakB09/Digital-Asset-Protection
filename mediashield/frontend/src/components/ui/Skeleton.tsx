interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  repeat?: number;
}

export function Skeleton({ className = "", style, repeat = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: repeat }).map((_, i) => (
        <div key={i} className={`eg-skeleton ${className}`} style={style} />
      ))}
    </>
  );
}

export function SkeletonCard() {
  return (
    <div className="eg-card p-5 space-y-3">
      <Skeleton className="h-3 w-20 rounded" />
      <Skeleton className="h-7 w-16 rounded" />
      <Skeleton className="h-3 w-28 rounded" />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr>
      <td className="px-4 py-3"><Skeleton className="h-4 w-4 rounded" /></td>
      <td className="px-4 py-3"><Skeleton className="h-10 w-10 rounded-lg" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-32 rounded" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-16 rounded" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-20 rounded" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-14 rounded" /></td>
    </tr>
  );
}

export function SkeletonAssetCard() {
  return (
    <div
      className="overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
      }}
    >
      <Skeleton className="aspect-video w-full rounded-none" style={{ borderRadius: 0 }} />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
