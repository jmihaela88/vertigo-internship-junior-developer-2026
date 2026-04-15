import { createContext, useContext, useEffect, useState } from "react";
import { User } from "./api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user from localStorage on mount
    const token = localStorage.getItem("auth_token");
    const userData = localStorage.getItem("auth_user");

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser({ ...parsedUser, role: parsedUser.role || "user", token });
      } catch {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
      }
    }

    setIsLoading(false);
  }, []);

  const login = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem("auth_token", newUser.token);
    const { token, ...storedUser } = newUser;
    localStorage.setItem("auth_user", JSON.stringify(storedUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
