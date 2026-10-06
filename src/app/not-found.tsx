import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-24 max-w-md px-5 text-center">
      <p className="text-sm font-medium text-ink-3">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">This page is not part of the plan</h1>
      <Link href="/" className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-medium text-on-accent">
        Back to today
      </Link>
    </div>
  );
}
