import { saveSiteContent } from "@/app/site-content-actions";
import type { PageSlug } from "@/lib/site-content";
import styles from "./editable-field.module.css";

type EditableFieldProps = {
  as?: "input" | "textarea";
  contentKey: string;
  isEditing: boolean;
  label: string;
  page: PageSlug;
  returnPath: string;
  value: string;
};

export default function EditableField({
  as = "textarea",
  contentKey,
  isEditing,
  label,
  page,
  returnPath,
  value,
}: EditableFieldProps) {
  if (!isEditing) {
    return value;
  }

  return (
    <form action={saveSiteContent} className={styles.form}>
      <input name="page" type="hidden" value={page} />
      <input name="contentKey" type="hidden" value={contentKey} />
      <input name="returnPath" type="hidden" value={returnPath} />
      <label className={styles.label}>
        <span className={styles.labelText}>{label}</span>
        {as === "input" ? (
          <input
            className={styles.input}
            defaultValue={value}
            name="value"
            required
            type="text"
          />
        ) : (
          <textarea
            className={styles.textarea}
            defaultValue={value}
            name="value"
            required
            rows={4}
          />
        )}
      </label>
      <button className={styles.button} type="submit">
        Gem tekst
      </button>
    </form>
  );
}
