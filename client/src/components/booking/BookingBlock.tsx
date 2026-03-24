import React, { isValidElement, cloneElement } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Ticket, MessageCircle, Eye } from 'lucide-react';

const Card = ({
	to,
	title,
	desc,
	icon,
	badge,
}: {
	to: string;
	title: string;
	desc: string;
	icon: React.ReactNode;
	badge?: string;
}) => (
	<Link
		href={to as any}
		aria-label={title}
		className="group relative block h-full rounded-lg border bg-background p-6 transition-transform transform-gpu hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
	>
		{badge && (
			<span className="absolute top-3 right-3 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white shadow">{badge}</span>
		)}

		<div className="mb-3 flex items-center gap-4">
			<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5 p-2 text-primary shadow-sm">
					{isValidElement(icon)
						? cloneElement(icon as React.ReactElement<any, any>, {
							  className: cn((icon as React.ReactElement<any, any>).props?.className, 'h-6 w-6 text-primary'),
						  })
						: icon}
			</div>
			<h4 className="text-lg font-semibold">{title}</h4>
		</div>

		<p className="text-sm text-muted-foreground">{desc}</p>
		<div className="mt-4 text-sm font-medium text-primary group-hover:underline">Open</div>
	</Link>
);

export default function BookingBlock() {
	return (
		<div className="max-w-4xl justify-center text-center mx-auto py-12 px-4 sm:px-6 lg:px-8 gap-5">
			{/* <h3 className="mb-6 text-2xl font-semibold">Tickets</h3> */}
			<div className="grid gap-6 sm:grid-cols-3 sm:gap-8 md:gap-12 lg:gap-16 items-stretch">
				<Card to="/booking/new" title="Ticket Booking" desc="Purchase tickets for your visit." icon={<Ticket />} />
				<Card to="/booking/chat" title="Ticket Booking With ChatBot" desc="Book tickets with the help of our chatbot." icon={<MessageCircle />} badge="New" />
				<Card to="/booking/show" title="Show Ticket" desc="Lookup and view your existing booking by ID." icon={<Eye />} />
			</div>
		</div>
	);
}

