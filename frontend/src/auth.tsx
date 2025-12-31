import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/* =========================
   Types
   ========================= */

export type User = {
  id: number;
  username: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
};

/* =========================
   Context
   ========================= */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* =========================
   Provider
   ========================= */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 🔒 Prevent duplicate calls (React StrictMode safe)
  const fetchedRef = useRef<boolean>(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // ⏳ Defer auth check so it doesn't block initial render
    const run = () => {
      fetch("/api/me/", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setUser(data?.user ?? null);
          setLoading(false);
        })
        .catch(() => {
          setUser(null);
          setLoading(false);
        });
    };

    // Prefer idle time if available (best for performance)
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(run);
    } else {
      // Fallback for older browsers
      setTimeout(run, 0);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

/* =========================
   Hook
   ========================= */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
