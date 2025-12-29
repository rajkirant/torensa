export default function App() {
  return (
    <div className="container">
      <header className="header">
        <h1>Torensa</h1>
        <p>Freelance Software Developer</p>
      </header>

      <section>
        <h2>About</h2>
        <p>
          I build reliable web applications using React, Java, and Spring Boot.
          Available for freelance and contract work.
        </p>
      </section>

      <section>
        <h2>Services</h2>
        <ul>
          <li>Web application development</li>
          <li>Backend APIs and integrations</li>
          <li>Cloud deployment and maintenance</li>
        </ul>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Email: contact@torensa.com</p>
      </section>

      <footer className="footer">© {new Date().getFullYear()} Torensa</footer>
    </div>
  );
}
