import { callMondayApi } from '@api/mondayApi';

export const SHARED_PARC_BOARD_ID = 5092005027;

/**
 * Requête unique mutualisée pour le tableau « ❎Suivi du parc véhicules » (5092005027).
 * Remplace les 4 requêtes séparées (vehicleDashboard, energyTop, fleet, geoloc)
 * par 1 seul appel mis en cache 10 min (mémoire + sessionStorage) via callMondayApi.
 */
const SHARED_PARC_QUERY = `query {
  boards(ids: [${SHARED_PARC_BOARD_ID}]) {
    items_page(limit: 500) {
      items {
        id
        name
        group { id title }
        column_values(ids: [
          "numeric_mm0rw3mq",
          "color_mm0p87t0",
          "text_mm0p386j",
          "date_mm0pdrn1",
          "color_mm0p7xft",
          "color_mm0pywf4",
          "color_mm0p4pbn",
          "numeric_mm1b3xhg",
          "numeric_mm1bb4qx",
          "numeric_mm1chb78",
          "text_mm839fsd"
        ]) {
          id
          text
        }
      }
    }
  }
}`;

export async function fetchSharedParcRawResponse(): Promise<any> {
  return callMondayApi(SHARED_PARC_QUERY);
}

export async function fetchSharedParcRawItems(): Promise<any[]> {
  const res = await fetchSharedParcRawResponse();
  return res?.boards?.[0]?.items_page?.items || res?.data?.boards?.[0]?.items_page?.items || [];
}
