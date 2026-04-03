import { useTranslation } from "react-i18next";
import { usePageDescriptions } from "../utils/language";

export default function TermsOfService() {
  const { terms: desc } = usePageDescriptions();
  const { t } = useTranslation();

  return (
    <>
      <header style={{ marginBottom: 40 }}>
        <h1>{t("terms.title")}</h1>
        <p className="subtitle">{t("terms.lastUpdated")}</p>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", lineHeight: 1.8 }}>
        <section style={{ marginBottom: 32 }}>
          <h2>{t("terms.acceptance")}</h2>
          <p>{desc.acceptance}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("terms.descriptionOfService")}</h2>
          <p>{desc.descriptionOfService}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("terms.userAccounts")}</h2>
          <p>{desc.userAccounts}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("terms.acceptableUse")}</h2>
          <p>{desc.acceptableUse}</p>
          <ul>
            {(t("terms.acceptableUseItems", { returnObjects: true }) as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("terms.intellectualProperty")}</h2>
          <p>{desc.intellectualProperty}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("terms.privacy")}</h2>
          <p>{desc.privacySection}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("terms.disclaimerOfWarranties")}</h2>
          <p>{desc.disclaimerOfWarranties}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("terms.limitationOfLiability")}</h2>
          <p>{desc.limitationOfLiability}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("terms.modifications")}</h2>
          <p>{desc.modifications}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("terms.termination")}</h2>
          <p>{desc.termination}</p>
        </section>

        <section>
          <h2>{t("terms.contact")}</h2>
          <p>{desc.contact}</p>
        </section>
      </div>
    </>
  );
}
