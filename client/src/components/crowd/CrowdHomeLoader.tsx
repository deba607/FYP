"use client";

import dynamic from 'next/dynamic';

const CrowdInsightsPanel = dynamic(() => import('./CrowdInsightsPanel'), { ssr: false });

export default function CrowdHomeLoader() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
      <CrowdInsightsPanel title="Plan Around Live Crowds" description="Verified gate entries and exits help you choose a comfortable time to visit." limit={6} />
    </section>
  );
}
