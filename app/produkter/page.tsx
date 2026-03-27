import { getEmployeeUser } from "@/lib/employee-user";
import CatalogClient from "./CatalogClient";
import { getCatalogData } from "@/lib/catalog";

type ProdukterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProdukterPage({
  searchParams,
}: ProdukterPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const editValue = Array.isArray(resolvedSearchParams?.edit)
    ? resolvedSearchParams?.edit[0]
    : resolvedSearchParams?.edit;
  const status = Array.isArray(resolvedSearchParams?.status)
    ? resolvedSearchParams?.status[0]
    : resolvedSearchParams?.status;
  const message = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams?.message[0]
    : resolvedSearchParams?.message;
  const user = await getEmployeeUser();
  const catalog = await getCatalogData();

  return (
    <CatalogClient
      categories={catalog.categories}
      isEditing={editValue === "1" && Boolean(user)}
      noticeMessage={message}
      noticeStatus={status === "error" ? "error" : status === "success" ? "success" : undefined}
      source={catalog.source}
      sourceMessage={catalog.error}
      user={Boolean(user)}
    />
  );
}
