import Image from "next/image";
import styles from "./om.module.css";

export default function OmPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Chemisafe A/S</h1>
      </section>

      <section className={styles.introGrid}>
        <article className={styles.card}>
          <h2 className={styles.sectionTitle}>
            Stabil levering og mange års erfaring
          </h2>

          <p className={styles.bodyText}>
            Chemisafe har været i branchen i mere end 25 år og leverer
            saltprodukter til både erhverv og private.
          </p>

          <p className={styles.bodyText}>
            Vi lægger vægt på stabile leverancer, hurtig ordrebehandling og en
            praktisk tilgang til kundernes behov.
          </p>

          <p className={styles.bodyTextLast}>
            På området for vejsalt er vi blandt de førende leverandører til det
            offentlige.
          </p>
        </article>

        <aside className={styles.imageCard}>
          <Image
            src="/om-lager.png"
            alt="Læssemaskine og lastbiler i saltlager"
            width={1152}
            height={768}
            className={styles.image}
          />
          <div className={styles.imageOverlay} />
          <div className={styles.imageCaption}>
            <p className={styles.captionTitle}>Levering og logistik</p>
            <p className={styles.captionText}>
              Vi arbejder med fokus på håndtering, ordreflow og levering af
              saltprodukter til både professionelle kunder og private.
            </p>
          </div>
        </aside>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>
          Derfor vælger kunder Chemisafe A/S
        </h2>

        <div className={styles.reasonsGrid}>
          <div>
            <p className={styles.reasonTitle}>Stabil levering</p>
            <p className={styles.reasonText}>
              Vi lægger vægt på leveringssikkerhed og en løsning, der fungerer i
              praksis.
            </p>
          </div>

          <div>
            <p className={styles.reasonTitle}>Hurtig ordrebehandling</p>
            <p className={styles.reasonText}>
              Forespørgsler og bestillinger håndteres hurtigt og direkte.
            </p>
          </div>

          <div>
            <p className={styles.reasonTitle}>Produkter til flere behov</p>
            <p className={styles.reasonText}>
              Vi leverer både til erhverv, det offentlige og private kunder.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
