import { TextReveal } from '../../components/ui/text-reveal';
import { cn } from '../../lib/utils';
// import '@fontsource/inter/400.css';

export default function TextRevealLetters() {
  return (
    <TextReveal
      className={cn(
        `bg-primary from-foreground to-primary via-rose-200 bg-clip-text text-xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-transparent dark:bg-linear-to-b`,
        'font-[Inter]',
      )}
      
      from="bottom"
      split="letter"
    >
      Welcome to Bharat Museum Tickets.com
    </TextReveal>
  );
}
