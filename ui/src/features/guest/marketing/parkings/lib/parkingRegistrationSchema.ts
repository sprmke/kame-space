import { z } from 'zod';

import { requiredPhilippineMobilePhoneZodSchema } from '@/lib/validation/fieldValidation';
import { getManilaYmdToday } from '@/utils/format/dates';

export const parkingVehicleTypeOptions = [
  { value: 'car', label: 'Car' },
  { value: 'motorcycle', label: 'Motorcycle' },
] as const;

export const parkingRegistrationSchema = z
  .object({
    guestName: z.string().trim().min(1, 'Guest name is required').max(120, 'Name is too long'),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    phone: requiredPhilippineMobilePhoneZodSchema(),
    unitNumber: z.string().trim().min(1, 'Unit number is required').max(60, 'Unit is too long'),
    checkInDate: z.string().min(1, 'Please select a check-in date'),
    checkOutDate: z.string().min(1, 'Please select a check-out date'),
    vehicleType: z.enum(['car', 'motorcycle'], {
      errorMap: () => ({ message: 'Please select a vehicle type' }),
    }),
    carPlateNumber: z
      .string()
      .trim()
      .min(1, 'Plate number is required')
      .max(15, 'Plate number is too long')
      .regex(/^[a-z0-9 -]+$/i, 'Use letters, numbers, spaces or dashes only')
      .transform((v) => v.toUpperCase()),
    carBrandModel: z
      .string()
      .trim()
      .min(1, 'Brand/model is required')
      .max(80, 'Brand/model is too long'),
    carColor: z.string().trim().min(1, 'Color is required').max(40, 'Color is too long'),
    notes: z.string().trim().max(1000, 'Notes are too long').optional().default(''),
  })
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  })
  .refine((data) => data.checkInDate >= getManilaYmdToday(), {
    message: 'Check-in cannot be in the past',
    path: ['checkInDate'],
  })
  .refine(
    (data) => {
      const nights = (Date.parse(data.checkOutDate) - Date.parse(data.checkInDate)) / 86_400_000;
      return Number.isFinite(nights) && nights <= 60;
    },
    { message: 'Stay cannot exceed 60 nights', path: ['checkOutDate'] }
  );

export type ParkingRegistrationValues = z.infer<typeof parkingRegistrationSchema>;
