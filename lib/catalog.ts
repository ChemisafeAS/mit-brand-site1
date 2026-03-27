import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RawCategory = {
  id: string;
  name: string;
  sort_order: number;
};

type RawProduct = {
  category_id: string;
  id: string;
  name: string;
  sort_order: number;
};

export type CatalogProduct = {
  categoryId: string;
  id: string;
  name: string;
  sortOrder: number;
};

export type CatalogCategory = {
  id: string;
  name: string;
  products: CatalogProduct[];
  sortOrder: number;
};

export type CatalogData = {
  categories: CatalogCategory[];
  error?: string;
  source: "fallback" | "supabase";
};

const fallbackProducts = [
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

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildFallbackCatalog(): CatalogData {
  const grouped = fallbackProducts.reduce<Map<string, CatalogProduct[]>>(
    (accumulator, product) => {
      const list = accumulator.get(product.saltType) ?? [];

      list.push({
        categoryId: toSlug(product.saltType),
        id: `${toSlug(product.saltType)}-${list.length + 1}`,
        name: product.name,
        sortOrder: list.length,
      });
      accumulator.set(product.saltType, list);
      return accumulator;
    },
    new Map()
  );

  return {
    categories: [...grouped.entries()].map(([name, products], index) => ({
      id: toSlug(name),
      name,
      products,
      sortOrder: index,
    })),
    source: "fallback",
  };
}

function mergeCatalogData(
  categories: RawCategory[],
  products: RawProduct[]
): CatalogCategory[] {
  const productsByCategory = products.reduce<Map<string, CatalogProduct[]>>(
    (accumulator, product) => {
      const list = accumulator.get(product.category_id) ?? [];

      list.push({
        categoryId: product.category_id,
        id: product.id,
        name: product.name,
        sortOrder: product.sort_order,
      });
      accumulator.set(product.category_id, list);
      return accumulator;
    },
    new Map()
  );

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    products: productsByCategory.get(category.id) ?? [],
    sortOrder: category.sort_order,
  }));
}

export async function getCatalogData(): Promise<CatalogData> {
  if (!isSupabaseConfigured()) {
    return {
      ...buildFallbackCatalog(),
      error: "Supabase er ikke sat op endnu. Produkterne vises derfor fra den midlertidige liste i koden.",
    };
  }

  try {
    const supabase = await createClient();
    const [{ data: categories, error: categoriesError }, { data: products, error: productsError }] =
      await Promise.all([
        supabase
          .from("categories")
          .select("id, name, sort_order")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("products")
          .select("id, name, sort_order, category_id")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);

    if (categoriesError || productsError || !categories || !products) {
      return {
        ...buildFallbackCatalog(),
        error:
          "Supabase-tabellerne til produkter og kategorier er ikke klar endnu. Kør SQL-opsætningen først, så hjemmesiden læser fra databasen.",
      };
    }

    return {
      categories: mergeCatalogData(
        categories as RawCategory[],
        products as RawProduct[]
      ),
      source: "supabase",
    };
  } catch {
    return {
      ...buildFallbackCatalog(),
      error:
        "Der opstod en fejl ved hentning af kataloget fra Supabase. Den midlertidige produktliste vises derfor i stedet.",
    };
  }
}
