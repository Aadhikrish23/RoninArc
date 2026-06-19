export interface RegisterSuccess {
  userdata: {
    name: string;
    email?: string;
    updatedAt: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface LoginSuccess {
  userdata: {
    name: string;
    email?: string;
    updatedAt: string;
  };
  accessToken: string;
  refreshToken: string;
}