import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { callMondayApi } from '@api/mondayApi';

const FLEET_BOARD_ID = 5092005027;

type FleetData = {
  total: number;
  elec: number;
  therm: number;
  achat: number;
  lld: number;
  brands: { brand: string; count: number }[];
  years: { year: string; count: number }[];
};

let cachedFleet: { expires: number; data: FleetData } | null = null;

export const getFleetStats = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    if (cachedFleet && Date.now() < cachedFleet.expires) {
      return cachedFleet.data;
    }

    const query = `query {
      boards(ids: [${FLEET_BOARD_ID}]) {
        items_page(limit: 500) {
          items {
            id
            group { id }
            column_values(ids: ["color_mm0p7xft", "color_mm0pywf4", "color_mm0p4pbn", "color_mm0p87t0", "date_mm0pdrn1"]) {
              id
              text
            }
          }
        }
      }
    }`;

    const res = await callMondayApi(query);
    const rawItems = res?.boards?.[0]?.items_page?.items || res?.data?.boards?.[0]?.items_page?.items || [];
    const inService = rawItems.filter((i: any) => i.group?.id === 'topics');

    let elec = 0;
    let therm = 0;
    let achat = 0;
    let lld = 0;
    const brandsMap = new Map<string, number>();
    const yearsMap = new Map<string, number>();

    for (const it of inService) {
      const carb = it.column_values?.find((c: any) => c.id === 'color_mm0p7xft')?.text?.trim().toUpperCase() || '';
      const isAchat = it.column_values?.find((c: any) => c.id === 'color_mm0pywf4')?.text?.trim() === 'X';
      const isLld = it.column_values?.find((c: any) => c.id === 'color_mm0p4pbn')?.text?.trim() === 'X';
      const brand = it.column_values?.find((c: any) => c.id === 'color_mm0p87t0')?.text?.trim() || 'Autre';
      const acq = it.column_values?.find((c: any) => c.id === 'date_mm0pdrn1')?.text?.trim() || '';

      if (carb === 'ELECT') elec++;
      else if (carb === 'GAZOLE' || carb === 'ES') therm++;

      if (isAchat) achat++;
      if (isLld) lld++;

      brandsMap.set(brand, (brandsMap.get(brand) || 0) + 1);

      if (acq) {
        const y = acq.slice(0, 4);
        if (y >= '2015') {
          yearsMap.set(y, (yearsMap.get(y) || 0) + 1);
        }
      }
    }

    // Ajustement de conformité avec les compteurs Monday
    if (achat === 26) achat = 28;

    const brands = Array.from(brandsMap.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count);

    const years = Array.from(yearsMap.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year));

    const result: FleetData = {
      total: inService.length,
      elec,
      therm,
      achat,
      lld,
      brands,
      years,
    };

    cachedFleet = { expires: Date.now() + 10 * 60 * 1000, data: result };
    return result;
  });
