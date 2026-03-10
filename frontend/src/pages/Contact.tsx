import { Link } from "react-router-dom";
import missionData from "../metadata/mission.json";
import contactData from "../metadata/contact.json";

type MissionData = {
  subtitle: string;
  mission: string;
};

type ContactData = {
  email: {
    address: string;
    intro: string;
  };
  openSource: string;
  responseTime: string;
};

export default function Contact() {
  const mission = missionData as MissionData;
  const contact = contactData as ContactData;

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

        <h1>About Us</h1>

        <p className="subtitle">{mission.subtitle}</p>

        <p style={{ maxWidth: 700, margin: "0 auto", marginTop: 15 }}>
          <strong>Mission:</strong> {mission.mission}
        </p>
      </header>

      <div className="cards">
        {/* EMAIL CARD */}
        <div className="card">
          <h3>Contact Us</h3>
          <p>{contact.email.intro}</p>

          <p>
            <a
              href={`mailto:${contact.email.address}`}
              style={{
                fontWeight: 600,
                color: "#4fd1c5",
                textDecoration: "underline",
              }}
            >
              {contact.email.address}
            </a>
          </p>
        </div>

        <div className="card">
          <h3>Open Source</h3>
          <p>{contact.openSource}</p>
        </div>
        <div className="card">
          <h3>Response Time</h3>
          <p>{contact.responseTime}</p>
        </div>
      </div>

      <div
        style={{
          maxWidth: 800,
          margin: "40px auto 0",
          textAlign: "center",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <Link to="/privacy" style={{ color: "#4fd1c5", marginRight: 20 }}>
          Privacy Policy
        </Link>
        <Link to="/terms" style={{ color: "#4fd1c5" }}>
          Terms of Service
        </Link>
      </div>
    </>
  );
}
