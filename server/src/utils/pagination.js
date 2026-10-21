export function buildPagination({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export const skipFor = (page, limit) => (page - 1) * limit;

export const sortSpec = (sortBy, order) => ({
  [sortBy]: order === "asc" ? 1 : -1,
  _id: order === "asc" ? 1 : -1,
});
