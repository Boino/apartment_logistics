import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const AMENITIES = [
  { name: 'WiFi', icon: 'wifi' },
  { name: 'Kitchen', icon: 'utensils' },
  { name: 'Washer', icon: 'washing-machine' },
  { name: 'Parking', icon: 'car' },
  { name: 'Heating', icon: 'thermometer' },
  { name: 'AC', icon: 'air-vent' },
  { name: 'TV', icon: 'tv' },
  { name: 'Elevator', icon: 'arrow-up-square' },
  { name: 'Balcony', icon: 'building' },
  { name: 'Workspace', icon: 'laptop' },
  { name: 'Crib', icon: 'baby' },
  { name: 'Dishwasher', icon: 'droplets' },
]

async function main() {
  console.log('Seeding amenities…')
  for (const amenity of AMENITIES) {
    await db.amenity.upsert({
      where: { name: amenity.name },
      update: { icon: amenity.icon },
      create: amenity,
    })
  }
  console.log(`✓ ${AMENITIES.length} amenities seeded`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
