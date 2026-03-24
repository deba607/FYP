import Faq2 from '@/components/mvpblocks/faq-2';
import InteractiveTooltip from '@/components/mvpblocks/interactive-tooltip';
import TextRevealLetters from '@/components/mvpblocks/text-reveal-1';
import { Skiper54 } from '@/components/ui/skiper-ui/skiper54';
import BookingBlock from '@/components/booking/BookingBlock';

export default function HomePage() {
  return (
    <div>
      <div className="h-15 bg-white dark:bg-black" />
      <div className="flex justify-center">
        <div className="w-full max-w-6xl text-center">
          <TextRevealLetters />
        </div>
      </div>
      <BookingBlock />
      <Skiper54 />
      <Faq2 />
      <InteractiveTooltip />
    </div>
  );
}
