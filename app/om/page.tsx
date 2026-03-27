import Image from "next/image";
import styles from "./om.module.css";
import EditableField from "@/components/EditableField";
import PageEditBar from "@/components/PageEditBar";
import { getEmployeeUser } from "@/lib/employee-user";
import { getPageContent } from "@/lib/site-content";

type OmPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OmPage({ searchParams }: OmPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const editValue = Array.isArray(resolvedSearchParams?.edit)
    ? resolvedSearchParams?.edit[0]
    : resolvedSearchParams?.edit;
  const user = await getEmployeeUser();
  const isEditing = editValue === "1" && Boolean(user);
  const content = await getPageContent("om");
  const returnPath = "/om?edit=1";

  return (
    <>
      {user && (
        <PageEditBar
          isEditing={isEditing}
          previewHref={isEditing ? "/om" : "/om?edit=1"}
          title="om-siden"
        />
      )}
    <main className={styles.page}>
      <section className={styles.hero}>
        {isEditing ? (
          <div className={styles.heroTitle}>
            <EditableField
              as="input"
              contentKey="hero_title"
              isEditing={isEditing}
              label="Om: hero titel"
              page="om"
              returnPath={returnPath}
              value={content.content.hero_title}
            />
          </div>
        ) : (
          <h1 className={styles.heroTitle}>{content.content.hero_title}</h1>
        )}
      </section>

      <section className={styles.introGrid}>
        <article className={styles.card}>
          {isEditing ? (
            <>
              <div className={styles.sectionTitle}>
                <EditableField
                  as="input"
                  contentKey="intro_title"
                  isEditing={isEditing}
                  label="Om: intro titel"
                  page="om"
                  returnPath={returnPath}
                  value={content.content.intro_title}
                />
              </div>

              <div className={styles.bodyText}>
                <EditableField
                  contentKey="intro_body_1"
                  isEditing={isEditing}
                  label="Om: intro tekst 1"
                  page="om"
                  returnPath={returnPath}
                  value={content.content.intro_body_1}
                />
              </div>

              <div className={styles.bodyText}>
                <EditableField
                  contentKey="intro_body_2"
                  isEditing={isEditing}
                  label="Om: intro tekst 2"
                  page="om"
                  returnPath={returnPath}
                  value={content.content.intro_body_2}
                />
              </div>

              <div className={styles.bodyTextLast}>
                <EditableField
                  contentKey="intro_body_3"
                  isEditing={isEditing}
                  label="Om: intro tekst 3"
                  page="om"
                  returnPath={returnPath}
                  value={content.content.intro_body_3}
                />
              </div>
            </>
          ) : (
            <>
              <h2 className={styles.sectionTitle}>{content.content.intro_title}</h2>
              <p className={styles.bodyText}>{content.content.intro_body_1}</p>
              <p className={styles.bodyText}>{content.content.intro_body_2}</p>
              <p className={styles.bodyTextLast}>{content.content.intro_body_3}</p>
            </>
          )}
        </article>

        <aside className={styles.imageCard}>
          <Image
            src="/om-lager.png"
            alt="Læssemaskine og lastbiler i saltlager"
            width={1152}
            height={768}
            className={styles.image}
          />
          <div className={styles.imageOverlay} />
          <div className={styles.imageCaption}>
            {isEditing ? (
              <>
                <div className={styles.captionTitle}>
                  <EditableField
                    as="input"
                    contentKey="caption_title"
                    isEditing={isEditing}
                    label="Om: billedtitel"
                    page="om"
                    returnPath={returnPath}
                    value={content.content.caption_title}
                  />
                </div>
                <div className={styles.captionText}>
                  <EditableField
                    contentKey="caption_body"
                    isEditing={isEditing}
                    label="Om: billedtekst"
                    page="om"
                    returnPath={returnPath}
                    value={content.content.caption_body}
                  />
                </div>
              </>
            ) : (
              <>
                <p className={styles.captionTitle}>{content.content.caption_title}</p>
                <p className={styles.captionText}>{content.content.caption_body}</p>
              </>
            )}
          </div>
        </aside>
      </section>

      <section className={styles.card}>
        {isEditing ? (
          <div className={styles.sectionTitle}>
            <EditableField
              as="input"
              contentKey="reasons_heading"
              isEditing={isEditing}
              label="Om: grunde overskrift"
              page="om"
              returnPath={returnPath}
              value={content.content.reasons_heading}
            />
          </div>
        ) : (
          <h2 className={styles.sectionTitle}>{content.content.reasons_heading}</h2>
        )}

        <div className={styles.reasonsGrid}>
          <div>
            {isEditing ? (
              <>
                <div className={styles.reasonTitle}>
                  <EditableField as="input" contentKey="reason_1_title" isEditing={isEditing} label="Om: grund 1 titel" page="om" returnPath={returnPath} value={content.content.reason_1_title} />
                </div>
                <div className={styles.reasonText}>
                  <EditableField contentKey="reason_1_body" isEditing={isEditing} label="Om: grund 1 tekst" page="om" returnPath={returnPath} value={content.content.reason_1_body} />
                </div>
              </>
            ) : (
              <>
                <p className={styles.reasonTitle}>{content.content.reason_1_title}</p>
                <p className={styles.reasonText}>{content.content.reason_1_body}</p>
              </>
            )}
          </div>

          <div>
            {isEditing ? (
              <>
                <div className={styles.reasonTitle}>
                  <EditableField as="input" contentKey="reason_2_title" isEditing={isEditing} label="Om: grund 2 titel" page="om" returnPath={returnPath} value={content.content.reason_2_title} />
                </div>
                <div className={styles.reasonText}>
                  <EditableField contentKey="reason_2_body" isEditing={isEditing} label="Om: grund 2 tekst" page="om" returnPath={returnPath} value={content.content.reason_2_body} />
                </div>
              </>
            ) : (
              <>
                <p className={styles.reasonTitle}>{content.content.reason_2_title}</p>
                <p className={styles.reasonText}>{content.content.reason_2_body}</p>
              </>
            )}
          </div>

          <div>
            {isEditing ? (
              <>
                <div className={styles.reasonTitle}>
                  <EditableField as="input" contentKey="reason_3_title" isEditing={isEditing} label="Om: grund 3 titel" page="om" returnPath={returnPath} value={content.content.reason_3_title} />
                </div>
                <div className={styles.reasonText}>
                  <EditableField contentKey="reason_3_body" isEditing={isEditing} label="Om: grund 3 tekst" page="om" returnPath={returnPath} value={content.content.reason_3_body} />
                </div>
              </>
            ) : (
              <>
                <p className={styles.reasonTitle}>{content.content.reason_3_title}</p>
                <p className={styles.reasonText}>{content.content.reason_3_body}</p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
    </>
  );
}
