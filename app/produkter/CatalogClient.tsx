"use client";

import { useState } from "react";
import Link from "next/link";
import PageEditBar from "@/components/PageEditBar";
import type { CatalogCategory } from "@/lib/catalog";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  moveCategory,
  moveProduct,
  updateCategory,
  updateProduct,
} from "@/app/medarbejder/actions";
import styles from "./produkter.module.css";

type CatalogClientProps = {
  categories: CatalogCategory[];
  isEditing: boolean;
  noticeMessage?: string;
  noticeStatus?: "error" | "success";
  source: "fallback" | "supabase";
  sourceMessage?: string;
  user: boolean;
};

export default function CatalogClient({
  categories,
  isEditing,
  noticeMessage,
  noticeStatus,
  source,
  sourceMessage,
  user,
}: CatalogClientProps) {
  const filterCategories = ["Alle", ...categories.map((category) => category.name)];
  const [activeCategory, setActiveCategory] = useState("Alle");
  const filteredCategories =
    activeCategory === "Alle"
      ? categories
      : categories.filter((category) => category.name === activeCategory);
  const hasProducts = filteredCategories.some(
    (category) => category.products.length > 0
  );

  return (
    <>
      {user && (
        <PageEditBar
          isEditing={isEditing}
          previewHref={isEditing ? "/produkter" : "/produkter?edit=1"}
          title="produktsiden"
        />
      )}
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Produktoversigt</h1>
        <p className={styles.heroText}>
          {isEditing
            ? "Redigér produkter og kategorier direkte her på siden, og skift til forhåndsvisning for at se kundeversionen."
            : "Se sortimentet samlet efter kategori. Produkterne kan nu styres fra hjemmesiden, så sortimentet ikke længere skal opdateres i kode."}
        </p>
      </section>

      {noticeMessage && (
        <section
          className={`${styles.statusBanner} ${
            noticeStatus === "success"
              ? styles.statusBannerSuccess
              : styles.statusBannerWarning
          }`}
        >
          {noticeMessage}
        </section>
      )}

      {sourceMessage && (
        <section
          className={`${styles.statusBanner} ${
            source === "supabase" ? styles.statusBannerNeutral : styles.statusBannerWarning
          }`}
        >
          {sourceMessage}
        </section>
      )}

      {isEditing && (
        <section className={styles.editorSection}>
          <div className={styles.editorPanel}>
            <div className={styles.editorHeader}>
              <div>
                <h2 className={styles.editorTitle}>Kategorier</h2>
                <p className={styles.editorText}>
                  Opret, omdøb, flyt og slet kategorier her på produktsiden.
                </p>
              </div>
              <Link className={styles.backLink} href="/medarbejder">
                Tilbage til medarbejderside
              </Link>
            </div>

            <form action={createCategory} className={styles.createForm}>
              <input name="returnPath" type="hidden" value="/produkter?edit=1" />
              <input
                className={styles.textInput}
                name="name"
                placeholder="Ny kategori"
                required
                type="text"
              />
              <button className={styles.primaryButton} type="submit">
                Opret kategori
              </button>
            </form>

            <div className={styles.managerList}>
              {categories.map((category, index) => (
                <div key={category.id} className={styles.managerRow}>
                  <form action={updateCategory} className={styles.rowForm}>
                    <input name="id" type="hidden" value={category.id} />
                    <input name="returnPath" type="hidden" value="/produkter?edit=1" />
                    <input
                      className={styles.textInput}
                      defaultValue={category.name}
                      name="name"
                      required
                      type="text"
                    />
                    <button className={styles.secondaryButton} type="submit">
                      Gem
                    </button>
                  </form>

                  <div className={styles.rowActions}>
                    <form action={moveCategory}>
                      <input name="id" type="hidden" value={category.id} />
                      <input name="direction" type="hidden" value="up" />
                      <input name="returnPath" type="hidden" value="/produkter?edit=1" />
                      <button className={styles.iconButton} disabled={index === 0} type="submit">
                        Op
                      </button>
                    </form>
                    <form action={moveCategory}>
                      <input name="id" type="hidden" value={category.id} />
                      <input name="direction" type="hidden" value="down" />
                      <input name="returnPath" type="hidden" value="/produkter?edit=1" />
                      <button
                        className={styles.iconButton}
                        disabled={index === categories.length - 1}
                        type="submit"
                      >
                        Ned
                      </button>
                    </form>
                    <form action={deleteCategory}>
                      <input name="id" type="hidden" value={category.id} />
                      <input name="returnPath" type="hidden" value="/produkter?edit=1" />
                      <button className={styles.dangerButton} type="submit">
                        Slet
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.editorPanel}>
            <div className={styles.editorHeader}>
              <div>
                <h2 className={styles.editorTitle}>Produkter</h2>
                <p className={styles.editorText}>
                  Redigér navn, kategori og rækkefølge direkte i kataloget.
                </p>
              </div>
            </div>

            <form action={createProduct} className={styles.createFormWide}>
              <input name="returnPath" type="hidden" value="/produkter?edit=1" />
              <input
                className={styles.textInput}
                name="name"
                placeholder="Nyt produktnavn"
                required
                type="text"
              />
              <select className={styles.selectInput} name="categoryId" required>
                <option value="">Vælg kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button className={styles.primaryButton} type="submit">
                Opret produkt
              </button>
            </form>
          </div>
        </section>
      )}

      <section className={styles.filterBar}>
        {filterCategories.map((category) => {
          const isActive = category === activeCategory;

          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`${styles.filterButton} ${
                isActive ? styles.filterButtonActive : ""
              }`}
            >
              {category}
            </button>
          );
        })}
      </section>

      <section className={styles.productGroups}>
        {filteredCategories.map((category) => (
          <section key={category.id} className={styles.groupCard}>
            <div className={styles.groupHeader}>
              <div>
                <h2 className={styles.groupTitle}>{category.name}</h2>
              </div>
            </div>

            <div className={styles.groupBody}>
              {category.products.length > 0 ? (
                category.products.map((product, index) =>
                  isEditing ? (
                    <div key={product.id} className={styles.productEditorRow}>
                      <form action={updateProduct} className={styles.productRowForm}>
                        <input name="id" type="hidden" value={product.id} />
                        <input name="returnPath" type="hidden" value="/produkter?edit=1" />
                        <input
                          className={styles.textInput}
                          defaultValue={product.name}
                          name="name"
                          required
                          type="text"
                        />
                        <select
                          className={styles.selectInput}
                          defaultValue={product.categoryId}
                          name="categoryId"
                          required
                        >
                          {categories.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                        <button className={styles.secondaryButton} type="submit">
                          Gem
                        </button>
                      </form>

                      <div className={styles.rowActions}>
                        <form action={moveProduct}>
                          <input name="id" type="hidden" value={product.id} />
                          <input name="direction" type="hidden" value="up" />
                          <input name="returnPath" type="hidden" value="/produkter?edit=1" />
                          <button className={styles.iconButton} disabled={index === 0} type="submit">
                            Op
                          </button>
                        </form>
                        <form action={moveProduct}>
                          <input name="id" type="hidden" value={product.id} />
                          <input name="direction" type="hidden" value="down" />
                          <input name="returnPath" type="hidden" value="/produkter?edit=1" />
                          <button
                            className={styles.iconButton}
                            disabled={index === category.products.length - 1}
                            type="submit"
                          >
                            Ned
                          </button>
                        </form>
                        <form action={deleteProduct}>
                          <input name="id" type="hidden" value={product.id} />
                          <input name="returnPath" type="hidden" value="/produkter?edit=1" />
                          <button className={styles.dangerButton} type="submit">
                            Slet
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div key={product.id} className={styles.productRow}>
                      <p className={styles.productName}>{product.name}</p>
                    </div>
                  )
                )
              ) : (
                <div className={styles.emptyCategoryRow}>
                  Kategorien er oprettet, men har endnu ingen produkter.
                </div>
              )}
            </div>
          </section>
        ))}

        {!hasProducts && (
          <div className={styles.emptyState}>
            Der er ingen produkter i denne kategori endnu.
          </div>
        )}
      </section>
    </main>
    </>
  );
}
