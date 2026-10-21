import { Suspense } from "react";
import { connection } from "next/server";
import { ImportForm } from "@/components/ImportForm";
import { PageHeader, btnSecondary } from "@/components/ui";
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{d.home.samplePrompt}</p>
        <form action={loadSampleAction}>
          <button type="submit" className={btnSecondary}>
            {d.home.sampleButton}
          </button>
        </form>
      </div>
    </div>
  );
}

async function ImportSection() {
  await connection();
  const series = await listSeries();
  return <ImportForm series={series} />;
}
