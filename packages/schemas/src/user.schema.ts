import z from "zod";

export const CreateUserSchema = z.object({
    name: z.string().min(2, 'Nome de usuário deve conter no mínimo 2 carácteres!'),
    email: z.email(),
    password: z.string().min(8)
})

export type CreateUserDto = z.infer<typeof CreateUserSchema>

export const testFun = () => console.log('hello, api!')