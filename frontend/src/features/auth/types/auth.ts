export interface RegisterSuccess {
  userdata: {
    /** The display name. */
    name: string;
    displayName?: string;
    email?: string | null;
    updatedAt: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface LoginSuccess {
  userdata: {
    /** The display name. */
    name: string;
    displayName?: string;
    email?: string | null;
    updatedAt: string;
  };
  accessToken: string;
  refreshToken: string;
}