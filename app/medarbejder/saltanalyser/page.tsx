import Link from "next/link";
import { redirect } from "next/navigation";
import SaltAnalysisTool from "./SaltAnalysisTool";
import styles from "./salt-analysis.module.css";
import { formatEmployeeName } from "@/lib/employee-user";
import { getStoredSaltAnalyses } from "@/lib/salt-analysis-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function SaltanalyserPage() {
  if (!isSupabaseConfigured()) {
    redirect("/medarbejder-login?error=config&next=/medarbejder/saltanalyser");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/medarbejder-login?next=/medarbejder/saltanalyser");
  }

  const storedAnalyses = await getStoredSaltAnalyses();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Internt værktøj</p>
          <h1 className={styles.heroTitle}>Saltanalyser</h1>
          <p className={styles.heroLead}>
            Upload analyse-PDF&apos;er og få en første oversigt over modtager,
            følgeseddel, vandindhold, prøvedato og andre felter, som bagefter
            kan justeres direkte i tabellen.
          </p>
          <Link href="/medarbejder" className={styles.backLink}>
            Tilbage til medarbejdersiden
          </Link>
        </div>
        <div className={styles.heroBadge}>Logget ind som {formatEmployeeName(user.email)}</div>
      </section>

      <SaltAnalysisTool
        initialNotice={storedAnalyses.notice}
        initialRows={storedAnalyses.rows}
      />
    </main>
  );
}
