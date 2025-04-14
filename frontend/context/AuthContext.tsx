// import { createContext } from "react";
// export default createContext();

import { createContext } from "react";

interface AuthContextType {
  user: null | { id: string; name: string; email: string };
  setUser: (user: null | { id: string; name: string; email: string }) => void;
  logout: () => Promise<void>; // Add logout function to context
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: async () => {} // Default empty async function
});

export default AuthContext;