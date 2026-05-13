import { GameShell } from "@/components/GameShell";
import { SITE_DESCRIPTION, SITE_NAME, structuredData } from "./seo";

export default function Home() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c")
        }}
        type="application/ld+json"
      />
      <section aria-label={`About ${SITE_NAME}`} className="sr-only">
        <h2>{SITE_NAME}</h2>
        <p>{SITE_DESCRIPTION}</p>
      </section>
      <GameShell />
    </>
  );
}
