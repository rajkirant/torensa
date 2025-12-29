import { Routes, Route, Link } from "react-router-dom";
import Contact from "./Contact";

export default function App() {
  return (
    <div className="container">
      {/* simple test nav */}
      <div style={{ textAlign: "right", marginBottom: 20 }}>
        <Link to="/contact">Contact</Link>
      </div>

      <Routes>
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

              {/* CONTACT SECTION (home anchor still works) */}
              <section id="contact">
                <h2>Contact</h2>
                <div className="card">
                  <p>
                    Email:{" "}
                    <a href="mailto:admin@torensa.com">admin@torensa.com</a>
                  </p>
                </div>
              </section>
            </>
          }
        />

        <Route path="/contact" element={<Contact />} />
      </Routes>

      <footer className="footer">© {new Date().getFullYear()} Torensa</footer>
    </div>
  );
}
