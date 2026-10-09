import axiosInstance from "../../../shared/api/axiosInstance";
import type { DashboardOverview } from "../types/dashboard";

export const getDashboardStats = async () => {
  const response = await axiosInstance.get(
    "/dashboard/stats"
  );

  return response.data;
};

export const getDashboardOverview = async (): Promise<DashboardOverview> => {
  const response = await axiosInstance.get("/dashboard/overview");

  return response.data.Data;
};
