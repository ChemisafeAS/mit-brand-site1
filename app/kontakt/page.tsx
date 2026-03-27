import EditableField from "@/components/EditableField";
import PageEditBar from "@/components/PageEditBar";
import { getEmployeeUser } from "@/lib/employee-user";
import { getPageContent } from "@/lib/site-content";

type KontaktPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function KontaktPage({ searchParams }: KontaktPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const editValue = Array.isArray(resolvedSearchParams?.edit)
    ? resolvedSearchParams?.edit[0]
    : resolvedSearchParams?.edit;
  const user = await getEmployeeUser();
  const isEditing = editValue === "1" && Boolean(user);
  const content = await getPageContent("kontakt");
  const returnPath = "/kontakt?edit=1";

  return (
    <>
      {user && (
        <PageEditBar
          isEditing={isEditing}
          previewHref={isEditing ? "/kontakt" : "/kontakt?edit=1"}
          title="kontaktsiden"
        />
      )}
      <main
        style={{
          backgroundColor: "white",
          padding: "40px",
          borderRadius: "24px",
          boxShadow: "0 10px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
      {isEditing ? (
        <div style={{ fontSize: "42px", marginBottom: "20px" }}>
          <EditableField
            as="input"
            contentKey="hero_title"
            isEditing={isEditing}
            label="Kontakt: titel"
            page="kontakt"
            returnPath={returnPath}
            value={content.content.hero_title}
          />
        </div>
      ) : (
        <h1 style={{ fontSize: "42px", marginBottom: "20px" }}>
          {content.content.hero_title}
        </h1>
      )}

      {isEditing ? (
        <div
          style={{
            fontSize: "18px",
            lineHeight: "1.8",
            marginBottom: "12px",
            color: "#475569",
          }}
        >
          <EditableField
            as="input"
            contentKey="body_phone"
            isEditing={isEditing}
            label="Kontakt: telefonlinje"
            page="kontakt"
            returnPath={returnPath}
            value={content.content.body_phone}
          />
        </div>
      ) : (
        <p
          style={{
            fontSize: "18px",
            lineHeight: "1.8",
            marginBottom: "12px",
            color: "#475569",
          }}
        >
          {content.content.body_phone}
        </p>
      )}

      {isEditing ? (
        <div
          style={{
            fontSize: "18px",
            lineHeight: "1.8",
            marginBottom: "12px",
            color: "#475569",
          }}
        >
          <EditableField
            as="input"
            contentKey="body_mail"
            isEditing={isEditing}
            label="Kontakt: maillinje"
            page="kontakt"
            returnPath={returnPath}
            value={content.content.body_mail}
          />
        </div>
      ) : (
        <p
          style={{
            fontSize: "18px",
            lineHeight: "1.8",
            marginBottom: "12px",
            color: "#475569",
          }}
        >
          {content.content.body_mail}
        </p>
      )}

      {isEditing ? (
        <div style={{ fontSize: "18px", lineHeight: "1.8", color: "#475569" }}>
          <EditableField
            contentKey="body_intro"
            isEditing={isEditing}
            label="Kontakt: brødtekst"
            page="kontakt"
            returnPath={returnPath}
            value={content.content.body_intro}
          />
        </div>
      ) : (
        <p style={{ fontSize: "18px", lineHeight: "1.8", color: "#475569" }}>
          {content.content.body_intro}
        </p>
      )}
    </main>
    </>
  );
}
