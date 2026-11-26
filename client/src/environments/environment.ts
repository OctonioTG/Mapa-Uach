export const environment = {
  // Pega aquí tu token público de Mapbox (empieza con "pk.")
  // Lo sacas en https://account.mapbox.com/access-tokens/
  mapboxToken: 'PEGA_AQUI_TU_TOKEN_DE_MAPBOX',
  // Centro inicial del mapa [longitud, latitud] — Chihuahua, Chih.
  centroInicial: [-106.0889, 28.6353] as [number, number],
  zoomInicial: 12,
  apiUrl: '/api',
};
