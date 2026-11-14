/**
 * Contracts of the EventHub API, based on the Swagger docs and corrected where the live API differs
 * (see README, "Documentation does not match the API").
 */

// ---------------------------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------------------------

/**
 * Decimal values (event price, booking totalPrice) are documented as numbers but the live API
 * serialises them as strings (e.g. "149.99"). Typed as both so the compiler forces callers to
 * normalise with `toAmount()` instead of silently comparing a string with a number.
 */
export type Decimal = number | string;

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ListEnvelope<T> {
  success: true;
  data: T[];
  pagination: Pagination;
}

export interface MessageEnvelope {
  success: boolean;
  message: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ErrorEnvelope {
  success: false;
  error: string;
  details?: Array<{ field: string; message: string }>;
}

export interface PageQuery {
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------------------------

export interface Credentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: { id: number; email: string };
}

export interface MeResponse {
  success: boolean;
  user: { userId: number; email: string; iat?: number; exp?: number };
}

// ---------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------

export const EVENT_CATEGORIES = ['Conference', 'Concert', 'Sports', 'Workshop', 'Festival'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface EventhubEvent {
  id: number;
  title: string;
  description?: string | null;
  category: EventCategory;
  venue: string;
  city: string;
  eventDate: string;
  price: Decimal;
  totalSeats: number;
  availableSeats: number;
  imageUrl?: string | null;
  /** Undocumented: true for the shared "featured" events every account can see. */
  isStatic?: boolean;
  /** Undocumented: owner of a user-created event (null for static events). */
  userId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  category: EventCategory;
  venue: string;
  city: string;
  eventDate: string;
  price: number;
  totalSeats: number;
  imageUrl?: string;
}

export interface EventQuery extends PageQuery {
  category?: EventCategory;
  city?: string;
  search?: string;
}

// ---------------------------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------------------------

export type BookingStatus = 'confirmed' | 'cancelled';

export interface Booking {
  id: number;
  eventId: number;
  /** Undocumented: owner of the booking. */
  userId?: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  quantity: number;
  totalPrice: Decimal;
  status: BookingStatus;
  bookingRef: string;
  createdAt: string;
  updatedAt: string;
  event?: EventhubEvent;
}

export interface CreateBookingInput {
  eventId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  quantity: number;
}

export interface BookingQuery extends PageQuery {
  eventId?: number;
  status?: BookingStatus;
}
