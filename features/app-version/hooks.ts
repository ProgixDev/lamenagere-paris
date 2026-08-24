import { useQuery } from "@tanstack/react-query";
import { getAppVersionGateApi } from "./api";

/**
 * Verrou de version, interrogé au lancement et à chaque retour au premier plan
 * (voir UpdateGate). Volontairement sans cache (`staleTime: 0`) : quand une
 * version est bloquée pour une faille, on veut que le blocage s'applique dès la
 * prochaine ouverture.
 *
 * `retry: false` + échec silencieux : si l'API est injoignable, on n'affiche
 * rien et l'app reste utilisable. Un verrou qui se déclenche sur une coupure
 * réseau enfermerait tous les utilisateurs hors ligne.
 */
export const useAppVersionGate = () =>
  useQuery({
    queryKey: ["app-version-gate"],
    queryFn: getAppVersionGateApi,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
