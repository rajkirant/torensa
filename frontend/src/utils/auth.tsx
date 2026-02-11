import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiFetch } from "./api";
import { setCsrfToken } from "./csrf";
/* =========================
   Types
   ========================= */

export type User = {
  id: number;
  username: string;
  email: string;
};

type MeResponse = {
  csrfToken?: string;
  user?: User | null;
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
  const [loading, setLoading] = useState<boolean>(false);

  const fetchedRef = useRef<boolean>(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const run = () => {
      apiFetch("/api/me/", {
        credentials: "include",
      })
        .then((res) => (res.ok ? (res.json() as Promise<MeResponse>) : null))
        .then((data) => {
          if (data?.csrfToken) {
            setCsrfToken(data.csrfToken);
          }
          setUser(data?.user ?? null);
        })
        .catch(() => {
          setUser(null);
        })
        .finally(() => {
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
