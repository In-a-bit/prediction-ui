export default function PlaeEventLoading() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="animate-pulse rounded-2xl border border-card-border bg-card p-6">
          <div className="mb-4 flex items-start gap-4">
            <div className="h-16 w-16 rounded-xl bg-card-border" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-3/4 rounded bg-card-border" />
              <div className="h-4 w-1/2 rounded bg-card-border" />
            </div>
          </div>
          <div className="flex gap-4 border-t border-card-border pt-4">
            <div className="h-8 w-16 rounded bg-card-border" />
            <div className="h-8 w-16 rounded bg-card-border" />
          </div>
        </div>

        <div className="animate-pulse rounded-2xl border border-card-border bg-card p-6">
          <div className="mb-4 h-4 w-24 rounded bg-card-border" />
          <div className="h-64 rounded-xl bg-card-border" />
        </div>

        <div className="animate-pulse rounded-2xl border border-card-border bg-card p-6">
          <div className="mb-4 h-4 w-20 rounded bg-card-border" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-6 rounded bg-card-border" />
            ))}
          </div>
        </div>
      </div>

      <div className="animate-pulse rounded-2xl border border-card-border bg-card p-6">
        <div className="mb-6 h-10 rounded-xl bg-card-border" />
        <div className="space-y-4">
          <div className="h-12 rounded-xl bg-card-border" />
          <div className="h-12 rounded-xl bg-card-border" />
          <div className="h-12 rounded-xl bg-card-border" />
        </div>
      </div>
    </div>
  );
}
