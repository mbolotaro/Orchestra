import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users.service';
import type { CreateUserInput } from '../types/create-user.type';
import { PublicUser } from '@orchestra/schemas';
import { EmailAlreadyExistsException } from '../../../common/exceptions/email-already-exists.exception';

const passwordInput: CreateUserInput = {
  kind: 'password',
  firstName: 'Mario',
  lastName: 'Souza',
  email: 'mario@test.com',
  passwordHash: '$2b$12$abc',
};

const publicUser: PublicUser = {
  id: '0193b3c0-0000-7000-8000-000000000000',
  firstName: 'Mario',
  lastName: 'Souza',
  email: 'mario@test.com',
};

const dbUser = {
  ...publicUser,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: null,
  isEmailVerified: false,
  passwordHash: '$2b$12$abc',
  deletedAt: null,
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  it('happy path: is instantiated with its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('happy path: creates user with password and returns PublicUser', async () => {
      prisma.user.create.mockResolvedValue(dbUser);

      const result = await service.create(passwordInput);

      expect(result).toEqual(publicUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          firstName: 'Mario',
          lastName: 'Souza',
          email: 'mario@test.com',
          passwordHash: '$2b$12$abc',
        },
        omit: { passwordHash: true },
      });
    });

    it('happy path: uses provided tx client when passed', async () => {
      const tx = mockDeep<PrismaService>();
      tx.user.create.mockResolvedValue(dbUser);

      await service.create(passwordInput, tx);

      expect(tx.user.create).toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('error: throws EmailAlreadyExistsException when email already exists (P2002)', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.0.0',
          meta: { target: ['email'] },
        },
      );
      prisma.user.create.mockRejectedValue(p2002);

      await expect(service.create(passwordInput)).rejects.toThrow(
        EmailAlreadyExistsException,
      );
    });

    it('error: throws InternalServerErrorException for non-P2002 prisma errors', async () => {
      prisma.user.create.mockRejectedValue(new Error('db down'));

      await expect(service.create(passwordInput)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('error: throws InternalServerErrorException for unique violation on a different field', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '7.0.0',
        meta: { target: ['other_field'] },
      });
      prisma.user.create.mockRejectedValue(p2002);

      await expect(service.create(passwordInput)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getById', () => {
    it('happy path: returns PublicUser when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser);

      const result = await service.getById(publicUser.id);

      expect(result).toEqual(publicUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: publicUser.id },
        omit: { passwordHash: true },
      });
    });

    it('happy path: uses tx client when provided', async () => {
      const tx = mockDeep<PrismaService>();
      tx.user.findUnique.mockResolvedValue(dbUser);

      await service.getById(publicUser.id, tx);

      expect(tx.user.findUnique).toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('error: throws NotFoundException when user is not in DB', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('error: throws InternalServerErrorException when prisma fails', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('db down'));

      await expect(service.getById('any')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findRawByEmail', () => {
    it('happy path: returns full User row (including passwordHash)', async () => {
      prisma.user.findFirst.mockResolvedValue(dbUser);

      const result = await service.findRawByEmail(publicUser.email);

      expect(result).toEqual(dbUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: publicUser.email },
      });
    });

    it('edge case: returns null when email is not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.findRawByEmail('missing@test.com'),
      ).resolves.toBeNull();
    });

    it('error: throws InternalServerErrorException when prisma fails', async () => {
      prisma.user.findFirst.mockRejectedValue(new Error('db down'));

      await expect(service.findRawByEmail('x@y.com')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
