"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import AddressAutocompleteField from "@/components/AddressAutocompleteField";
import {
  deleteContact,
  updateContact,
} from "@/app/medarbejder/actions";
import type { ContactRecord } from "@/lib/contact-schema";
import { contactCategories } from "@/lib/contact-schema";
import styles from "./kontakter.module.css";

type ContactsListClientProps = {
  contacts: ContactRecord[];
};

export default function ContactsListClient({
  contacts,
}: ContactsListClientProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function getCategoryClass(category: ContactRecord["category"]) {
    if (category === "Intern") {
      return styles.categoryIntern;
    }

    if (category === "Kunde") {
      return styles.categoryCustomer;
    }

    if (category === "Leverandør") {
      return styles.categorySupplier;
    }

    if (category === "Transport") {
      return styles.categoryTransport;
    }

    if (category === "Samarbejdspartner") {
      return styles.categoryPartner;
    }

    return styles.categoryOther;
  }

  function getCategoryStyle(
    category: ContactRecord["category"]
  ): CSSProperties {
    if (category === "Intern") {
      return {
        backgroundColor: "#dbeafe",
        color: "#1d4ed8",
        borderColor: "#93c5fd",
      };
    }

    if (category === "Kunde") {
      return {
        backgroundColor: "#dcfce7",
        color: "#166534",
        borderColor: "#86efac",
      };
    }

    if (category === "Leverandør") {
      return {
        backgroundColor: "#fee2e2",
        color: "#b91c1c",
        borderColor: "#fca5a5",
      };
    }

    if (category === "Transport") {
      return {
        backgroundColor: "#ffedd5",
        color: "#c2410c",
        borderColor: "#fdba74",
      };
    }

    if (category === "Samarbejdspartner") {
      return {
        backgroundColor: "#cffafe",
        color: "#0f766e",
        borderColor: "#67e8f9",
      };
    }

    return {
      backgroundColor: "#e2e8f0",
      color: "#334155",
      borderColor: "#cbd5e1",
    };
  }

  return (
    <section
      className={styles.list}
      style={{ display: "grid", gridTemplateColumns: "1fr" }}
    >
      {contacts.length > 0 ? (
        contacts.map((contact) => {
          const isExpanded = expandedId === contact.id;
          const isEditing = editingId === contact.id;
          const displayName = contact.contact_person || contact.company_name;

          return (
            <article key={contact.id} className={styles.card}>
              <div className={styles.summaryRow}>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryBlock}>
                    <p className={styles.summaryName}>{displayName}</p>
                  </div>
                  <div className={styles.summaryBlock}>
                    <p className={styles.summaryColumn}>
                      {contact.phone || "Intet telefonnummer"}
                    </p>
                  </div>
                  <div className={styles.summaryBlock}>
                    <p className={styles.summaryColumn}>{contact.company_name}</p>
                  </div>
                  <div className={styles.summaryBlock}>
                    <span
                      className={`${styles.summaryCategory} ${getCategoryClass(
                        contact.category
                      )}`}
                      style={getCategoryStyle(contact.category)}
                    >
                      {contact.category}
                    </span>
                  </div>

                  <div className={`${styles.summaryBlock} ${styles.summaryActionBlock}`}>
                    <button
                      className={styles.viewButton}
                      onClick={() => {
                        if (isExpanded) {
                          setExpandedId(null);
                          setEditingId(null);
                          return;
                        }

                        setExpandedId(contact.id);
                      }}
                      type="button"
                    >
                      {isExpanded ? "Skjul oplysninger" : "Se oplysninger"}
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className={styles.expandedSection}>
                  {isEditing ? (
                    <form action={updateContact} className={styles.formGrid}>
                      <input name="id" type="hidden" value={contact.id} />
                      <input name="returnPath" type="hidden" value="/kontakter" />
                      <input
                        className={styles.input}
                        defaultValue={contact.company_name}
                        name="companyName"
                        required
                        type="text"
                      />
                      <select
                        className={styles.select}
                        defaultValue={contact.category}
                        name="category"
                        required
                      >
                        {contactCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      <input
                        className={styles.input}
                        defaultValue={contact.contact_person ?? ""}
                        name="contactPerson"
                        type="text"
                      />
                      <input
                        className={styles.input}
                        defaultValue={contact.role ?? ""}
                        name="role"
                        type="text"
                      />
                      <input
                        className={styles.input}
                        defaultValue={contact.phone ?? ""}
                        name="phone"
                        type="text"
                      />
                      <input
                        className={styles.input}
                        defaultValue={contact.email ?? ""}
                        name="email"
                        type="email"
                      />
                      <div className={styles.fieldWide}>
                        <AddressAutocompleteField
                          className={styles.input}
                          defaultValue={contact.address ?? ""}
                          name="address"
                          placeholder="Adresse"
                        />
                      </div>
                      <textarea
                        className={`${styles.textarea} ${styles.fieldWide}`}
                        defaultValue={contact.notes ?? ""}
                        name="notes"
                      />
                      <div className={`${styles.fieldWide} ${styles.actions}`}>
                        <button className={styles.secondaryButton} type="submit">
                          Gem
                        </button>
                        <button
                          className={styles.ghostButton}
                          onClick={() => setEditingId(null)}
                          type="button"
                        >
                          Annuller
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className={styles.meta}>
                        <div className={styles.metaBlock}>
                          <span className={styles.metaLabel}>Kontaktperson</span>
                          <p className={styles.metaValue}>
                            {contact.contact_person || "Ikke angivet"}
                          </p>
                        </div>
                        <div className={styles.metaBlock}>
                          <span className={styles.metaLabel}>Rolle</span>
                          <p className={styles.metaValue}>
                            {contact.role || "Ikke angivet"}
                          </p>
                        </div>
                        <div className={styles.metaBlock}>
                          <span className={styles.metaLabel}>Telefon</span>
                          <p className={styles.metaValue}>
                            {contact.phone || "Ikke angivet"}
                          </p>
                        </div>
                        <div className={styles.metaBlock}>
                          <span className={styles.metaLabel}>E-mail</span>
                          <p className={styles.metaValue}>
                            {contact.email || "Ikke angivet"}
                          </p>
                        </div>
                        <div className={styles.metaBlock}>
                          <span className={styles.metaLabel}>Adresse</span>
                          <p className={styles.metaValue}>
                            {contact.address || "Ikke angivet"}
                          </p>
                        </div>
                        <div className={styles.metaBlock}>
                          <span className={styles.metaLabel}>Noter</span>
                          <p className={styles.metaValue}>
                            {contact.notes || "Ingen noter"}
                          </p>
                        </div>
                      </div>

                      <div className={styles.actions}>
                        <button
                          className={styles.editButton}
                          onClick={() => setEditingId(contact.id)}
                          type="button"
                        >
                          Rediger
                        </button>
                        <form action={deleteContact}>
                          <input name="id" type="hidden" value={contact.id} />
                          <input
                            name="returnPath"
                            type="hidden"
                            value="/kontakter"
                          />
                          <button className={styles.dangerButton} type="submit">
                            Slet kontakt
                          </button>
                        </form>
                      </div>
                    </>
                  )}
                </div>
              )}
            </article>
          );
        })
      ) : (
        <div className={styles.emptyState}>
          Der blev ikke fundet nogen kontakter med det nuværende filter.
        </div>
      )}
    </section>
  );
}
