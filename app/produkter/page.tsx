"use client";

import { useState } from "react";
import styles from "./produkter.module.css";

const products = [
  {
    name: "Pingo vejsalt - 25 kg sæk",
    saltType: "Vejsalt",
  },
  {
    name: "Pingo vejsalt - 15 kg sæk",
    saltType: "Vejsalt",
  },
  {
    name: "Pingo vejsalt - 10 kg sæk",
    saltType: "Vejsalt",
  },
  {
    name: "Pingo vejsalt - 10 kg spand",
    saltType: "Vejsalt",
  },
  {
    name: "Pingo vejsalt - 1000 kg big bag",
    saltType: "Vejsalt",
  },
  {
    name: "Pingo vejsalt - 600 kg big bag",
    saltType: "Vejsalt",
  },
  {
    name: "Magnesium Chloride flakes - 25 kg sæk",
    saltType: "Magnesiumklorid",
  },
  {
    name: "Pingo-Produktionssalt - 20 kg sæk",
    saltType: "Produktionssalt",
  },
  {
    name: "Urea 46% - 15 kg sæk",
    saltType: "Vejsalt",
  },
  {
    name: "Calcium Chloride flakes - 15 kg sæk",
    saltType: "Calciumchlorid",
  },
  {
    name: "Calcium Cloride prills - 15 kg sæk",
    saltType: "Calciumchlorid",
  },
  {
    name: "Pingo Stensalt - Bulk",
    saltType: "Vejsalt",
  },
  {
    name: "Pingo Havsalt - Bulk",
    saltType: "Vejsalt",
  },
  {
    name: "Salttabletter til blødgøringsanlæg - 10 kg sæk",
    saltType: "Blødgøringssalt",
  },
  {
    name: "Salttabletter til blødgøringsanlæg - 25 kg sæk",
    saltType: "Blødgøringssalt",
  },
  {
    name: "Fodersalt GMP+FSA sikret - Bulk",
    saltType: "Fodersalt",
  },
  {
    name: "Fodersalt GMP+FSA sikret - 1000 kg big bag",
    saltType: "Fodersalt",
  },
  {
    name: "Fodersalt GMP+FSA sikret - 25 kg sæk",
    saltType: "Fodersalt",
  },
  {
    name: "Hudesalt 80/20 Mix - Bulk",
    saltType: "Konserveringssalt",
  },
];

export default function ProdukterPage() {
  const categories = ["Alle", ...new Set(products.map((product) => product.saltType))];
  const [activeCategory, setActiveCategory] = useState("Alle");

  const filteredProducts =
    activeCategory === "Alle"
      ? products
      : products.filter((product) => product.saltType === activeCategory);

  const groupedProducts = filteredProducts.reduce<Record<string, typeof products>>(
    (groups, product) => {
      if (!groups[product.saltType]) {
        groups[product.saltType] = [];
      }

      groups[product.saltType].push(product);
      return groups;
    },
    {}
  );

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Produktoversigt</h1>
      </section>

      <section className={styles.filterBar}>
        {categories.map((category) => {
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
        {Object.entries(groupedProducts).map(([category, items]) => (
          <section key={category} className={styles.groupCard}>
            <div className={styles.groupHeader}>
              <div>
                <h2 className={styles.groupTitle}>{category}</h2>
              </div>
            </div>

            <div className={styles.groupBody}>
              {items.map((product) => (
                <div key={product.name} className={styles.productRow}>
                  <p className={styles.productName}>{product.name}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {filteredProducts.length === 0 && (
          <div className={styles.emptyState}>
            Der er ingen produkter i denne kategori endnu.
          </div>
        )}
      </section>
    </main>
  );
}
