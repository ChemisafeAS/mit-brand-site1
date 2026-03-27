import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./dashboard.module.css";
import { logoutEmployee } from "./actions";
import { getCatalogData } from "@/lib/catalog";
import { formatEmployeeName } from "@/lib/employee-user";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type EmployeePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MedarbejderPage({
  searchParams,
}: EmployeePageProps) {
  if (!isSupabaseConfigured()) {
    redirect("/medarbejder-login?error=config");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const status = Array.isArray(resolvedSearchParams?.status)
    ? resolvedSearchParams?.status[0]
    : resolvedSearchParams?.status;
  const message = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams?.message[0]
    : resolvedSearchParams?.message;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const catalog = await getCatalogData();

  if (!user) {
    redirect("/medarbejder-login");
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Medarbejder område</p>
          <h1 className={styles.title}>
            Velkommen, {formatEmployeeName(user.email)}
          </h1>
          <p className={styles.lead}>
            Her kan I nu styre kategorier og produkter direkte fra hjemmesiden
          </p>
        </div>

        <form action={logoutEmployee} className={styles.logoutForm}>
          <button className={styles.logoutButton} type="submit">
            Log ud
          </button>
        </form>
      </section>

      {message && (
        <section
          className={`${styles.notice} ${
            status === "success" ? styles.noticeSuccess : styles.noticeError
          }`}
        >
          {message}
        </section>
      )}

      {catalog.error && (
        <section className={`${styles.notice} ${styles.noticeWarning}`}>
          {catalog.error} Kør SQL-filen `supabase/catalog_setup.sql` fra
          projektet, og opdater derefter siden.
        </section>
      )}

      <section className={styles.grid}>
        <article className={`${styles.card} ${styles.cardWide}`}>
          <h2 className={styles.cardTitle}>Redigering</h2>
          <p className={styles.cardText}>
            Vælg den side du vil arbejde på. Hver side har nu sin egen
            redigeringstilstand med forhåndsvisning, så dashboardet kan holdes
            rent og enkelt.
          </p>

          <div className={styles.linkList}>
            <Link className={styles.linkItem} href="/?edit=1">
              <span className={styles.linkLabel}>Rediger forside</span>
              <p className={styles.linkText}>
                Opdatér hero-tekster og skift mellem redigering og kundeversion.
              </p>
            </Link>

            <Link className={styles.linkItem} href="/om?edit=1">
              <span className={styles.linkLabel}>Rediger om-siden</span>
              <p className={styles.linkText}>
                Tilpas tekstsektioner, billedtekst og salgsbudskaber direkte.
              </p>
            </Link>

            <Link className={styles.linkItem} href="/kontakt?edit=1">
              <span className={styles.linkLabel}>Rediger kontaktside</span>
              <p className={styles.linkText}>
                Justér titel, telefon, mail og kontakttekst uden kodeændringer.
              </p>
            </Link>

            <Link className={styles.linkItem} href="/produkter?edit=1">
              <span className={styles.linkLabel}>Rediger produkter</span>
              <p className={styles.linkText}>
                Opret, flyt og redigér produkter og kategorier direkte på
                produktsiden.
              </p>
            </Link>

            <Link className={styles.linkItem} href="/kontakter">
              <span className={styles.linkLabel}>Kontakter</span>
              <p className={styles.linkText}>
                Saml og vedligehold kunder, leverandører og andre kontakter ét
                sted.
              </p>
            </Link>
          </div>
        </article>

        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Kontaktregister</h2>
          <p className={styles.cardText}>
            En separat intern side kun til medarbejdere, hvor I kan samle
            leverandører, kunder, transportører og andre vigtige kontakter.
          </p>
          <div className={styles.linkList}>
            <Link className={styles.linkItem} href="/kontakter">
              <span className={styles.linkLabel}>Åbn kontaktregister</span>
              <p className={styles.linkText}>
                Gå til den dedikerede medarbejderside for kontakter.
              </p>
            </Link>
          </div>
        </article>

        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Status</h2>
          <p className={styles.cardText}>
            Den offentlige produktside læser kataloget fra{" "}
            {catalog.source === "supabase" ? "Supabase" : "den midlertidige fallback-liste"}.
          </p>
          <div className={styles.badge}>
            {catalog.source === "supabase" ? "Supabase aktiv" : "Fallback aktiv"}
          </div>
        </article>

        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Katalogoverblik</h2>
          <p className={styles.cardText}>
            {catalog.categories.length} kategorier er klar, og kataloget vises
            i den rækkefølge kunderne ser på produktsiden.
          </p>
          <div className={styles.infoList}>
            {catalog.categories.slice(0, 5).map((category) => (
              <div key={category.id} className={styles.infoRow}>
                <span className={styles.infoLabel}>{category.name}</span>
                <p className={styles.infoValue}>
                  {category.products.length} produkter i denne kategori
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
