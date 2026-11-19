export default function Loading() {
  const block = "animate-pulse rounded-[20px] bg-card shadow-card";
  return (
    <div className="min-h-screen bg-page" aria-busy="true" aria-label="Loading">
      <div className="mx-auto max-w-[1280px] px-3 pt-5 pb-16 sm:px-6 sm:pt-8 lg:px-10">
        <div className="px-2 pb-14 sm:px-6">
          <div className="flex items-center gap-5">
            <div className="size-14 animate-pulse rounded-full bg-card shadow-card" />
            <div className="h-12 w-[min(440px,100%)] animate-pulse rounded-full bg-card shadow-card" />
          </div>
          <div className="mt-16 h-14 w-[min(640px,100%)] animate-pulse rounded-2xl bg-chip" />
          <div className="mt-4 h-10 w-[min(520px,100%)] animate-pulse rounded-2xl bg-chip" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${block} h-[420px]`} />
          ))}
        </div>
      </div>
    </div>
  );
}
