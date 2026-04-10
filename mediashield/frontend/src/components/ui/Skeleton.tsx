interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  repeat?: number;
}

export function Skeleton({ className = "", style, repeat = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: repeat }).map((_, i) => (
        <div key={i} className={`neu-skeleton ${className}`} style={style} />
      ))}
    </>
  );
}

export function SkeletonCard() {
  return (
    <div className="neu-raised p-5 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr className="border-b border-[var(--neu-surface-dk)]">
      <td className="px-4 py-3"><Skeleton className="h-4 w-4 rounded-sm" /></td>
      <td className="px-4 py-3"><Skeleton className="h-10 w-10 neu-inset" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-14" /></td>
    </tr>
  );
}

export function SkeletonAssetCard() {
  return (
    <div className="neu-raised overflow-hidden">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
