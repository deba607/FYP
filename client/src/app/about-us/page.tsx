import Team9 from '../../components/mvpblocks/team-9';

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-extrabold">About Bharat Museum</h1>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-foreground/70">
          We are dedicated to preserving and sharing our cultural heritage with the world.
          Through immersive exhibits, community programs, and accessible experiences,
          we connect visitors with stories that matter.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <a href="/contact" className="inline-block rounded-lg bg-rose-500 px-6 py-2 text-sm font-medium text-white shadow-sm">
            Contact Us
          </a>
          <a href="#team" className="inline-block rounded-lg border border-border px-6 py-2 text-sm">
            Meet the team
          </a>
        </div>
      </section>

      <section id="team" className="container mx-auto px-4 py-12">
        <Team9 title="Meet our team" subtitle="People who make it happen" />
      </section>

      <section className="bg-gradient-to-b from-background/0 to-background/20 py-12">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold">Join our mission</h3>
          <p className="mt-2 text-foreground/70">Support, volunteer, or partner with us to grow impact.</p>
          <a href="/contact" className="mt-4 inline-block rounded-lg bg-rose-500 px-6 py-2 text-sm font-medium text-white">
            Get in touch
          </a>
        </div>
      </section>
    </div>
  );
}
