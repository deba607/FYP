"use client";

import dynamic from 'next/dynamic';

const PersonalizedHomeSection = dynamic(() => import('./PersonalizedHomeSection'), {
  ssr: false,
  loading: () => (
    <section className="border-y py-16">
      <div className="mx-auto max-w-7xl animate-pulse px-4 md:px-8">
        <div className="h-9 w-72 rounded bg-muted" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-80 rounded-2xl bg-muted" />)}
        </div>
      </div>
    </section>
  )
});

export default function PersonalizedHomeLoader() {
  return <PersonalizedHomeSection />;
}
