import type { AuthUser } from "./middleware/auth.js";

export type Env = {
  Variables: {
    user: AuthUser;
  };
};
