import { createContext, useContext } from 'react';

// True when the backend reports it can serve CARTO tiles through /api/basemap (key stays server-side).
export const BasemapProxyContext = createContext(false);
export const useBasemapProxy = () => useContext(BasemapProxyContext);
