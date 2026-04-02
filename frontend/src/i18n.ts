import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      nav: {
        home: "Home",
        about: "About",
        login: "Login",
        signup: "Sign up",
        logout: "Logout",
        allCategories: "All Categories",
        greeting: "Hi, {{name}}",
      },
      footer: {
        about: "About",
        privacy: "Privacy Policy",
        terms: "Terms of Service",
        rights: "All rights reserved.",
      },
      home: {
        heroTitle: "Free Online Tools,",
        heroHighlight: "Zero Nonsense",
        heroPillars: {
          privacy: "Privacy-first",
          offline: "Works offline",
          openSource: "Open source",
          ai: "AI-powered",
        },
        searchPlaceholder: "Search tools by name, description, or keyword",
        offlineTitle: "Limited offline mode",
        offlineBody:
          "You're offline. Only tools that support offline usage are available right now.",
        noOfflineMatch: "No offline tools match your search.",
        noOfflineTools: "No tools are available offline yet.",
        loadMore: "Load more",
        noToolsInCategory: "No tools match your search in this category.",
        noServicesFound: "No services found. Add entries to",
      },
      tool: {
        showAdvanced: "Show advanced options",
        howToUse: "How to use",
        faqs: "Frequently asked questions",
        back: "Back",
      },
      notFound: {
        title: "Page not found",
        body: "The page you’re looking for doesn’t exist or may have been moved.",
        backHome: "Go back home",
      },
      chat: {
        title: "AI Tool Assistant",
        subtitle: "Ask by category, feature, or tool name",
        placeholder: "Ask about a tool...",
        suggestions: {
          one: "What does this tool do?",
          two: "Which tool should I use for invoices?",
          three: "Which tools work offline?",
        },
        greeting:
          "Hi, I can explain Torensa tools in simple terms. Ask me anything.",
        unavailable: "Assistant is unavailable right now.",
        noAnswer: "I couldn't generate an answer right now.",
        networkError: "Network error. Please try again.",
      },
    },
  },
  de: {
    translation: {
      nav: {
        home: "Startseite",
        about: "Über uns",
        login: "Anmelden",
        signup: "Registrieren",
        logout: "Abmelden",
        allCategories: "Alle Kategorien",
        greeting: "Hallo, {{name}}",
      },
      footer: {
        about: "Über uns",
        privacy: "Datenschutz",
        terms: "Nutzungsbedingungen",
        rights: "Alle Rechte vorbehalten.",
      },
      home: {
        heroTitle: "Kostenlose Online‑Tools,",
        heroHighlight: "ohne Schnickschnack",
        heroPillars: {
          privacy: "Datenschutz zuerst",
          offline: "Offline nutzbar",
          openSource: "Open Source",
          ai: "KI‑gestützt",
        },
        searchPlaceholder: "Tools nach Name, Beschreibung oder Keyword suchen",
        offlineTitle: "Eingeschränkter Offline‑Modus",
        offlineBody:
          "Sie sind offline. Nur Tools mit Offline‑Unterstützung sind verfügbar.",
        noOfflineMatch: "Keine Offline‑Tools passen zu Ihrer Suche.",
        noOfflineTools: "Noch keine Tools offline verfügbar.",
        loadMore: "Mehr laden",
        noToolsInCategory: "Keine Tools passen zu Ihrer Suche in dieser Kategorie.",
        noServicesFound: "Keine Services gefunden. Fügen Sie Einträge hinzu in",
      },
      tool: {
        showAdvanced: "Erweiterte Optionen anzeigen",
        howToUse: "So funktioniert’s",
        faqs: "Häufige Fragen",
        back: "Zurück",
      },
      notFound: {
        title: "Seite nicht gefunden",
        body: "Die Seite existiert nicht oder wurde verschoben.",
        backHome: "Zur Startseite",
      },
      chat: {
        title: "KI‑Tool‑Assistent",
        subtitle: "Fragen Sie nach Kategorie, Funktion oder Tool‑Name",
        placeholder: "Fragen Sie nach einem Tool…",
        suggestions: {
          one: "Was macht dieses Tool?",
          two: "Welches Tool eignet sich für Rechnungen?",
          three: "Welche Tools funktionieren offline?",
        },
        greeting:
          "Hi, ich erkläre Torensa‑Tools in einfachen Worten. Frag mich gern.",
        unavailable: "Assistent ist gerade nicht verfügbar.",
        noAnswer: "Ich konnte gerade keine Antwort erzeugen.",
        networkError: "Netzwerkfehler. Bitte erneut versuchen.",
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
