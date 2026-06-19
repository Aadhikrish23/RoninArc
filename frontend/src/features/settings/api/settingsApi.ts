import api from "../../../api/axiosInstance";

const logoutAllDevices = async () => {
  return api.post("auth/logout-all");
};
const changePassword = async (currentPassword: string, newPassword: string) => {
  return api.patch("auth/change-password", {
    currentPassword,
    newPassword,
  });
};
const deleteAccount = async (password: string) => {
  return api.delete("auth/account", {
    data: {
      password,
    },
  });
};
export default {
  logoutAllDevices,
  changePassword,
  deleteAccount,
};
