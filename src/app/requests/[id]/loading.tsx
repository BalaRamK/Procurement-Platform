export default function RequestDetailLoading() {
  return (
    <div className="card animate-pulse p-8">
      <div className="mb-4 h-6 w-48 rounded bg-slate-200 dark:bg-slate-600" />
      <div className="mb-6 h-4 w-full max-w-md rounded bg-slate-200 dark:bg-slate-600" />
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-4 rounded bg-slate-200 dark:bg-slate-600" style={{ width: `${60 + i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}
