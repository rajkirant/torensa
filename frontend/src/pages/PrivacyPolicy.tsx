import { useTranslation } from "react-i18next";
import { usePageDescriptions } from "../utils/language";

export default function PrivacyPolicy() {
  const { privacy: desc } = usePageDescriptions();
  const { t } = useTranslation();

  return (
    <>
      <header style={{ marginBottom: 40 }}>
        <h1>{t("privacy.title")}</h1>
        <p className="subtitle">{t("privacy.lastUpdated")}</p>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", lineHeight: 1.8 }}>
        <section style={{ marginBottom: 32 }}>
          <h2>{t("privacy.introduction")}</h2>
          <p>{desc.introduction}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("privacy.infoWeCollect")}</h2>
          <h3>{t("privacy.autoCollected")}</h3>
          <p>{desc.automaticallyCollected}</p>
          <h3>{t("privacy.accountInfo")}</h3>
          <p>{desc.accountInfo}</p>
          <h3>{t("privacy.toolUsage")}</h3>
          <p>{desc.toolUsage}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("privacy.cookies")}</h2>
          <p>{desc.cookies}</p>
          <ul>
            <li>
              <strong>{t("privacy.essentialCookies")}</strong>{" "}
              {t("privacy.essentialCookiesDesc")}
            </li>
            <li>
              <strong>{t("privacy.analyticsCookies")}</strong>{" "}
              {t("privacy.analyticsCookiesDesc")}
            </li>
            <li>
              <strong>{t("privacy.adCookies")}</strong>{" "}
              {t("privacy.adCookiesDesc")}{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#4fd1c5" }}
              >
                {t("privacy.googleAdsSettings")}
              </a>
              .
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("privacy.thirdPartyServices")}</h2>
          <p>{desc.thirdPartyServices}</p>
          <ul>
            <li>
              <strong>Google Analytics</strong> —{" "}
              {t("privacy.googleAnalyticsDesc")}{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#4fd1c5" }}
              >
                {t("privacy.googlePrivacyPolicy")}
              </a>
              .
            </li>
            <li>
              <strong>Google AdSense</strong> —{" "}
              {t("privacy.googleAdSenseDesc")}{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#4fd1c5" }}
              >
                {t("privacy.googleAdSenseLink")}
              </a>
              .
            </li>
            <li>
              <strong>AWS (Amazon Web Services)</strong> —{" "}
              {t("privacy.awsDesc")}
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("privacy.dataRetention")}</h2>
          <p>{desc.dataRetention}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("privacy.yourRights")}</h2>
          <p>{desc.yourRights}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("privacy.childrensPrivacy")}</h2>
          <p>{desc.childrensPrivacy}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>{t("privacy.changesToPolicy")}</h2>
          <p>{desc.changesToPolicy}</p>
        </section>

        <section>
          <h2>{t("privacy.contactUs")}</h2>
          <p>{desc.contactUs}</p>
        </section>
      </div>
    </>
  );
}
