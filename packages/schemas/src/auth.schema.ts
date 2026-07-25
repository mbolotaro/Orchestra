import z from "zod";
import { MAX_USER_EMAIL, MAX_USER_PASSWORD, MIN_USER_PASSWORD, PublicUserSchema, UserFirstNameSchema, UserLastNameSchema } from "./user.schema";

const PasswordSchema = z.string()
    .min(MIN_USER_PASSWORD, `Senha deve conter no mínimo ${MIN_USER_PASSWORD} caracteres.`)
    .max(MAX_USER_PASSWORD, `Senha deve conter no máximo ${MAX_USER_PASSWORD} caracteres.`)

export const SignUpSchema = z.object({
    firstName: UserFirstNameSchema,
    lastName: UserLastNameSchema,
    email: z.email(`Defina um e-mail válido.`)
        .max(MAX_USER_EMAIL, `E-mail deve conter no máximo ${MAX_USER_EMAIL} caracteres.`),
    password: PasswordSchema,
})

export type SignUp = z.infer<typeof SignUpSchema>;

export const PublicAuthSchema = z.object({
    user: PublicUserSchema,
})

export type PublicAuth = z.infer<typeof PublicAuthSchema>;

export const SignInSchema = z.object({
    email: z.string().min(1).max(MAX_USER_EMAIL),
    password: z.string().min(1).max(MAX_USER_PASSWORD)
})

export const VerifyEmailSchema = z.object({
    token: z.string().min(1, 'Token de verificação obrigatório')
})

export type VerifyEmail = z.infer<typeof VerifyEmailSchema>

export const ForgotPasswordSchema = z.object({
    email: z.email(`Digite um e-mail válido.`)
})

export type ForgotPassword = z.infer<typeof ForgotPasswordSchema>

export const ResetPasswordSchema = z.object({
    newPassword: PasswordSchema,
    token: z.string().min(1, 'Token obrigatório')
})

export type ResetPassword = z.infer<typeof ResetPasswordSchema>

export const PublicAuthSessionSchema = z.object({
    id: z.uuidv7(),
    isCurrent: z.boolean(),
    lastActivityAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    ipAddress: z.string().nullable(),
    device: z.object({
        browser: z.string().nullable(),
        os: z.string().nullable(),
        type: z.enum(['mobile', 'tablet', 'desktop'])
    })
})

export type PublicAuthSession = z.infer<typeof PublicAuthSessionSchema>

export const PublicAuthSessionListSchema = z.object({
    sessions: PublicAuthSessionSchema.array()
})

export type PublicAuthSessionList = z.infer<typeof PublicAuthSessionListSchema>;

export enum OAuthProvider {
    Google = 'google',
    GitHub = 'github',
}

export const OAuthProviderSchema = z.enum(OAuthProvider, 'Defina um provedor de OAuth válido.');