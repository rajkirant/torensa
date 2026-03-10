export default function TermsOfService() {
  return (
    <>
      <header style={{ marginBottom: 40 }}>
        <h1>Terms of Service</h1>
        <p className="subtitle">Last updated: March 10, 2026</p>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", lineHeight: 1.8 }}>
        <section style={{ marginBottom: 32 }}>
          <h2>Acceptance of Terms</h2>
          <p>
            By accessing or using Torensa (
            <a href="https://torensa.com" style={{ color: "#4fd1c5" }}>
              torensa.com
            </a>
            ), you agree to be bound by these Terms of Service. If you do not
            agree to these terms, please do not use the website.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Description of Service</h2>
          <p>
            Torensa provides a collection of free online tools for productivity,
            document processing, image editing, and developer utilities. Many
            tools run entirely in your browser; some require server-side
            processing.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>User Accounts</h2>
          <p>
            Certain tools require you to create an account. You are responsible
            for maintaining the confidentiality of your login credentials and
            for all activities that occur under your account. You must notify us
            immediately of any unauthorized use.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>
              Use the service for any unlawful purpose or in violation of any
              applicable laws or regulations.
            </li>
            <li>
              Attempt to gain unauthorized access to any part of the service,
              other users&apos; accounts, or related systems.
            </li>
            <li>
              Upload malicious files or content designed to disrupt, damage, or
              interfere with the service.
            </li>
            <li>
              Scrape, crawl, or use automated tools to access the service in a
              manner that exceeds reasonable use.
            </li>
            <li>
              Redistribute, resell, or commercially exploit the service without
              permission.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Intellectual Property</h2>
          <p>
            Torensa is an open-source project. The source code is available
            under its respective license on GitHub. You retain ownership of any
            content you create using our tools. We do not claim rights over
            files you upload or outputs you generate.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Privacy</h2>
          <p>
            Your use of the service is also governed by our{" "}
            <a href="/privacy" style={{ color: "#4fd1c5" }}>
              Privacy Policy
            </a>
            , which describes how we collect, use, and protect your information.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Disclaimer of Warranties</h2>
          <p>
            The service is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, either express or
            implied. We do not guarantee that the service will be uninterrupted,
            error-free, or free of harmful components. Use the tools at your own
            risk.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Torensa and its maintainers
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or any loss of profits or
            revenue arising from your use of the service.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Modifications</h2>
          <p>
            We reserve the right to modify or discontinue the service (or any
            part of it) at any time without notice. We may also update these
            Terms of Service from time to time. Continued use of the service
            after changes constitutes acceptance of the updated terms.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Termination</h2>
          <p>
            We may suspend or terminate your access to the service at our
            discretion, without prior notice, if you violate these terms or
            engage in conduct that we determine to be harmful to the service or
            other users.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            If you have questions about these Terms of Service, email us at{" "}
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
