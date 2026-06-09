import z from "zod";
import { MAX_USER_EMAIL, MAX_USER_FIRST_NAME, MAX_USER_LAST_NAME, MAX_USER_PASSWORD, MIN_USER_FIRST_NAME, MIN_USER_LAST_NAME, MIN_USER_PASSWORD, PublicUserSchema } from "./user.schema";

export const SignUpSchema = z.object({
    firstName: z.string('Defina o nome do usuário.')
        .min(MIN_USER_FIRST_NAME, `Nome do usuário deve conter no mínimo ${MIN_USER_FIRST_NAME} caracteres.`)
        .max(MAX_USER_FIRST_NAME, `Nome do usuário deve conter no máximo ${MAX_USER_FIRST_NAME} caracteres.`),
    lastName: z.string('Defina o sobrenome do usuário.')
        .min(MIN_USER_LAST_NAME, `Sobrenome deve conter no mínimo ${MIN_USER_LAST_NAME} caracteres.`)
        .max(MAX_USER_LAST_NAME, `Sobrenome deve conter no máximo ${MAX_USER_LAST_NAME} caracteres.`),
    email: z.email(`Defina um e-mail válido.`)
        .max(MAX_USER_EMAIL, `E-mail deve conter no máximo ${MAX_USER_EMAIL} caracteres.`),
    password: z.string()
        .min(MIN_USER_PASSWORD, `Senha deve conter no mínimo ${MIN_USER_PASSWORD} caracteres.`)
        .max(MAX_USER_PASSWORD, `Senha deve conter no máximo ${MAX_USER_PASSWORD} caracteres.`)
})

export type SignUp = z.infer<typeof SignUpSchema>;

export const PublicAuthSchema = z.object({
    user: PublicUserSchema,
})

export type PublicAuth = z.infer<typeof PublicAuthSchema>;