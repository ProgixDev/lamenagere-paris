import { useQuery } from "@tanstack/react-query";
import { getPopupsApi } from "./api";

/** Active launch pop-ups. Refetched on each cold start via the root PopupGate. */
export const usePopups = () =>
  useQuery({
    queryKey: ["popups"],
    queryFn: getPopupsApi,
    staleTime: 5 * 60 * 1000,
  });
