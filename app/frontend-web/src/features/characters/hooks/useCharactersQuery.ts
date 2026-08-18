import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { charactersApi } from "../api/characters.api";

const PAGE_SIZE = 20;

export function useCharactersQuery() {
  return useInfiniteQuery({
    queryKey: queryKeys.characters,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      charactersApi.list({ cursor: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
