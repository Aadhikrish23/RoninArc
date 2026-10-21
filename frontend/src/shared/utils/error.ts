import axios from "axios";

export function getErrorMessage(
  error: unknown
): string {
  if (axios.isAxiosError(error)) {
    // No response at all: the server is down or unreachable ("Network Error" told players nothing).
    if (!error.response) {
      return error.code === "ECONNABORTED"
        ? "The RoninArc server took too long to answer. Try again in a moment."
        : "Can't reach the RoninArc server. Check that it's running, then try again.";
    }
    return (
      error.response?.data?.error ??
      error.response?.data?.message ??
      error.response?.data?.Message ??
      error.message
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}