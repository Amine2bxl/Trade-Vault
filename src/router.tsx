import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Without a staleTime every mount refetches, which made revisiting a
        // page feel like a cold load. One minute is short enough to stay fresh
        // and long enough that navigating away and back is instant.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // 0 meant every hover-preload re-ran the route loader and threw the result
    // away. Matching the query staleTime lets preloads actually prime the cache.
    defaultPreloadStaleTime: 60_000,
  });

  return router;
};
