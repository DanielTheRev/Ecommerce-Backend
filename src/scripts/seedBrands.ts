import { IBanner } from "@/interfaces/home.interface";
import { BannerService } from "@/services/banner.service";
import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

const brands: any[] = [
  {
    brandName: "Apple",
    description: 'Diseño en titanio. Creado para Apple Intelligence.',
    image: 'https://www.apple.com/v/iphone-17/c/images/overview/cameras/back-camera/hero_rear_camera__cz6f2qdjc0q6_xlarge_2x.png',
    title: 'iPhone 16 Pro',
    subtitle: 'Titanium Design',
    textClass: 'text-white',
    buttonClass: 'bg-white text-black hover:bg-gray-200',
    icon: 'Apple',
    order: 1,
    isActive: true,
  },
  {
    brandName: 'Samsung',
    description: 'El smartphone definitivo. Titanio. Inteligencia Artificial.',
    image: 'https://images.samsung.com/ar/smartphones/galaxy-s25-ultra/images/galaxy-s25-ultra-features-kv-g.jpg?imbypass=true',
    title: 'Galaxy S25 Ultra',
    subtitle: 'Galaxy AI is here',
    textClass: 'text-white',
    buttonClass: 'bg-white text-black hover:bg-gray-200',
    icon: 'Smartphone',
    order: 2,
    isActive: true,
  },
  {
    brandName: 'Xiaomi',
    description: 'Lentes ópticos Leica. Potencia y diseño sin límites.',
    image: 'https://xiaomistore.com.ar/desarrollos/landings/smartphones/redmi-14t/desktop/main-files/img01.jpg',
    title: 'Xiaomi 14T Series',
    subtitle: 'Master light, capture night',
    textClass: 'text-white',
    buttonClass: 'bg-white text-black hover:bg-gray-200',
    icon: 'Smartphone',
    order: 3,
    isActive: true,
  },
  {
    brandName: 'Motorola',
    description: 'Descubre la fusión perfecta entre tecnología y estilo.',
    image: 'https://armoto.vteximg.com.br/arquivos/moto-edge-60-pro-pdp-CMF-Modal-static-01-D-zf1ke1kz.jpg',
    title: 'Diseño Sin Límites',
    subtitle: 'Hello Moto',
    textClass: 'text-white',
    buttonClass: 'bg-white text-black hover:bg-gray-200',
    icon: 'Smartphone',
    order: 4,
    isActive: true,
  },
  {
    brandName: 'POCO',
    description: 'Rendimiento extremo para gaming y creadores.',
    image: 'https://i02.appmifile.com/mi-com-product/fly-birds/poco-f7/pc/837222dcf1c0c4a47659f44e9ac81b2a.jpg?f=webp',
    title: 'Pura Potencia',
    subtitle: 'Everything you need',
    textClass: 'text-white',
    buttonClass: 'bg-[#FFD700] text-black hover:bg-yellow-400',
    icon: 'Zap',
    order: 5,
    isActive: true,
  }
];


async function seedBrands(data: any[]) {
  const promises = data.map((brand) => BannerService.createBanner(brand));
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/electro-hub';

  await mongoose.connect(mongoURI);
  console.log('✅ Conectado a MongoDB');
  const result = await Promise.allSettled(promises);
  const created = result.filter((r) => r.status === 'fulfilled');
  const errors = result.filter((r) => r.status === 'rejected');
  console.log('✅ Banners creados', created.length);
  console.log('❌ Errores', errors.length);
  await mongoose.connection.close();
  console.log('🔒 Conexión cerrada');
  process.exit(0);
};

if (require.main === module) {
  seedBrands(brands);
}