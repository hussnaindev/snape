import { Banner } from '@/components/banner';

import { ContinueWatchingCarousel } from '@/components/continue-watching-carousel';

import { CuratedProviderSection } from '@/components/curated-provider-section';

import { HeroSection } from '@/components/hero-section';

import { APP_NAME } from '@/lib/config';

import { CURATED_PROVIDERS } from '@/lib/curated-providers';

import { getCuratedProviderMovies } from '@/lib/tmdb';

import type { Metadata } from 'next';

import { cookies } from 'next/headers';



export const runtime = 'edge';



export const metadata: Metadata = {

  title: `${APP_NAME} — Stream Movies Instantly`,

};



export default async function HomePage() {

  const cookieStore = await cookies();

  const hasHistory = cookieStore.has('hwh');



  const curatedMovieLists = await Promise.all(

    CURATED_PROVIDERS.map((c) => getCuratedProviderMovies(c.key)),

  );



  const curatedMoviesByKey = Object.fromEntries(

    CURATED_PROVIDERS.map((c, i) => [c.key, curatedMovieLists[i]]),

  ) as Record<(typeof CURATED_PROVIDERS)[number]['key'], (typeof curatedMovieLists)[number]>;



  return (

    <>
      <div style={{ overflowX: 'clip' }}>

        <HeroSection />



        <ContinueWatchingCarousel hasHistory={hasHistory} />



        <div className="flex flex-col">

          {CURATED_PROVIDERS.map((curated) => (

            <CuratedProviderSection

              key={curated.key}

              providerKey={curated.key}

              label={curated.label}

              brandColor={curated.brandColor}

              movies={curatedMoviesByKey[curated.key]}

            />

          ))}

        </div>



        <Banner />

      </div>

    </>

  );

}

