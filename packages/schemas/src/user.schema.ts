import z from "zod"

export const MIN_USER_FIRST_NAME = 2
export const MAX_USER_FIRST_NAME = 100

export const MIN_USER_LAST_NAME = 2
export const MAX_USER_LAST_NAME = 100

export const MAX_USER_EMAIL = 254

export const MIN_USER_PASSWORD = 8
export const MAX_USER_PASSWORD = 100

export const PublicUserSchema = z.object({
    id: z.uuidv7(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    isEmailVerified: z.boolean(),
})

export type PublicUser = z.infer<typeof PublicUserSchema>