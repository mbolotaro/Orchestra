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

export const UserFirstNameSchema = z.string('Defina o nome do usuário.')
    .min(MIN_USER_FIRST_NAME, `Nome do usuário deve conter no mínimo ${MIN_USER_FIRST_NAME} caracteres.`)
    .max(MAX_USER_FIRST_NAME, `Nome do usuário deve conter no máximo ${MAX_USER_FIRST_NAME} caracteres.`)

export const UserLastNameSchema = z.string('Defina o sobrenome do usuário.')
    .min(MIN_USER_LAST_NAME, `Sobrenome deve conter no mínimo ${MIN_USER_LAST_NAME} caracteres.`)
    .max(MAX_USER_LAST_NAME, `Sobrenome deve conter no máximo ${MAX_USER_LAST_NAME} caracteres.`)

export const UpdateUserSchema = z.object({
    firstName: UserFirstNameSchema,
    lastName: UserLastNameSchema,
})

export type PublicUser = z.infer<typeof PublicUserSchema>
export type UpdateUser = z.infer<typeof UpdateUserSchema>