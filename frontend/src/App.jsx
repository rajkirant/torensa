export default function App() {
  return (
    <div className="container">
      {/* HERO */}
      <header className="hero">
        <h1>Torensa</h1>
        <p className="subtitle">Freelance Software Developer</p>
        <p className="tagline">
          I build scalable web applications using React and Spring Boot.
        </p>
        <a href="#contact" className="cta">
          Contact Me
        </a>
      </header>

      {/* ABOUT */}
      <section>
        <h2>About Me</h2>
        <p>
          I am a full-stack software developer with experience building
          production-ready applications for clients and enterprises. I focus on
          clean architecture, performance, and long-term maintainability.
        </p>
      </section>

      {/* SKILLS */}
      <section>
        <h2>Skills</h2>
        <ul className="skills">
          <li>React, Vite</li>
          <li>Java, Spring Boot</li>
          <li>REST APIs, GraphQL</li>
          <li>Docker, CI/CD</li>
          <li>Cloud Deployment</li>
        </ul>
      </section>

      {/* CONTACT */}
      <section id="contact">
        <h2>Contact</h2>
        <p>
          Email: <strong>contact@torensa.com</strong>
        </p>
      </section>

      <footer className="footer">© {new Date().getFullYear()} Torensa</footer>
    </div>
  );
}
