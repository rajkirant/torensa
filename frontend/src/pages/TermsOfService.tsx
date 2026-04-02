import { usePageDescriptions } from "../utils/language";

export default function TermsOfService() {
  const { terms: desc } = usePageDescriptions();

  return (
    <>
      <header style={{ marginBottom: 40 }}>
        <h1>Terms of Service</h1>
        <p className="subtitle">Last updated: March 10, 2026</p>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", lineHeight: 1.8 }}>
        <section style={{ marginBottom: 32 }}>
          <h2>Acceptance of Terms</h2>
          <p>{desc.acceptance}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Description of Service</h2>
          <p>{desc.descriptionOfService}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>User Accounts</h2>
          <p>{desc.userAccounts}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Acceptable Use</h2>
          <p>{desc.acceptableUse}</p>
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
          <p>{desc.intellectualProperty}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Privacy</h2>
          <p>{desc.privacySection}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Disclaimer of Warranties</h2>
          <p>{desc.disclaimerOfWarranties}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Limitation of Liability</h2>
          <p>{desc.limitationOfLiability}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Modifications</h2>
          <p>{desc.modifications}</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Termination</h2>
          <p>{desc.termination}</p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>{desc.contact}</p>
        </section>
      </div>
    </>
  );
}
