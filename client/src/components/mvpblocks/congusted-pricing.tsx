'use client';

import { buttonVariants } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { useMediaQuery } from '../../hooks/use-media-query';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import NumberFlow from '@number-flow/react';

// Define your plans
const plans = [
  {
    name: 'DAY PASS',
    price: '150',
    yearlyPrice: '1200',
    period: 'per visit',
    features: [
      'Access to all standard exhibits',
      'Self-guided audio tour (mobile)',
      'Free Wi‑Fi and map',
      'Cafe & shop discounts',
    ],
    description: 'Perfect for single visits',
    buttonText: 'Buy Ticket',
    href: '/book-ticket',
    isPopular: false,
  },
  {
    name: 'ANNUAL PASS',
    price: '1200',
    yearlyPrice: '1200',
    period: 'per year',
    features: [
      'Unlimited visits for one year',
      'Free entry to special exhibitions',
      'Invitations to member events',
      '10% store & cafe discount',
      'Priority booking for events',
    ],
    description: 'Best value for frequent visitors',
    buttonText: 'Buy Annual Pass',
    href: '/book-pass',
    isPopular: true,
  },
  {
    name: 'CORPORATE',
    price: '5000',
    yearlyPrice: '45000',
    period: 'per year',
    features: [
      'Group booking discounts',
      'Dedicated event & account support',
      'Private tours & talks',
      'Bulk ticket and invoice options',
      'Custom reporting',
    ],
    description: 'Custom solutions for organizations',
    buttonText: 'Contact Sales',
    href: '/contact',
    isPopular: false,
  },
];



export default function CongestedPricing() {
  const [isMonthly, setIsMonthly] = useState(true);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const switchRef = useRef<HTMLButtonElement>(null);

  const handleToggle = (checked: boolean) => {
    setIsMonthly(!checked);
    if (checked && switchRef.current) {
      const rect = switchRef.current.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      confetti({
        particleCount: 50,
        spread: 60,
        origin: {
          x: x / window.innerWidth,
          y: y / window.innerHeight,
        },
        colors: [
          'hsl(var(--primary))',
          'hsl(var(--accent))',
          'hsl(var(--secondary))',
          'hsl(var(--muted))',
        ],
        ticks: 200,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
        shapes: ['circle'],
      });
    }
  };

  return (
    <div className="container py-20">
      <div className="mb-12 space-y-4 text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Ticketing & membership pricing
        </h2>
        <p className="text-muted-foreground text-lg whitespace-pre-line">
          Choose the option that fits your visit. All tickets and memberships include access to exhibitions, events, and member benefits.
        </p>
      </div>

      <div className="mb-10 flex justify-center">
        <label className="relative inline-flex cursor-pointer items-center">
          <Label>
            <Switch
              ref={switchRef as any}
              checked={!isMonthly}
              onCheckedChange={handleToggle}
              className="relative"
            />
          </Label>
        </label>
        <span className="ml-2 font-semibold">
          Show membership pricing <span className="text-primary">(Annual)</span>
        </span>
      </div>

      <div className="sm:2 grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((plan, index) => (
          <motion.div
            key={index}
            initial={{ y: 50, opacity: 1 }}
            whileInView={
              isDesktop
                ? {
                    y: plan.isPopular ? -20 : 0,
                    opacity: 1,
                    x: index === 2 ? -30 : index === 0 ? 30 : 0,
                    scale: index === 0 || index === 2 ? 0.94 : 1.0,
                  }
                : {}
            }
            viewport={{ once: true }}
            transition={{
              duration: 1.6,
              type: 'spring',
              stiffness: 100,
              damping: 30,
              delay: 0.4,
              opacity: { duration: 0.5 },
            }}
            className={cn(
              `bg-background relative rounded-2xl border-[1px] p-6 text-center lg:flex lg:flex-col lg:justify-center`,
              plan.isPopular ? 'border-primary border-2' : 'border-border',
              'flex flex-col',
              !plan.isPopular && 'mt-5',
              index === 0 || index === 2
                ? 'z-0 translate-x-0 translate-y-0 -translate-z-[50px] rotate-y-[10deg] transform'
                : 'z-10',
              index === 0 && 'origin-right',
              index === 2 && 'origin-left',
            )}
          >
            {plan.isPopular && (
              <div className="bg-primary absolute top-0 right-0 flex items-center rounded-tr-xl rounded-bl-xl px-2 py-0.5">
                <Star className="text-primary-foreground h-4 w-4 fill-current" />
                <span className="text-primary-foreground ml-1 font-sans font-semibold">
                  Popular
                </span>
              </div>
            )}
            <div className="flex flex-1 flex-col">
              <p className="text-muted-foreground text-base font-semibold">
                {plan.name}
              </p>
              <div className="mt-6 flex items-center justify-center gap-x-2">
                <span className="text-foreground text-5xl font-bold tracking-tight">
                  <NumberFlow
                    value={
                      isMonthly ? Number(plan.price) : Number(plan.yearlyPrice)
                    }
                    format={{
                      style: 'currency',
                      currency: 'INR',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }}
                    transformTiming={{
                      duration: 500,
                      easing: 'ease-out',
                    }}
                    willChange
                    className="font-variant-numeric: tabular-nums"
                  />
                </span>
                {plan.period !== 'Next 3 months' && (
                  <span className="text-muted-foreground text-sm leading-6 font-semibold tracking-wide">
                    / {plan.period}
                  </span>
                )}
              </div>

              <p className="text-muted-foreground text-xs leading-5">
                {isMonthly ? 'per visit' : 'per year (membership)'}
              </p>

              <ul className="mt-5 flex flex-col gap-2">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="text-primary mt-1 h-4 w-4 flex-shrink-0" />
                    <span className="text-left">{feature}</span>
                  </li>
                ))}
              </ul>

              <hr className="my-4 w-full" />

              <Link
                href={plan.href as any}
                className={cn(
                  buttonVariants({
                    variant: 'outline',
                  }),
                  'group relative w-full gap-2 overflow-hidden text-lg font-semibold tracking-tighter',
                  'hover:bg-primary hover:text-primary-foreground hover:ring-primary transform-gpu ring-offset-current transition-all duration-300 ease-out hover:ring-2 hover:ring-offset-1',
                  plan.isPopular
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-foreground',
                )}
              >
                {plan.buttonText}
              </Link>
              <p className="text-muted-foreground mt-6 text-xs leading-5">
                {plan.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
