import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiFetch } from "./utils/api";
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

  const fetchedRef = useRef<boolean>(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // ✅ If no cookies at all, skip /me call
    if (document.cookie.length === 0) {
      setLoading(false);
      return;
    }

    const run = () => {
      apiFetch("/api/me/", {
        credentials: "include",
      })
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

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(run);
    } else {
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
