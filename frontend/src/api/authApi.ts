import api from "./axiosInstance";

interface RegisterSuccess {
  userdata: {
    name: string;
    email?: string;
    updatedAt: string;
  };
  accessToken: string;
  refreshToken: string;
}

interface LoginSuccess {
  userdata: {
    name: string;
    email?: string;
    updatedAt: string;
  };
  accessToken: string;
  refreshToken: string;
}
const userLogin = async (
  name: string,
  password: string,
): Promise<LoginSuccess> => {
  const uesrdata = await api.post<{ Status: string; Data: LoginSuccess }>(
    "auth/login",
    {
      username: name.trim(),
      password: password.trim(),
    },
  );
  return uesrdata.data.Data;
};

const userSignup = async (
  name: string,
  password: string,
  email?: string,
): Promise<RegisterSuccess> => {
  email = email === undefined ? "" : email.trim();
  const userData  = await api.post<{ Status: String; Data: RegisterSuccess }>(
    "auth/register",
    {
      username: name.trim(),
      password: password.trim(),
      email: email,
    },
  );
  return userData.data.Data;
};
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
  logoutUser,
  
  refreshAccessToken,
  
  
};
