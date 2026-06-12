import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserInput } from './types/create-user.type';
import { PublicUser, PublicUserSchema } from '@orchestra/schemas';
import { getPrismaError } from '../prisma/helpers/get-prisma-error.helper';
import { TransactionClient } from '../../generated/prisma/internal/prismaNamespace';
import { User } from '../../generated/prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async create(
    createUserInput: CreateUserInput,
    tx?: TransactionClient,
  ): Promise<PublicUser> {
    const client = tx ?? this.prismaService;

    try {
      if (createUserInput.kind === 'oauth') {
        throw new NotImplementedException(
          'Autenticação a partir de oauth ainda não foi implementada.',
        );
      }

      const createdUser = await client.user.create({
        data: {
          firstName: createUserInput.firstName,
          lastName: createUserInput.lastName,
          email: createUserInput.email,
          passwordHash: createUserInput.passwordHash,
        },
        omit: { passwordHash: true },
      });

      return PublicUserSchema.parse(createdUser);
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error({ error, email: createUserInput.email }, 'create');

      const errorInfo = getPrismaError(error);

      if (errorInfo.kind === 'unique' && errorInfo.field === 'email') {
        throw new ConflictException(
          'Já existe um usuário com este e-mail cadastrado.',
        );
      }

      throw new InternalServerErrorException(
        'Não foi possível cadastrar usuário.',
      );
    }
  }

  async getById(userId: string, tx?: TransactionClient): Promise<PublicUser> {
    try {
      const client = tx ?? this.prismaService;
      const user = await client.user.findUnique({
        where: { id: userId },
        omit: { passwordHash: true },
      });

      if (!user) {
        throw new NotFoundException('Usuário não encontrado!');
      }

      return PublicUserSchema.parse(user);
    } catch (error) {
      this.logger.error({ error, userId }, 'getById');

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException('Não foi possível obter');
    }
  }

  async findRawByEmail(
    email: string,
    tx?: TransactionClient,
  ): Promise<User | null> {
    const client = tx ?? this.prismaService;

    try {
      const user = await client.user.findFirst({ where: { email } });

      return user;
    } catch (error) {
      this.logger.error({ error, email }, 'findRawByEmail');

      throw new InternalServerErrorException(
        'Não foi possível buscar usuário pelo e-mail!',
      );
    }
  }
}
