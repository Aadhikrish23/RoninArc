import api from "../../../shared/api/axiosInstance";
import type { LoginSuccess, RegisterSuccess } from "../types/auth";


const userLogin = async (email: string, password: string): Promise<LoginSuccess> => {
  const res = await api.post<{ Status: string; Data: LoginSuccess }>("auth/login", {
    email: email.trim(),
    password: password.trim(),
  });
  return res.data.Data;
};

/** Sign up: the name is only shown in the app; you sign in with the email. */
const userSignup = async (displayName: string, email: string, password: string): Promise<RegisterSuccess> => {
  const res = await api.post<{ Status: string; Data: RegisterSuccess }>("auth/register", {
    displayName: displayName.trim(),
    email: email.trim(),
    password: password.trim(),
  });
  return res.data.Data;
};

/** An account from before email sign-in adds its email (the password confirms it). */
const setEmail = async (email: string, password: string) =>
  (await api.patch<{ Status: string; Data: { name: string; displayName: string; email: string | null } }>("auth/email", { email: email.trim(), password })).data.Data;

/** The signed-in account, including whether it still needs an email. */
const me = async () =>
  (await api.get<{ Status: string; Data: { id: string; displayName: string; email: string | null; needsEmail: boolean } }>("auth/me")).data.Data;

const logoutUser = async (refreshToken: string) => {
  return api.post("auth/logout", {
    refreshToken,
  });
};
const refreshAccessToken = async (refreshToken: string) => {
  const response = await api.post("auth/refresh", {
    refreshToken,
  });

  return response.data.Data;
};

export default {
  userLogin,
  userSignup,
  setEmail,
  me,
  logoutUser,
  
  refreshAccessToken,
  
  
};
