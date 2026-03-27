import Link from "next/link";
import { redirect } from "next/navigation";
import ContactsListClient from "./ContactsListClient";
import ContactsFilterBar from "./ContactsFilterBar";
import CreateContactPanel from "./CreateContactPanel";
import styles from "./kontakter.module.css";
import { getContacts } from "@/lib/contacts";
import { formatEmployeeName } from "@/lib/employee-user";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type KontakterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function KontakterPage({
  searchParams,
}: KontakterPageProps) {
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
  const categoryFilter = Array.isArray(resolvedSearchParams?.kategori)
    ? resolvedSearchParams?.kategori[0]
    : resolvedSearchParams?.kategori;
  const query = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams?.q[0]
    : resolvedSearchParams?.q;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/medarbejder-login");
  }

  const contactsResult = await getContacts();
  const normalizedQuery = (query ?? "").trim().toLowerCase();
  const filteredContacts = contactsResult.contacts.filter((contact) => {
    const matchesCategory =
      !categoryFilter || categoryFilter === "Alle"
        ? true
        : contact.category === categoryFilter;
    const haystack = [
      contact.company_name,
      contact.contact_person,
      contact.role,
      contact.email,
      contact.phone,
      contact.address,
      contact.notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = normalizedQuery
      ? haystack.includes(normalizedQuery)
      : true;

    return matchesCategory && matchesQuery;
  });

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>Kontakter</h1>
          <p className={styles.heroText}>
            Saml leverandører, kunder, transportører og andre vigtige relationer
            ét sted. Logget ind som {formatEmployeeName(user.email)}.
          </p>
        </div>
        <Link className={styles.linkButton} href="/medarbejder">
          Tilbage til medarbejderside
        </Link>
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

      {contactsResult.error && (
        <section className={`${styles.notice} ${styles.noticeWarning}`}>
          {contactsResult.error} Kør SQL-filen `supabase/catalog_setup.sql` igen,
          så kontaktregister-tabellen også bliver oprettet.
        </section>
      )}

      <CreateContactPanel defaultOpen={status === "error"} />

      <ContactsFilterBar
        initialCategory={categoryFilter ?? "Alle"}
        initialQuery={query ?? ""}
      />

      <ContactsListClient contacts={filteredContacts} />
    </main>
  );
}
