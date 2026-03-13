import { HeroService } from '@/services/hero.service';
import { IHeroSlide } from '@/interfaces/home.interface';
import { TenantModels } from '@/config/modelRegistry';

export class HeroSeeder {
    static async seed(models: TenantModels) {
        // Check if any slides exist
        const existing = await HeroService.getAll(models);
        if (existing.length > 0) return;

        console.log('🌱 Seeding Hero Slides...');

        const initialSlide: Partial<IHeroSlide> = {
            title: 'Festejamos Fin de Año',
            imageDesktop: 'https://http2.mlstatic.com/D_NQ_845353-MLA72624419200_112023-OO.webp', // Example Placeholder
            imageMobile: 'https://http2.mlstatic.com/D_NQ_938632-MLA72671569427_112023-OO.webp', // Example Placeholder
            link: '/ofertas-fin-de-aniv',
            altText: 'Ofertas increíbles de fin de año',
            order: 0,
            isActive: true
        };

        await HeroService.create(models, initialSlide);
        console.log('✅ Hero Slides seeded.');
    }
}
