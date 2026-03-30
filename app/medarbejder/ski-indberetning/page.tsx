import Link from "next/link";
import { redirect } from "next/navigation";
import SkiReportTool from "./SkiReportTool";
import styles from "./ski-report.module.css";
import { formatEmployeeName } from "@/lib/employee-user";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function SkiIndberetningPage() {
  if (!isSupabaseConfigured()) {
    redirect("/medarbejder-login?error=config&next=/medarbejder/ski-indberetning");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/medarbejder-login?next=/medarbejder/ski-indberetning");
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Internt værktøj</p>
          <h1 className={styles.heroTitle}>SKI-indberetning</h1>
          <p className={styles.heroLead}>
            Test upload af metadata og fakturaer direkte i hjemmesiden. Systemet
            matcher mod metadata-arket og bygger et CSV-output, der kan åbnes i Excel.
          </p>
          <Link href="/medarbejder" className={styles.backLink}>
            Tilbage til medarbejdersiden
          </Link>
        </div>
        <div className={styles.heroBadge}>Logget ind som {formatEmployeeName(user.email)}</div>
      </section>

      <SkiReportTool />
    </main>
  );
}
