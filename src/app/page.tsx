import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
      <main className="flex max-w-2xl flex-col items-center gap-8 px-8 text-center">
        <h1 className="text-3xl font-bold text-slate-800">
          Prometheus Call Copilot
        </h1>
        <p className="text-lg text-slate-600">
          Real-time AI copilot for sales/loan agents. Get suggested questions,
          manual-grounded answers, and end-of-call summaries.
        </p>
        <div className="flex gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-slate-800 px-8 py-3 text-lg font-medium text-white hover:bg-slate-700"
          >
            Open Agent Dashboard
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 px-8 py-3 text-lg font-medium text-slate-700 hover:bg-slate-100"
          >
            Admin
          </Link>
        </div>
      </main>
    </div>
  );
}
