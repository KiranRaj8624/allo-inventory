import { db } from "@/lib/db";

export const productRepository = {
  async findAll() {
    return db.product.findMany({
      include: {
        inventory: {
          include: { warehouse: true },
          orderBy: { warehouse: { name: "asc" } },
        },
      },
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string) {
    return db.product.findUnique({
      where: { id },
      include: {
        inventory: { include: { warehouse: true } },
      },
    });
  },
};
