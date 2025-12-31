import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type User = {
  id: number;
  username: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const fetched = useRef<boolean>(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

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
