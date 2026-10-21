export interface Shop { id: string; name: string; stock: string[] }
export const SHOPS: Record<string, Shop> = {
  village: { id: 'village', name: 'Aojan Trader', stock: ['medkit', 'megakit', 'kicapsule', 'powercap', 'guardcap', 'vitalcap', 'kicap', 'speedcap', 'ragecap'] },
};
