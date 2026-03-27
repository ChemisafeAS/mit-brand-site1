import Link from "next/link";
import styles from "./page-edit-bar.module.css";

type PageEditBarProps = {
  isEditing: boolean;
  previewHref: string;
  title: string;
};

export default function PageEditBar({
  isEditing,
  previewHref,
  title,
}: PageEditBarProps) {
  return (
    <div className={styles.bar}>
      <div>
        <p className={styles.eyebrow}>Medarbejdertilstand</p>
        <p className={styles.title}>
          {isEditing ? `Redigerer ${title}` : `Forhåndsvisning af ${title}`}
        </p>
      </div>
      <div className={styles.actions}>
        <Link className={styles.secondaryButton} href="/medarbejder">
          Medarbejderside
        </Link>
        <Link className={styles.button} href={previewHref}>
          {isEditing ? "Forhåndsvisning" : "Redigering"}
        </Link>
      </div>
    </div>
  );
}
