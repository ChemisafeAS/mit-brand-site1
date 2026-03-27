import styles from "./login.module.css";
import { loginEmployee } from "./actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getErrorMessage(errorCode?: string) {
  if (errorCode === "invalid") {
    return "E-mail eller adgangskode er ikke korrekt.";
  }

  if (errorCode === "config") {
    return "Supabase er ikke sat op endnu. Tilføj projektets URL og publishable key i miljøvariablerne først.";
  }

  return "";
}

export default async function MedarbejderLoginPage({
  searchParams,
}: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorCode = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const nextPath = Array.isArray(resolvedSearchParams?.next)
    ? resolvedSearchParams?.next[0]
    : resolvedSearchParams?.next;
  const errorMessage = getErrorMessage(errorCode);
  const isConfigured = isSupabaseConfigured();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Internt område</p>
          <h1 className={styles.title}>Medarbejder-login</h1>
          <p className={styles.introText}>
            Her kan medarbejdere logge ind og få adgang til interne genveje,
            driftsoverblik og materiale samlet ét sted.
          </p>

          <div className={styles.list}>
            <div className={styles.listItem}>
              <span className={styles.listLabel}>Hurtig adgang</span>
              <p className={styles.listText}>
                Saml daglige links, kontaktoplysninger og vigtige dokumenter ét
                sted.
              </p>
            </div>

            <div className={styles.listItem}>
              <span className={styles.listLabel}>Beskyttet indhold</span>
              <p className={styles.listText}>
                Området er beskyttet med server-side session-cookie og direkte
                route-beskyttelse.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Log ind</h2>
          <p className={styles.panelText}>
            Log ind med medarbejderens Supabase-konto for at fortsætte.
          </p>

          {errorMessage && <p className={styles.error}>{errorMessage}</p>}

          <form action={loginEmployee} className={styles.form}>
            <input type="hidden" name="next" value={nextPath ?? "/medarbejder"} />

            <div className={styles.field}>
              <label className={styles.label} htmlFor="username">
                E-mail
              </label>
              <input
                className={styles.input}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">
                Adgangskode
              </label>
              <input
                className={styles.input}
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            <button className={styles.button} type="submit">
              Gå til medarbejderområde
            </button>
          </form>

          <p className={styles.note}>
            {isConfigured
              ? "Login er koblet til Supabase. Opret medarbejderbrugere i Supabase Auth."
              : "Login er bygget, men kræver Supabase-miljøvariabler før det virker i produktion."}
          </p>
        </div>
      </section>
    </main>
  );
}
