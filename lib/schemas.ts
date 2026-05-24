import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().cuid("Invalid product ID"),
  warehouseId: z.string().cuid("Invalid warehouse ID"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(100, "Cannot reserve more than 100 units at a time"),
  customerEmail: z.string().email("Invalid email").optional(),
  ttlMinutes: z
    .number()
    .int()
    .min(1)
    .max(60)
    .optional()
    .default(10),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const ConfirmReservationSchema = z.object({
  // optional extra fields (e.g. payment reference)
  paymentRef: z.string().optional(),
});

export const ProductQuerySchema = z.object({
  warehouseId: z.string().cuid().optional(),
  inStockOnly: z
    .string()
    .transform((v) => v === "true")
    .optional(),
});
