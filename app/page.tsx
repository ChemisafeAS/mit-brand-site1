import Link from "next/link";
import Image from "next/image";
import EditableField from "@/components/EditableField";
import PageEditBar from "@/components/PageEditBar";
import { getEmployeeUser } from "@/lib/employee-user";
import { getPageContent } from "@/lib/site-content";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const editValue = Array.isArray(resolvedSearchParams?.edit)
    ? resolvedSearchParams?.edit[0]
    : resolvedSearchParams?.edit;
  const user = await getEmployeeUser();
  const isEditing = editValue === "1" && Boolean(user);
  const content = await getPageContent("home");
  const returnPath = "/?edit=1";

  return (
    <>
      {user && (
        <PageEditBar
          isEditing={isEditing}
          previewHref={isEditing ? "/" : "/?edit=1"}
          title="forsiden"
        />
      )}
      <main
        style={{
          position: "relative",
          minHeight: "100vh",
          width: "100%",
          overflow: "hidden",
        }}
      >
      <Image
        src="/salt.jpg"
        alt="Salt produkter"
        fill
        style={{
          objectFit: "cover",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.72) 38%, rgba(15,23,42,0.18) 100%)",
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "110px 32px 80px 32px",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <section style={{ maxWidth: "760px", color: "white" }}>
          {isEditing ? (
            <div
              style={{
                marginBottom: "24px",
                fontSize: "clamp(52px, 8vw, 96px)",
                lineHeight: 0.95,
                fontWeight: 700,
              }}
            >
              <EditableField
                as="input"
                contentKey="hero_title"
                isEditing={isEditing}
                label="Forside: overskrift"
                page="home"
                returnPath={returnPath}
                value={content.content.hero_title}
              />
            </div>
          ) : (
            <h1
              style={{
                fontSize: "clamp(52px, 8vw, 96px)",
                lineHeight: 0.95,
                margin: "0 0 24px 0",
                fontWeight: 700,
              }}
            >
              {content.content.hero_title}
            </h1>
          )}

          {isEditing ? (
            <div
              style={{
                fontSize: "22px",
                lineHeight: 1.7,
                margin: "0 0 34px 0",
                maxWidth: "720px",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              <EditableField
                contentKey="hero_body"
                isEditing={isEditing}
                label="Forside: introtekst"
                page="home"
                returnPath={returnPath}
                value={content.content.hero_body}
              />
            </div>
          ) : (
            <p
              style={{
                fontSize: "22px",
                lineHeight: 1.7,
                margin: "0 0 34px 0",
                maxWidth: "720px",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {content.content.hero_body}
            </p>
          )}

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <Link
              href="/produkter"
              style={{
                padding: "16px 24px",
                backgroundColor: "white",
                color: "#0f172a",
                borderRadius: "999px",
                fontWeight: "bold",
                fontSize: "18px",
              }}
            >
              {content.content.cta_primary}
            </Link>

            <Link
              href="/kontakt"
              style={{
                padding: "16px 24px",
                border: "1px solid rgba(255,255,255,0.7)",
                backgroundColor: "rgba(255,255,255,0.08)",
                color: "white",
                borderRadius: "999px",
                fontWeight: "bold",
                fontSize: "18px",
              }}
            >
              {content.content.cta_secondary}
            </Link>

            <Link
              href="/om"
              style={{
                padding: "16px 24px",
                border: "1px solid rgba(255,255,255,0.7)",
                borderRadius: "999px",
                color: "white",
                fontWeight: "bold",
                fontSize: "18px",
                backgroundColor: "rgba(255,255,255,0.08)",
              }}
            >
              {content.content.cta_tertiary}
            </Link>
          </div>

          {isEditing && (
            <div
              style={{
                marginTop: "18px",
                display: "grid",
                gap: "12px",
                maxWidth: "560px",
              }}
            >
              <EditableField
                as="input"
                contentKey="cta_primary"
                isEditing={isEditing}
                label="Forside: primær knap"
                page="home"
                returnPath={returnPath}
                value={content.content.cta_primary}
              />
              <EditableField
                as="input"
                contentKey="cta_secondary"
                isEditing={isEditing}
                label="Forside: sekundær knap"
                page="home"
                returnPath={returnPath}
                value={content.content.cta_secondary}
              />
              <EditableField
                as="input"
                contentKey="cta_tertiary"
                isEditing={isEditing}
                label="Forside: tredje knap"
                page="home"
                returnPath={returnPath}
                value={content.content.cta_tertiary}
              />
            </div>
          )}
        </section>
      </div>
    </main>
    </>
  );
}
