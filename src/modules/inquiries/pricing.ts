export function calcStayPrice(
  pricePerNight: number,
  nights: number
): { subtotal: number; discountPct: number; total: number } {
  const subtotal = pricePerNight * nights
  const discountPct = nights >= 28 ? 15 : nights >= 14 ? 10 : nights >= 7 ? 5 : 0
  const total = subtotal * (1 - discountPct / 100)
  return { subtotal, discountPct, total }
}
