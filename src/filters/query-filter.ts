import {
  BuildQueryFilter,
  type OrderDirection,
} from "@nodewave/prisma-ezfilter";
import { AppError } from "../middleware/error-handler";

type FilterOptions = {
  allowedFields?: string[];
  maxPageSize?: number;
  defaultPageSize?: number;
  defaultSearchMode?: "insensitive";
  allowedRelations?: string[];
};

function parseJsonParam(value: string | undefined, paramName: string) {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new AppError(
      `Invalid JSON in query parameter: ${paramName}`,
      400,
      "INVALID_QUERY_PARAMETER",
    );
  }
}

function parseOrderRule(value: string | undefined): OrderDirection | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "asc" || value === "desc") {
    return value;
  }

  throw new AppError(
    `Invalid orderRule. Expected "asc" or "desc".`,
    400,
    "INVALID_ORDER_RULE",
  );
}

export function buildQueryFilter(
  params: Record<string, string>,
  options: FilterOptions = {},
) {
  const queryBuilder = new BuildQueryFilter(options);

  const filter = {
    ...(params.page && {
      page: Number(params.page),
    }),

    ...(params.rows && {
      rows: Number(params.rows),
    }),

    ...(params.filters && {
      filters: parseJsonParam(params.filters, "filters"),
    }),

    ...(params.searchFilters && {
      searchFilters: parseJsonParam(params.searchFilters, "searchFilters"),
    }),

    ...(params.rangedFilters && {
      rangedFilters: parseJsonParam(params.rangedFilters, "rangedFilters"),
    }),

    ...(params.orderKey && {
      orderKey: params.orderKey,
    }),

    ...(params.orderRule && {
      orderRule: parseOrderRule(params.orderRule),
    }),
  };

  return queryBuilder.build(filter);
}

export default buildQueryFilter;
