import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MODULES, getModule, moduleLabel } from "@/lib/curriculum";
import { ModuleView } from "@/components/views/ModuleView";

export const dynamicParams = false;

export function generateStaticParams() {
  return MODULES.map((m) => ({ id: String(m.id) }));
}

export async function generateMetadata({ params }: PageProps<"/modules/[id]">): Promise<Metadata> {
  const { id } = await params;
  const m = getModule(Number(id));
  return { title: m ? `${moduleLabel(m.id)} ${m.title}` : "Module" };
}

export default async function ModulePage({ params }: PageProps<"/modules/[id]">) {
  const { id } = await params;
  const n = Number(id);
  if (!getModule(n)) notFound();
  return <ModuleView key={n} id={n} />;
}
