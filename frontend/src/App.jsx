export default function App() {
  return (
    <div className="container">
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

      {/* ABOUT */}
      <section>
        <h2>About Me</h2>
        <p>
          I am a full-stack software developer specialising in modern web
          technologies. I help startups and businesses turn ideas into
          production-ready software.
        </p>
      </section>

      {/* SERVICES */}
      <section>
        <h2>Services</h2>
        <div className="cards">
          <div className="card">
            <h3>Web Development</h3>
            <p>
              Responsive, high-performance web applications using React and
              modern frontend tooling.
            </p>
          </div>
          <div className="card">
            <h3>Backend APIs</h3>
            <p>
              Secure and scalable APIs using Java, Spring Boot, and REST or
              GraphQL.
            </p>
          </div>
          <div className="card">
            <h3>Deployment & DevOps</h3>
            <p>
              Dockerised applications, CI/CD pipelines, and cloud deployments.
            </p>
          </div>
        </div>
      </section>

      {/* SKILLS */}
      <section>
        <h2>Skills</h2>
        <ul className="skills">
          <li>React, Vite</li>
          <li>Java, Spring Boot</li>
          <li>REST, GraphQL</li>
          <li>Docker, CI/CD</li>
          <li>Cloud & Linux</li>
        </ul>
      </section>

      {/* PORTFOLIO */}
      <section>
        <h2>Projects</h2>
        <div className="cards">
          <div className="card">
            <h3>Business Web Platform</h3>
            <p>
              Full-stack web application with authentication, dashboards, and
              API integrations.
            </p>
          </div>
          <div className="card">
            <h3>Internal Admin Tool</h3>
            <p>Secure admin interface for managing users, data, and reports.</p>
          </div>
          <div className="card">
            <h3>Automation & Integrations</h3>
            <p>
              Backend services integrating third-party APIs and automating
              workflows.
            </p>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE ME */}
      <section>
        <h2>Why Choose Me</h2>
        <ul>
          <li>Clear communication and realistic timelines</li>
          <li>Clean, maintainable code</li>
          <li>Focus on long-term value, not quick hacks</li>
        </ul>
      </section>

      {/* CONTACT */}
      <section id="contact">
        <h2>Contact</h2>
        <p>
          Email: <strong>contact@torensa.com</strong>
        </p>
        <p>Available for freelance and contract opportunities.</p>
      </section>

      <footer className="footer">
        © {new Date().getFullYear()} Torensa. All rights reserved.
      </footer>
    </div>
  );
}
