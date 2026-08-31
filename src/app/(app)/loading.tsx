export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-9 w-72" />
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <div className="skeleton h-44 md:col-span-2" />
        <div className="skeleton h-44" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="skeleton h-56" />
    </div>
  );
}
