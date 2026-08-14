import { Hero } from '../components/Hero';
import { ProductDemo } from '../components/ProductDemo';
import { Platform } from '../components/Platform';
import { ServicePlatform } from '../components/ServicePlatform';
import { Workforce } from '../components/Workforce';
import { UseCases } from '../components/UseCases';
import { Integrations } from '../components/Integrations';
import { Enterprise } from '../components/Enterprise';
import { BrandSystem } from '../components/BrandSystem';
import { Cta } from '../components/Cta';

export default function Home() {
  return (
    <main id="top">
      <Hero />
      <ProductDemo />
      <Platform />
      <ServicePlatform />
      <Workforce />
      <UseCases />
      <Integrations />
      <Enterprise />
      <BrandSystem />
      <Cta />
    </main>
  );
}
