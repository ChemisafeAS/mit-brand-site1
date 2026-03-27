"use client";

import { useState } from "react";
import AddressAutocompleteField from "@/components/AddressAutocompleteField";
import { createContact } from "@/app/medarbejder/actions";
import { contactCategories } from "@/lib/contact-schema";
import styles from "./kontakter.module.css";

type CreateContactPanelProps = {
  defaultOpen?: boolean;
};

export default function CreateContactPanel({
  defaultOpen = false,
}: CreateContactPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Kontaktregister</h2>
          <p className={styles.sectionText}>
            Søg først i registeret. Opret kun en ny kontakt, hvis den ikke findes
            allerede.
          </p>
        </div>

        <button
          className={styles.primaryButton}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {isOpen ? "Skjul opret kontakt" : "Opret kontakt"}
        </button>
      </div>

      {isOpen && (
        <form action={createContact} className={styles.formGrid}>
          <input name="returnPath" type="hidden" value="/kontakter" />
          <input
            className={styles.input}
            name="companyName"
            placeholder="Virksomhedsnavn"
            required
            type="text"
          />
          <select className={styles.select} name="category" required>
            <option value="">Vælg kategori</option>
            {contactCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            className={styles.input}
            name="contactPerson"
            placeholder="Kontaktperson"
            type="text"
          />
          <input className={styles.input} name="role" placeholder="Rolle" type="text" />
          <input className={styles.input} name="phone" placeholder="Telefon" type="text" />
          <input className={styles.input} name="email" placeholder="E-mail" type="email" />
          <div className={styles.fieldWide}>
            <AddressAutocompleteField
              className={styles.input}
              name="address"
              placeholder="Adresse"
            />
          </div>
          <textarea
            className={`${styles.textarea} ${styles.fieldWide}`}
            name="notes"
            placeholder="Noter"
          />
          <div className={styles.fieldWide}>
            <button className={styles.primaryButton} type="submit">
              Gem kontakt
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
