"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ContactCategory } from "@/lib/contact-schema";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type NoticeStatus = "error" | "success";
type Direction = "down" | "up";
type ProductRow = {
  category_id: string;
  id: string;
  name: string;
  sort_order: number;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
};

function buildRedirect(
  status: NoticeStatus,
  message: string,
  returnPath = "/medarbejder"
) {
  const params = new URLSearchParams({ message, status });
  return `${returnPath}${returnPath.includes("?") ? "&" : "?"}${params.toString()}`;
}

function getReturnPath(formData: FormData, fallback = "/medarbejder") {
  const value = formData.get("returnPath");

  return typeof value === "string" && value ? value : fallback;
}

async function getEmployeeSupabase() {
  if (!isSupabaseConfigured()) {
    redirect(buildRedirect("error", "Supabase er ikke sat op endnu."));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/medarbejder-login");
  }

  return supabase;
}

async function refreshCatalogViews() {
  revalidatePath("/medarbejder");
  revalidatePath("/produkter");
  revalidatePath("/kontakter");
}

async function getCategories(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) {
    redirect(
      buildRedirect(
        "error",
        "Kategorierne kunne ikke hentes fra Supabase endnu. Kør SQL-opsætningen først."
      )
    );
  }

  return data as CategoryRow[];
}

async function getProducts(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sort_order, category_id")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) {
    redirect(
      buildRedirect(
        "error",
        "Produkterne kunne ikke hentes fra Supabase endnu. Kør SQL-opsætningen først."
      )
    );
  }

  return data as ProductRow[];
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

export async function logoutEmployee() {
  const supabase = await createClient();

  await supabase.auth.signOut();
  redirect("/medarbejder-login");
}

export async function createCategory(formData: FormData) {
  const name = getString(formData, "name");
  const returnPath = getReturnPath(formData);

  if (!name) {
    redirect(buildRedirect("error", "Skriv et kategorinavn først.", returnPath));
  }

  const supabase = await getEmployeeSupabase();
  const categories = await getCategories(supabase);
  const nextSortOrder =
    categories.length > 0
      ? Math.max(...categories.map((category) => category.sort_order)) + 1
      : 1;
  const { error } = await supabase.from("categories").insert({
    name,
    sort_order: nextSortOrder,
  });

  if (error) {
    redirect(
      buildRedirect(
        "error",
        "Kategorien kunne ikke oprettes. Tjek om navnet allerede findes.",
        returnPath
      )
    );
  }

  await refreshCatalogViews();
  redirect(buildRedirect("success", "Kategorien er oprettet.", returnPath));
}

export async function updateCategory(formData: FormData) {
  const id = getString(formData, "id");
  const name = getString(formData, "name");
  const returnPath = getReturnPath(formData);

  if (!id || !name) {
    redirect(
      buildRedirect(
        "error",
        "Kategori-id eller navn mangler i opdateringen.",
        returnPath
      )
    );
  }

  const supabase = await getEmployeeSupabase();
  const { error } = await supabase.from("categories").update({ name }).eq("id", id);

  if (error) {
    redirect(
      buildRedirect(
        "error",
        "Kategorien kunne ikke opdateres. Tjek om navnet allerede bruges.",
        returnPath
      )
    );
  }

  await refreshCatalogViews();
  redirect(buildRedirect("success", "Kategorien er opdateret.", returnPath));
}

export async function moveCategory(formData: FormData) {
  const id = getString(formData, "id");
  const direction = getString(formData, "direction") as Direction;
  const returnPath = getReturnPath(formData);

  if (!id || !direction) {
    redirect(buildRedirect("error", "Kategorien kunne ikke flyttes.", returnPath));
  }

  const supabase = await getEmployeeSupabase();
  const categories = await getCategories(supabase);
  const currentIndex = categories.findIndex((category) => category.id === id);
  const targetIndex =
    direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (
    currentIndex === -1 ||
    targetIndex < 0 ||
    targetIndex >= categories.length
  ) {
    redirect(
      buildRedirect("error", "Kategorien kan ikke flyttes længere.", returnPath)
    );
  }

  const currentCategory = categories[currentIndex];
  const targetCategory = categories[targetIndex];
  const firstUpdate = await supabase
    .from("categories")
    .update({ sort_order: targetCategory.sort_order })
    .eq("id", currentCategory.id);
  const secondUpdate = await supabase
    .from("categories")
    .update({ sort_order: currentCategory.sort_order })
    .eq("id", targetCategory.id);

  if (firstUpdate.error || secondUpdate.error) {
    redirect(buildRedirect("error", "Kategorien kunne ikke flyttes.", returnPath));
  }

  await refreshCatalogViews();
  redirect(
    buildRedirect("success", "Kategorirækkefølgen er opdateret.", returnPath)
  );
}

export async function deleteCategory(formData: FormData) {
  const id = getString(formData, "id");
  const returnPath = getReturnPath(formData);

  if (!id) {
    redirect(buildRedirect("error", "Kategori-id mangler.", returnPath));
  }

  const supabase = await getEmployeeSupabase();
  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (countError) {
    redirect(buildRedirect("error", "Kunne ikke tjekke kategorien.", returnPath));
  }

  if ((count ?? 0) > 0) {
    redirect(
      buildRedirect(
        "error",
        "Kategorien indeholder stadig produkter. Flyt eller slet dem først.",
        returnPath
      )
    );
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    redirect(buildRedirect("error", "Kategorien kunne ikke slettes.", returnPath));
  }

  await refreshCatalogViews();
  redirect(buildRedirect("success", "Kategorien er slettet.", returnPath));
}

export async function createProduct(formData: FormData) {
  const name = getString(formData, "name");
  const categoryId = getString(formData, "categoryId");
  const returnPath = getReturnPath(formData);

  if (!name || !categoryId) {
    redirect(
      buildRedirect("error", "Produktnavn eller kategori mangler.", returnPath)
    );
  }

  const supabase = await getEmployeeSupabase();
  const products = await getProducts(supabase);
  const categoryProducts = products.filter(
    (product) => product.category_id === categoryId
  );
  const nextSortOrder =
    categoryProducts.length > 0
      ? Math.max(...categoryProducts.map((product) => product.sort_order)) + 1
      : 1;
  const { error } = await supabase.from("products").insert({
    category_id: categoryId,
    name,
    sort_order: nextSortOrder,
  });

  if (error) {
    redirect(buildRedirect("error", "Produktet kunne ikke oprettes.", returnPath));
  }

  await refreshCatalogViews();
  redirect(buildRedirect("success", "Produktet er oprettet.", returnPath));
}

export async function updateProduct(formData: FormData) {
  const id = getString(formData, "id");
  const name = getString(formData, "name");
  const categoryId = getString(formData, "categoryId");
  const returnPath = getReturnPath(formData);

  if (!id || !name || !categoryId) {
    redirect(
      buildRedirect("error", "Produktdata mangler i opdateringen.", returnPath)
    );
  }

  const supabase = await getEmployeeSupabase();
  const products = await getProducts(supabase);
  const currentProduct = products.find((product) => product.id === id);

  if (!currentProduct) {
    redirect(buildRedirect("error", "Produktet blev ikke fundet.", returnPath));
  }

  const updates: { category_id: string; name: string; sort_order?: number } = {
    category_id: categoryId,
    name,
  };

  if (currentProduct.category_id !== categoryId) {
    const targetProducts = products.filter(
      (product) => product.category_id === categoryId
    );

    updates.sort_order =
      targetProducts.length > 0
        ? Math.max(...targetProducts.map((product) => product.sort_order)) + 1
        : 1;
  }

  const { error } = await supabase.from("products").update(updates).eq("id", id);

  if (error) {
    redirect(buildRedirect("error", "Produktet kunne ikke opdateres.", returnPath));
  }

  await refreshCatalogViews();
  redirect(buildRedirect("success", "Produktet er opdateret.", returnPath));
}

export async function moveProduct(formData: FormData) {
  const id = getString(formData, "id");
  const direction = getString(formData, "direction") as Direction;
  const returnPath = getReturnPath(formData);

  if (!id || !direction) {
    redirect(buildRedirect("error", "Produktet kunne ikke flyttes.", returnPath));
  }

  const supabase = await getEmployeeSupabase();
  const products = await getProducts(supabase);
  const currentProduct = products.find((product) => product.id === id);

  if (!currentProduct) {
    redirect(buildRedirect("error", "Produktet blev ikke fundet.", returnPath));
  }

  const categoryProducts = products.filter(
    (product) => product.category_id === currentProduct.category_id
  );
  const currentIndex = categoryProducts.findIndex((product) => product.id === id);
  const targetIndex =
    direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (
    currentIndex === -1 ||
    targetIndex < 0 ||
    targetIndex >= categoryProducts.length
  ) {
    redirect(
      buildRedirect("error", "Produktet kan ikke flyttes længere.", returnPath)
    );
  }

  const targetProduct = categoryProducts[targetIndex];
  const firstUpdate = await supabase
    .from("products")
    .update({ sort_order: targetProduct.sort_order })
    .eq("id", currentProduct.id);
  const secondUpdate = await supabase
    .from("products")
    .update({ sort_order: currentProduct.sort_order })
    .eq("id", targetProduct.id);

  if (firstUpdate.error || secondUpdate.error) {
    redirect(buildRedirect("error", "Produktet kunne ikke flyttes.", returnPath));
  }

  await refreshCatalogViews();
  redirect(
    buildRedirect("success", "Produktrækkefølgen er opdateret.", returnPath)
  );
}

export async function deleteProduct(formData: FormData) {
  const id = getString(formData, "id");
  const returnPath = getReturnPath(formData);

  if (!id) {
    redirect(buildRedirect("error", "Produkt-id mangler.", returnPath));
  }

  const supabase = await getEmployeeSupabase();
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    redirect(buildRedirect("error", "Produktet kunne ikke slettes.", returnPath));
  }

  await refreshCatalogViews();
  redirect(buildRedirect("success", "Produktet er slettet.", returnPath));
}

export async function createContact(formData: FormData) {
  const returnPath = getReturnPath(formData, "/kontakter");
  const companyName = getString(formData, "companyName");
  const category = getString(formData, "category") as ContactCategory;

  if (!companyName || !category) {
    redirect(
      buildRedirect(
        "error",
        "Virksomhedsnavn og kategori er påkrævet.",
        returnPath
      )
    );
  }

  const supabase = await getEmployeeSupabase();
  const { error } = await supabase.from("contacts").insert({
    address: getNullableString(formData, "address"),
    category,
    company_name: companyName,
    contact_person: getNullableString(formData, "contactPerson"),
    email: getNullableString(formData, "email"),
    notes: getNullableString(formData, "notes"),
    phone: getNullableString(formData, "phone"),
    role: getNullableString(formData, "role"),
  });

  if (error) {
    redirect(buildRedirect("error", "Kontakten kunne ikke oprettes.", returnPath));
  }

  await refreshCatalogViews();
  redirect(buildRedirect("success", "Kontakten er oprettet.", returnPath));
}

export async function updateContact(formData: FormData) {
  const returnPath = getReturnPath(formData, "/kontakter");
  const id = getString(formData, "id");
  const companyName = getString(formData, "companyName");
  const category = getString(formData, "category") as ContactCategory;

  if (!id || !companyName || !category) {
    redirect(
      buildRedirect(
        "error",
        "Kontakt-id, virksomhedsnavn og kategori er påkrævet.",
        returnPath
      )
    );
  }

  const supabase = await getEmployeeSupabase();
  const { error } = await supabase
    .from("contacts")
    .update({
      address: getNullableString(formData, "address"),
      category,
      company_name: companyName,
      contact_person: getNullableString(formData, "contactPerson"),
      email: getNullableString(formData, "email"),
      notes: getNullableString(formData, "notes"),
      phone: getNullableString(formData, "phone"),
      role: getNullableString(formData, "role"),
    })
    .eq("id", id);

  if (error) {
    redirect(buildRedirect("error", "Kontakten kunne ikke opdateres.", returnPath));
  }

  await refreshCatalogViews();
  redirect(buildRedirect("success", "Kontakten er opdateret.", returnPath));
}

export async function deleteContact(formData: FormData) {
  const returnPath = getReturnPath(formData, "/kontakter");
  const id = getString(formData, "id");

  if (!id) {
    redirect(buildRedirect("error", "Kontakt-id mangler.", returnPath));
  }

  const supabase = await getEmployeeSupabase();
  const { error } = await supabase.from("contacts").delete().eq("id", id);

  if (error) {
    redirect(buildRedirect("error", "Kontakten kunne ikke slettes.", returnPath));
  }

  await refreshCatalogViews();
  redirect(buildRedirect("success", "Kontakten er slettet.", returnPath));
}
