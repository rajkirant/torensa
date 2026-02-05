import { Link } from "react-router-dom";

export default function Contact() {
  return (
    <>
      <header style={{ marginBottom: 40 }}>
        {/* PROFILE IMAGE */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img
            src="/me.webp"
            alt="Raj Kiran"
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #ddd",
            }}
          />
        </div>

        <h1>About & Contact</h1>

        <p className="subtitle">
          Hi, I’m Raj Kiran - a full-stack software developer building simple,
          useful, and open-source online tools for developers and learners.
        </p>

        <p style={{ maxWidth: 700, margin: "0 auto", marginTop: 15 }}>
          <strong>Mission:</strong> To create a growing collection of
          lightweight, privacy-friendly web utilities that help people solve
          everyday technical problems - freely and transparently through
          open-source software. Most tools on this website are designed to be
          offline-ready whenever possible, reducing unnecessary data usage,
          protecting user privacy, and supporting a more environmentally
          friendly web.
        </p>
      </header>

      <div className="cards">
        {/* EMAIL CARD */}
        <div className="card">
          <h3>Email</h3>
          <p>
            Feel free to reach out if you'd like to share feedback, collaborate,
            or discuss good ideas around open-source tools.
          </p>

          <p>
            <a
              href="mailto:admin@torensa.com"
              style={{
                fontWeight: 600,
                color: "#4fd1c5", // accessible teal
                textDecoration: "underline",
              }}
            >
              admin@torensa.com
            </a>
          </p>
        </div>

        {/* OPEN SOURCE CARD */}
        <div className="card">
          <h3>Open Source</h3>
          <p>
            This website is maintained as an open-source project, with the goal
            of sharing helpful tools and clean engineering practices.
          </p>
        </div>

        {/* RESPONSE TIME CARD */}
        <div className="card">
          <h3>Response Time</h3>
          <p>I usually reply within 24 hours on weekdays.</p>
        </div>
      </div>
    </>
  );
}
