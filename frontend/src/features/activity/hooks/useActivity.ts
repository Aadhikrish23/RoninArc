import { useEffect, useState } from "react";

import activityApi from "../api/activityApi";

import type { Activity } from "../types/activity";

export function useActivity() {
  const [activities, setActivities] =
    useState<Activity[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data =
          await activityApi.getActivities();

        setActivities(data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return {
    activities,
    loading,
  };
}