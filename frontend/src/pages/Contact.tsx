import { Link } from "react-router-dom";

export default function Contact() {
  return (
    <>
      <header style={{ marginBottom: 40 }}>
        <h1>Contact</h1>
        <p className="subtitle">Let’s discuss your project or idea.</p>
      </header>

      <div className="cards">
        {/* EMAIL CARD */}
        <div className="card">
          <h3>Email</h3>
          <p>You can reach me directly at:</p>
          <p>
            <a href="mailto:rajkirant@live.com" style={{ fontWeight: 600 }}>
              rajkirant@live.com
            </a>
          </p>
        </div>

        {/* RESPONSE TIME CARD */}
        <div className="card">
          <h3>Response Time</h3>
          <p>I usually respond within 24 hours on business days.</p>
        </div>

        {/* WORK TYPES CARD */}
        <div className="card">
          <h3>Available For</h3>
          <ul>
            <li>Freelance projects</li>
            <li>Contract work</li>
            <li>Technical consulting</li>
          </ul>
        </div>
      </div>
    </>
  );
}
