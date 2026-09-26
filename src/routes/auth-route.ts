import { Hono } from "hono";
import { sign } from "hono/jwt";
import { loginSchema, registerSchema } from "../validation/auth-validation";
import zValidator from "../middleware/validation-middleware";
import db from "../db/prisma";
import { AppError } from "../middleware/error-handler";
import bcrypt from "bcryptjs";
import { SignatureKey } from "hono/utils/jwt/jws";

const authRoute = new Hono().basePath("/auth");

authRoute.post("/register", zValidator("json", registerSchema), async (c) => {
  const data = c.req.valid("json");

  const existingUser = await db.user.findUnique({
    where: {
      email: data.email,
    },
  });

  if (existingUser) {
    throw new AppError("Email already registered", 409, "EMAIL_ALREADY_EXISTS");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: hashedPassword,
      roleId: data.roleId,
      departmentId: data.departmentId,
      clientId: data.clientId,
    },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      department: true,
    },
  });

  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    {
      sub: user.id.toString(),
      email: user.email,
      roleId: user.roleId,
      departmentId: user.departmentId,
      clientId: user.clientId,
      permissions: user.role.permissions.map((item) => item.permission.name),
      iat: now,
      exp: now + Number(process.env.JWT_EXPIRES_IN),
    },
    process.env.JWT_SECRET!,
  );

  return c.json(
    {
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          roleId: user.roleId,
          departmentId: user.departmentId,
          clientId: user.clientId,
        },
        accessToken: token,
      },
    },
    201,
  );
});

authRoute.post("/login", zValidator("json", loginSchema), async (c) => {
  const data = c.req.valid("json");

  const user = await db.user.findUnique({
    where: {
      email: data.email,
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      department: true,
    },
  });

  if (!user) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const isPasswordValid = await bcrypt.compare(
    data.password,
    user.passwordHash,
  );

  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const now = Math.floor(Date.now() / 1000);

  const token = await sign(
    {
      sub: user.id.toString(),
      email: user.email,
      roleId: user.roleId,
      departmentId: user.departmentId,
      clientId: user.clientId,
      permissions: user.role.permissions.map((item) => item.permission.name),
      iat: now,
      exp: now + Number(process.env.JWT_EXPIRES_IN),
    },
    process.env.JWT_SECRET!,
  );

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        departmentId: user.departmentId,
        clientId: user.clientId,
      },
      accessToken: token,
    },
  });
});

export default authRoute;
