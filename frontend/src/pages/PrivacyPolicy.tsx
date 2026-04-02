import { usePageDescriptions } from "../utils/language";

export default function PrivacyPolicy() {
  const { privacy: desc } = usePageDescriptions();

  return (
    <>
      <header style={{ marginBottom: 40 }}>
        <h1>Privacy Policy</h1>
        <p className="subtitle">Last updated: March 11, 2026</p>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", lineHeight: 1.8 }}>
        <section style={{ marginBottom: 32 }}>
          <h2>Introduction</h2>
          <p>{desc.introduction}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Information We Collect</h2>
          <h3>Automatically Collected Information</h3>
          <p>{desc.automaticallyCollected}</p>
          <h3>Account Information</h3>
          <p>{desc.accountInfo}</p>
          <h3>Tool Usage</h3>
          <p>{desc.toolUsage}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Cookies</h2>
          <p>{desc.cookies}</p>
          <ul>
            <li>
              <strong>Essential cookies:</strong> Required for authentication
              and CSRF protection.
            </li>
            <li>
              <strong>Analytics cookies:</strong> Google Analytics uses cookies
              to collect anonymous usage data.
            </li>
            <li>
              <strong>Advertising cookies:</strong> Google AdSense may use
              cookies to serve personalized ads based on your browsing history.
              You can opt out of personalized advertising at{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#4fd1c5" }}
              >
                Google Ads Settings
              </a>
              .
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Third-Party Services</h2>
          <p>{desc.thirdPartyServices}</p>
          <ul>
            <li>
              <strong>Google Analytics</strong> — for website traffic analysis.
              See{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#4fd1c5" }}
              >
                Google&apos;s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Google AdSense</strong> — for serving advertisements. See{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#4fd1c5" }}
              >
                How Google uses data when you use our partners&apos; sites
              </a>
              .
            </li>
            <li>
              <strong>AWS (Amazon Web Services)</strong> — for hosting and
              server-side processing.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Data Retention</h2>
          <p>{desc.dataRetention}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Your Rights</h2>
          <p>{desc.yourRights}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Children&apos;s Privacy</h2>
          <p>{desc.childrensPrivacy}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Changes to This Policy</h2>
          <p>{desc.changesToPolicy}</p>
        </section>

        <section>
          <h2>Contact Us</h2>
          <p>{desc.contactUs}</p>
        </section>
      </div>
    </>
  );
}
