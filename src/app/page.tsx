import { Suspense } from "react";
import { connection } from "next/server";
import { ImportForm } from "@/components/ImportForm";
import { PageHeader } from "@/components/ui";
import { loadSampleAction } from "@/lib/actions";
import { listSeries } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function Page() {
  const d = getDictionary(await getLocale());

  return (
    <div className="space-y-10">
      <PageHeader title={d.home.title} description={d.home.description} />

      <Suspense
        fallback={<p className="text-sm text-muted">{d.home.loading}</p>}
      >
        <ImportSection />
      </Suspense>

      <hr />

      <div>
        <p className="mb-3 text-sm text-muted">{d.home.samplePrompt}</p>
        <form action={loadSampleAction}>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm text-muted transition-colors hover:border-muted hover:text-foreground cursor-pointer"
          >
            {d.home.sampleButton}
          </button>
        </form>
      </div>
    </div>
  );
}

async function ImportSection() {
  await connection();
  const series = listSeries();
  return <ImportForm series={series} />;
}
