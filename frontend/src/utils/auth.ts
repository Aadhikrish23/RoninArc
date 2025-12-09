// frontend/src/utils/auth.ts

export type DecodedToken = {
  id?: string;
  username?: string;
  email?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
};

export function getCurrentUser() {
  console.log("getCurrentUser called");

  const token = localStorage.getItem("roninarc_user")||sessionStorage.getItem("roninarc_user");
  console.log("Token from localStorage:", token);
  if (!token) {
    console.log("No token found, returning null");
    return null;
  }

  try {
    const payload: DecodedToken = JSON.parse(token);
    console.log("Parsed payload object:", payload);

    const user = {
      id: payload.id,
      username: payload.name || payload.email || "Ronin",
    };
    console.log("Returning user object:", user);

    return user;
  } catch (err) {
    console.error("Failed to decode token", err);
    return null;
  }
}

export function deleteCurrentUser(){
     localStorage.removeItem("roninarc_user");
      localStorage.removeItem("roninarc_token");
      sessionStorage.removeItem("roninarc_user");
      sessionStorage.removeItem("roninarc_token");
}