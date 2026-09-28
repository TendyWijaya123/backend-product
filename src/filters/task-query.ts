import buildQueryFilter from "./query-filter";

export function buildTasksQuery(params: Record<string, string>) {
  return buildQueryFilter(params, {
    allowedFields: ["title", "status"],
    defaultPageSize: 10,
    maxPageSize: 50,
  });
}
