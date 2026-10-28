import * as z from "zod/v4";

export const CategorySchema = z.string();

export const EventSchema = z.looseObject({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  category: CategorySchema,
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  location: z.string(),
  capacity: z.number().int().positive(),
  rsvpCount: z.number().int().nonnegative(),
  availableSpots: z.number().int().nonnegative(),
  meetingUrl: z.url().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  localTime: z
    .string()
    .optional()
    .describe("Start and end time already converted to Montreal time"),
});

export const RsvpSchema = z.looseObject({
  id: z.number().int().positive(),
  eventId: z.number().int().positive(),
  name: z.string(),
  email: z.email(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const DateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  timezone: z.literal("America/Montreal"),
});

export const ListCategoriesInputSchema = z.object({});
export const ListCategoriesOutputSchema = z.object({
  categories: z.array(CategorySchema),
});

export const SearchEventsInputSchema = z.object({
  query: z.string().min(1).optional().describe("Free-text search"),
  category: z.string().min(1).optional().describe("Category name or identifier"),
  when: z
    .enum(["today", "this_week", "this_weekend", "next_7_days", "any"])
    .default("any"),
});
export const SearchEventsOutputSchema = z.object({
  events: z.array(EventSchema),
  range: DateRangeSchema.optional(),
});

export const GetEventInputSchema = z.object({
  id: z.number().int().positive(),
});
export const GetEventOutputSchema = z.object({
  event: EventSchema,
});

export const RsvpInputSchema = z.object({
  eventId: z.number().int().positive(),
  name: z.string().min(1),
  email: z.email(),
});
export const RsvpOutputSchema = z.object({
  rsvp: RsvpSchema,
});

export const CreateEventInputSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    category: z.string().min(1),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    location: z.string().min(1),
    capacity: z.number().int().positive(),
    meetingUrl: z.url().nullable().optional(),
  })
  .refine(
    ({ startsAt, endsAt }) => Date.parse(endsAt) > Date.parse(startsAt),
    {
      message: "endsAt must be after startsAt",
      path: ["endsAt"],
    },
  );
export const CreateEventOutputSchema = z.object({
  event: EventSchema,
});

export const PlanCampusWeekArgsSchema = z.object({
  interests: z.string().min(1).optional(),
  availability: z.string().min(1).optional(),
});

export type Category = z.infer<typeof CategorySchema>;
export type CampusEvent = z.infer<typeof EventSchema>;
export type Rsvp = z.infer<typeof RsvpSchema>;
export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;
