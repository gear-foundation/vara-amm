import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

import { Loader } from '@/components/ui/loader';
import { ROUTES } from '@/consts';

const routes = [
  { path: ROUTES.HOME, Page: lazy(() => import('./home')) },
  { path: ROUTES.TRADE, Page: lazy(() => import('./trade')) },
  { path: ROUTES.EXPLORE, Page: lazy(() => import('./explore')) },
  { path: ROUTES.POOL, Page: lazy(() => import('./pool')) },
];

export function Routing() {
  return (
    <Routes>
      {routes.map(({ path, Page }) => (
        <Route
          key={path}
          path={path}
          element={
            <Suspense fallback={<Loader size="lg" text="Loading..." className="py-20" />}>
              <Page />
            </Suspense>
          }
        />
      ))}
    </Routes>
  );
}
