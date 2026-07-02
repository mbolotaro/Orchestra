import z from "zod";
import { MAX_USER_EMAIL, MAX_USER_FIRST_NAME, MAX_USER_LAST_NAME, MAX_USER_PASSWORD, MIN_USER_FIRST_NAME, MIN_USER_LAST_NAME, MIN_USER_PASSWORD, PublicUserSchema } from "./user.schema";

const passwordSchema = z.string()
    .min(MIN_USER_PASSWORD, `Senha deve conter no mínimo ${MIN_USER_PASSWORD} caracteres.`)
    .max(MAX_USER_PASSWORD, `Senha deve conter no máximo ${MAX_USER_PASSWORD} caracteres.`)

export const SignUpSchema = z.object({
    firstName: z.string('Defina o nome do usuário.')
        .min(MIN_USER_FIRST_NAME, `Nome do usuário deve conter no mínimo ${MIN_USER_FIRST_NAME} caracteres.`)
        .max(MAX_USER_FIRST_NAME, `Nome do usuário deve conter no máximo ${MAX_USER_FIRST_NAME} caracteres.`),
    lastName: z.string('Defina o sobrenome do usuário.')
        .min(MIN_USER_LAST_NAME, `Sobrenome deve conter no mínimo ${MIN_USER_LAST_NAME} caracteres.`)
        .max(MAX_USER_LAST_NAME, `Sobrenome deve conter no máximo ${MAX_USER_LAST_NAME} caracteres.`),
    email: z.email(`Defina um e-mail válido.`)
        .max(MAX_USER_EMAIL, `E-mail deve conter no máximo ${MAX_USER_EMAIL} caracteres.`),
    password: passwordSchema,
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
    newPassword: passwordSchema,
    token: z.string().min(1, 'Token obrigatório')
})

export type ResetPassword = z.infer<typeof ResetPasswordSchema>

export const PublicAuthSessionSchema = z.object({
    id: z.uuidv7(),
    isCurrent: z.boolean(),
    lastActivityAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    ipAddress: z.string().nullable(),
    device: z.object({ browser: z.string().nullable(), os: z.string().nullable() })
})

export type PublicAuthSession = z.infer<typeof PublicAuthSessionSchema>

export const PublicAuthSessionListSchema = z.object({
    sessions: PublicAuthSessionSchema.array()
})

export type PublicAuthSessionList = z.infer<typeof PublicAuthSessionListSchema>;