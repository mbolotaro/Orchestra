import z from "zod";

export const CreateUserSchema = z.object({
    name: z.string().min(2),
    email: z.email(),
    password: z.string().min(8)
})

export type CreateUserDto = z.infer<typeof CreateUserSchema>

export const testFun = () => console.log('hello, api!')