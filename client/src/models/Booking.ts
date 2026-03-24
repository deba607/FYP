import { Schema, model, models, InferSchemaType } from 'mongoose';

const bookingSchema = new Schema(
  {
    userId: {
      type: String,
      required: false
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    visitDate: {
      type: Date,
      required: true
    },
    timeSlot: {
      type: String,
      enum: ['Morning (9 AM-12 PM)', 'Afternoon (12 PM-3 PM)', 'Evening (3 PM-6 PM)'],
      required: true
    },
    numberOfTickets: {
      type: Number,
      required: true,
      min: 1
    },
    visitorType: {
      type: String,
      enum: ['Adult', 'Child', 'Senior', 'Student'],
      required: true
    },
    totalAmount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'confirmed'
    },
    bookingId: {
      type: String,
      unique: true,
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

export type BookingDocument = InferSchemaType<typeof bookingSchema>;

export const BookingModel = models.Booking || model('Booking', bookingSchema);
