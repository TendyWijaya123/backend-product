import buildQueryFilter from "./query-filter";

export function buildProjectsQuery(params: Record<string, string>) {
  return buildQueryFilter(params, {
    allowedFields: ["name"],
    maxPageSize: 100,
    defaultPageSize: 10,
  });
}
