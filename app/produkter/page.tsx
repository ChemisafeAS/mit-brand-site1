"use client";

import { useState } from "react";

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
    <main
      style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "56px 32px 80px 32px",
      }}
    >
      <section
        style={{
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
          color: "white",
          borderRadius: "32px",
          padding: "48px",
          boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
          marginBottom: "32px",
        }}
      >
        <p
          style={{
            margin: "0 0 14px 0",
            textTransform: "uppercase",
            letterSpacing: "1.8px",
            fontWeight: 700,
            fontSize: "14px",
            opacity: 0.82,
          }}
        >
          Produkter
        </p>

        <h1
          style={{
            margin: "0 0 18px 0",
            fontSize: "clamp(42px, 7vw, 72px)",
            lineHeight: 0.95,
          }}
        >
          Produktoversigt
        </h1>
      </section>

      <section
        style={{
          display: "flex",
          gap: "14px",
          flexWrap: "wrap",
          marginBottom: "32px",
        }}
      >
        {categories.map((category) => {
          const isActive = category === activeCategory;

          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              style={{
                padding: "14px 20px",
                borderRadius: "999px",
                border: isActive ? "1px solid #0f172a" : "1px solid #dbe4ee",
                backgroundColor: isActive ? "#0f172a" : "white",
                color: isActive ? "white" : "#0f172a",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              {category}
            </button>
          );
        })}
      </section>

      <section
        style={{
          display: "grid",
          gap: "24px",
          marginBottom: "32px",
        }}
      >
        {Object.entries(groupedProducts).map(([category, items]) => (
          <section
            key={category}
            style={{
              backgroundColor: "white",
              borderRadius: "20px",
              boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
              border: "1px solid rgba(148, 163, 184, 0.14)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "22px 28px 18px 28px",
                borderBottom: "1px solid #e8eef5",
                backgroundColor: "#f8fafc",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "6px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "1.8px",
                    textTransform: "uppercase",
                    color: "#64748b",
                  }}
                >
                  Kategori
                </p>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "28px",
                    lineHeight: 1.1,
                    color: "#0f172a",
                  }}
                >
                  {category}
                </h2>
              </div>
            </div>

            <div style={{ padding: "8px 28px 10px 28px" }}>
              {items.map((product, index) => (
                <div
                  key={product.name}
                  style={{
                    padding: "16px 0",
                    borderBottom:
                      index === items.length - 1 ? "none" : "1px solid #e8eef5",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "19px",
                      lineHeight: 1.45,
                      color: "#0f172a",
                      fontWeight: 500,
                    }}
                  >
                    {product.name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {filteredProducts.length === 0 && (
          <div
            style={{
              padding: "24px 22px",
              color: "#475569",
              fontSize: "18px",
            }}
          >
            Der er ingen produkter i denne kategori endnu.
          </div>
        )}
      </section>

    </main>
  );
}
