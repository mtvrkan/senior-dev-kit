# Project Preset — NestJS

## Architecture

- Respect module/controller/service/provider boundaries. Never bypass this separation.
- Controllers: route handling, request parsing, response shaping only. Zero business logic.
- Services: all business logic, orchestration, error throwing.
- Repositories/entities: data access only. Use TypeORM repositories or Prisma client.
- Do not modify guards, interceptors, global pipes, or modules unless explicitly requested.
- Feature modules: each domain in its own module (`UsersModule`, `AuthModule`, etc.). Never dump everything into `AppModule`.

## DTOs & Validation

Always use class-validator + class-transformer DTOs for request bodies. Never pass raw `req.body` to services.

`create-user.dto.ts`:

```typescript
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator'
import { Transform } from 'class-transformer'

export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string

  @IsString()
  @MinLength(8)
  password: string

  @IsOptional()
  @IsString()
  name?: string
}
```

Global validation pipe (in `main.ts`):

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
```

`whitelist: true` strips unknown properties; `transform: true` auto-transforms the payload to the
DTO class. Never skip `whitelist: true` — it prevents mass assignment.

## Controllers

Thin controllers only. One responsibility: map HTTP → service → HTTP response.

The response is a DTO, never the entity. A `User` entity carries the password hash, and returning
it serializes every column to the client. `user-response.dto.ts`:

```typescript
export class UserResponseDto {
  id: string
  email: string
  name?: string

  static from(user: User): UserResponseDto {
    return { id: user.id, email: user.email, name: user.name }
  }
}
```

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.usersService.create(dto))
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.usersService.findOneOrFail(id, req.user.id))
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Request() req,
  ): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.usersService.update(id, dto, req.user.id))
  }
}
```

The controller passes `req.user.id` through; the ownership check happens in the service.

## Services

All business logic here. Throw typed exceptions — never return raw error objects.

```typescript
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async findOneOrFail(id: string, requesterId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } })
    if (!user) throw new NotFoundException(`User ${id} not found`)
    if (user.id !== requesterId) throw new ForbiddenException()
    return user
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } })
    if (existing) throw new ConflictException('Email already in use')
    const user = this.userRepo.create({ ...dto, password: await hash(dto.password, 12) })
    return this.userRepo.save(user)
  }
}
```

Use NestJS built-in exceptions: `NotFoundException`, `ForbiddenException`, `ConflictException`, `BadRequestException`, `UnauthorizedException`. Never throw plain `Error`.

## Guards & Auth

- `JwtAuthGuard` for protected routes. Apply at controller or route level.
- Always verify ownership server-side in the service — never trust user-provided IDs blindly.
- Role-based access: `@Roles('admin')` decorator + `RolesGuard`. Never check roles in service logic.
- Never modify `AuthModule`, `JwtStrategy`, or existing guards without security-guard review.

Protect an entire controller:

```typescript
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController { ... }
```

Protect a single route:

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@Request() req) { return req.user }
```

## Error Handling

Use built-in NestJS HTTP exceptions. Add a global exception filter only if the project already has one.

A custom exception for domain errors:

```typescript
export class BusinessRuleException extends BadRequestException {
  constructor(rule: string) {
    super({ code: 'BUSINESS_RULE_VIOLATION', rule })
  }
}
```

Never expose stack traces or internal error details in responses. Use `app.useGlobalFilters(new HttpExceptionFilter())` to standardize error shape if project convention demands.

## Data Access

- TypeORM: use `Repository<Entity>` injected via `@InjectRepository`. Never use `EntityManager` for simple CRUD.
- Multi-step operations: wrap in `DataSource.transaction()` or `queryRunner`.
- Prisma: inject `PrismaService`, call `prisma.$transaction([...])` for atomicity.
- Never access DB directly in controllers.

A TypeORM transaction:

```typescript
async transferFunds(fromId: string, toId: string, amount: number) {
  await this.dataSource.transaction(async (manager) => {
    await manager.decrement(Account, { id: fromId }, 'balance', amount)
    await manager.increment(Account, { id: toId }, 'balance', amount)
  })
}
```

## Configuration & Secrets

Use `@nestjs/config` with `ConfigService`. Never hardcode secrets or use `process.env` directly in services.

```typescript
@Injectable()
export class AppService {
  constructor(private config: ConfigService) {}
  
  getJwtSecret() {
    return this.config.getOrThrow<string>('JWT_SECRET')
  }
}
```

`getOrThrow` throws if the variable is missing.

Register `ConfigModule.forRoot({ isGlobal: true, validationSchema: Joi.object({...}) })` in `AppModule` to fail fast on missing env vars.

## Testing

Targeted test files only — never run full suite for a single change.

`users.service.spec.ts`:

```typescript
describe('UsersService', () => {
  let service: UsersService
  let userRepo: MockRepository<User>

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useFactory: mockRepository },
      ],
    }).compile()
    service = module.get(UsersService)
    userRepo = module.get(getRepositoryToken(User))
  })

  it('throws NotFoundException when user not found', async () => {
    userRepo.findOne.mockResolvedValue(null)
    await expect(service.findOneOrFail('uuid', 'requester')).rejects.toThrow(NotFoundException)
  })
})
```

Run: `jest users.service.spec.ts --no-coverage`

## Verification

- `eslint src/` (the Nest CLI has no `lint` subcommand)
- `tsc --noEmit`
- `jest [file].spec.ts --no-coverage` (targeted)
- `jest --no-coverage` (full suite, only before PR)
- `nest build` to catch TypeScript/compilation errors (DI wiring errors surface at bootstrap — cover those with an e2e/bootstrap test)

## Security

- Validate ALL inputs at controller boundary (global `ValidationPipe` with `whitelist: true`).
- Rate-limit auth endpoints: `@nestjs/throttler` with `ThrottlerGuard`.
- Never log passwords, tokens, or full request bodies.
- Helmet for HTTP headers: `app.use(helmet())` in `main.ts`.
- CORS: configure explicit origin list, never `*` for credentialed requests.

## Anti-patterns

- Business logic in controllers.
- Bypassing DTO validation with `@Body() body: any`.
- `process.env.SECRET` directly in services (use `ConfigService`).
- Changing global module wiring (guards, pipes, interceptors, modules) for a local feature.
- `EntityManager` for simple CRUD — use typed `Repository<T>`.
- Returning raw DB errors to the client (expose safe messages only).
- Missing `whitelist: true` on `ValidationPipe` (mass assignment risk).
- `@Public()` decorator on sensitive endpoints without explicit justification.
