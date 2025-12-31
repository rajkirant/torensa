import { Routes, Route, Link } from "react-router-dom";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import { useAuth } from "./auth";
import Button from "@mui/material/Button";

export default function App() {
  const { user, loading, setUser } = useAuth();
  return (
    <div className="container">
      {/* NAV (always visible) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 40,
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--primary)",
            textDecoration: "none",
          }}
        >
          Torensa
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link to="/">Home</Link>
          <Link to="/contact">Contact</Link>

          {!loading &&
            (user ? (
              <span>
                Hi, <strong>{user.username}</strong>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ ml: 1.5 }}
                  onClick={async () => {
                    await fetch("/api/logout/", {
                      method: "POST",
                      credentials: "include",
                    });
                    setUser(null);
                  }}
                >
                  Logout
                </Button>
              </span>
            ) : (
              <Link to="/login">Login</Link>
            ))}
        </div>
      </div>

      {/* ROUTES */}
      <Routes>
        {/* HOME PAGE */}
        <Route
          path="/"
          element={
            <>
              {/* HERO */}
              <header className="hero">
                <h1>Torensa</h1>
                <p className="subtitle">Freelance Software Developer</p>
                <p className="tagline">
                  Building scalable, secure, and maintainable web applications.
                </p>
                <a href="#contact" className="cta">
                  Contact Me
                </a>
              </header>

              {/* SERVICES */}
              <section>
                <h2>Services</h2>
                <div className="cards">
                  <div className="card">
                    <h3>Web Development</h3>
                    <p>
                      Responsive, high-performance web applications using React
                      and modern frontend tooling.
                    </p>
                  </div>
                  <div className="card">
                    <h3>Backend APIs</h3>
                    <p>
                      Secure and scalable APIs using Java, Spring Boot, and REST
                      or GraphQL.
                    </p>
                  </div>
                  <div className="card">
                    <h3>Deployment & DevOps</h3>
                    <p>
                      Dockerised applications, CI/CD pipelines, and cloud
                      deployments.
                    </p>
                  </div>
                </div>
              </section>

              {/* SKILLS */}
              <section>
                <h2>Skills</h2>
                <ul className="skills">
                  <li>React</li>
                  <li>TypeScript</li>
                  <li>Vite</li>
                  <li>Java</li>
                  <li>Spring Boot</li>
                  <li>Docker</li>
                </ul>
              </section>
            </>
          }
        />

        {/* CONTACT PAGE */}
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
      </Routes>

      <footer
        className="footer"
        style={{
          marginTop: 80,
          paddingTop: 40,
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 30,
          }}
        >
          {/* BRAND */}
          <div>
            <h3 style={{ marginBottom: 10, color: "var(--primary)" }}>
              Torensa
            </h3>
            <p>
              Freelance software developer building scalable and maintainable
              web applications.
            </p>
          </div>

          {/* NAVIGATION */}
          <div>
            <h4>Navigation</h4>
            <ul style={{ listStyle: "none", padding: 0 }}>
              <li>
                <a href="#/" style={{ textDecoration: "none" }}>
                  Home
                </a>
              </li>
              <li>
                <a href="#/contact" style={{ textDecoration: "none" }}>
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* CONTACT */}
          <div>
            <h4>Contact</h4>

            <p>
              Email:
              <br />
              <a href="mailto:admin@torensa.com">admin@torensa.com</a>
            </p>

            <p style={{ marginTop: 10 }}>
              LinkedIn:
              <br />
              <a
                href="https://www.linkedin.com/in/rajkirant/"
                target="_blank"
                rel="noopener noreferrer"
              >
                linkedin.com/in/rajkirant
              </a>
            </p>

            <p style={{ marginTop: 10 }}>Based in the UK · Remote friendly</p>
          </div>
        </div>

        {/* COPYRIGHT */}
        <div
          style={{
            marginTop: 40,
            fontSize: 14,
            color: "#6b7280",
            textAlign: "center",
          }}
        >
          © {new Date().getFullYear()} Torensa. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
