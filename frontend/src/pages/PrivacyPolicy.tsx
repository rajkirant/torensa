export default function PrivacyPolicy() {
  return (
    <>
      <header style={{ marginBottom: 40 }}>
        <h1>Privacy Policy</h1>
        <p className="subtitle">Last updated: March 10, 2026</p>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", lineHeight: 1.8 }}>
        <section style={{ marginBottom: 32 }}>
          <h2>Introduction</h2>
          <p>
            Torensa (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
            operates the website{" "}
            <a href="https://torensa.com" style={{ color: "#4fd1c5" }}>
              torensa.com
            </a>
            . This Privacy Policy explains how we collect, use, and protect
            information when you visit our website.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Information We Collect</h2>
          <h3>Automatically Collected Information</h3>
          <p>
            When you visit our website, we may automatically collect certain
            information through Google Analytics, including your IP address,
            browser type, operating system, referring URLs, pages visited, and
            timestamps. This data helps us understand how visitors use our site
            and improve the user experience.
          </p>
          <h3>Account Information</h3>
          <p>
            If you create an account, we collect your username, email address,
            and password (stored in hashed form). This information is used
            solely for authentication and access to tools that require login.
          </p>
          <h3>Tool Usage</h3>
          <p>
            Many of our tools process data entirely in your browser and do not
            send any data to our servers. For tools that require server-side
            processing (such as background removal or document conversion),
            files are processed in memory and are not stored after the response
            is returned.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Cookies</h2>
          <p>We use the following types of cookies:</p>
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
          <p>We use the following third-party services:</p>
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
          <p>
            We do not store files or tool processing data. Account information
            is retained until you request deletion. Analytics data is governed
            by Google Analytics&apos; retention policies.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Your Rights</h2>
          <p>
            Depending on your location, you may have the right to access,
            correct, or delete your personal data. To exercise these rights,
            contact us at{" "}
            <a href="mailto:admin@torensa.com" style={{ color: "#4fd1c5" }}>
              admin@torensa.com
            </a>
            .
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Children&apos;s Privacy</h2>
          <p>
            Our website is not directed at children under 13. We do not
            knowingly collect personal information from children.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be
            posted on this page with an updated revision date.
          </p>
        </section>

        <section>
          <h2>Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, email us at{" "}
            <a href="mailto:admin@torensa.com" style={{ color: "#4fd1c5" }}>
              admin@torensa.com
            </a>
            .
          </p>
        </section>
      </div>
    </>
  );
}
