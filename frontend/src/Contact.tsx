import { Link } from "react-router-dom";

export default function Contact() {
  return (
    <section>
      {/* back link */}
      <div style={{ marginBottom: 20 }}>
        <Link to="/">← Back to Home</Link>
      </div>

      <h2>Contact Page</h2>

      <div className="card">
        <p>
          Email: <a href="mailto:admin@torensa.com">admin@torensa.com</a>
        </p>
      </div>
    </section>
  );
}
