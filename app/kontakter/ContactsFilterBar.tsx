"use client";

import { useEffect, useState, useTransition, useDeferredValue } from "react";
import { usePathname, useRouter } from "next/navigation";
import { contactCategories } from "@/lib/contact-schema";
import styles from "./kontakter.module.css";

type ContactsFilterBarProps = {
  initialCategory: string;
  initialQuery: string;
};

export default function ContactsFilterBar({
  initialCategory,
  initialQuery,
}: ContactsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      const normalizedQuery = deferredQuery.trim();

      if (normalizedQuery) {
        params.set("q", normalizedQuery);
      }

      if (category && category !== "Alle") {
        params.set("kategori", category);
      }

      const target = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;

      startTransition(() => {
        router.replace(target, { scroll: false });
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [category, deferredQuery, pathname, router]);

  return (
    <div className={styles.toolbar}>
      <input
        aria-label="Søg i kontakter"
        className={`${styles.input} ${styles.search}`}
        name="q"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Søg i navn, person, mail, telefon eller noter"
        type="search"
        value={query}
      />
      <select
        aria-label="Filtrer efter kategori"
        className={styles.select}
        name="kategori"
        onChange={(event) => setCategory(event.target.value)}
        value={category}
      >
        <option value="Alle">Alle kategorier</option>
        {contactCategories.map((contactCategory) => (
          <option key={contactCategory} value={contactCategory}>
            {contactCategory}
          </option>
        ))}
      </select>
    </div>
  );
}
