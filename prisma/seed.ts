import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Seeding database...");

  // =========================
  // PASSWORD
  // =========================

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // =========================
  // DEPARTMENTS
  // =========================

  const frontendDepartment = await prisma.department.upsert({
    where: {
      name: "Frontend",
    },
    update: {},
    create: {
      name: "Frontend",
    },
  });

  const backendDepartment = await prisma.department.upsert({
    where: {
      name: "Backend",
    },
    update: {},
    create: {
      name: "Backend",
    },
  });

  const uiuxDepartment = await prisma.department.upsert({
    where: {
      name: "UI/UX",
    },
    update: {},
    create: {
      name: "UI/UX",
    },
  });

  const pmDepartment = await prisma.department.upsert({
    where: {
      name: "Product Management",
    },
    update: {},
    create: {
      name: "Product Management",
    },
  });

  // =========================
  // ROLES
  // =========================

  const pmRole = await prisma.role.upsert({
    where: {
      name: "PRODUCT_MANAGER",
    },
    update: {},
    create: {
      name: "PRODUCT_MANAGER",
    },
  });

  const internalTeamRole = await prisma.role.upsert({
    where: {
      name: "INTERNAL_TEAM",
    },
    update: {},
    create: {
      name: "INTERNAL_TEAM",
    },
  });

  const clientRole = await prisma.role.upsert({
    where: {
      name: "CLIENT_GUEST",
    },
    update: {},
    create: {
      name: "CLIENT_GUEST",
    },
  });

  // =========================
  // PERMISSIONS
  // =========================

  const permissionNames = [
    "PROJECT_READ",
    "PROJECT_CREATE",
    "PROJECT_UPDATE",
    "PROJECT_DELETE",

    "TASK_READ",
    "TASK_CREATE",
    "TASK_UPDATE",
    "TASK_DELETE",

    "TASK_UPDATE_STATUS",
    "TASK_ASSIGN",

    "TASK_DEPENDENCY_CREATE",
    "TASK_DEPENDENCY_DELETE",

    "TASK_ATTACHMENT_CREATE",
    "TASK_ATTACHMENT_DELETE",

    "TASK_COMMENT_CREATE",
  ];

  const permissions = new Map<
    string,
    Awaited<ReturnType<typeof prisma.permission.upsert>>
  >();

  for (const name of permissionNames) {
    const permission = await prisma.permission.upsert({
      where: {
        name,
      },
      update: {},
      create: {
        name,
      },
    });

    permissions.set(name, permission);
  }

  // =========================
  // ROLE PERMISSIONS
  // =========================

  const assignPermissions = async (roleId: number, names: string[]) => {
    for (const name of names) {
      const permission = permissions.get(name);

      if (!permission) {
        throw new Error(`Permission ${name} not found`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId: permission.id,
        },
      });
    }
  };

  // =========================
  // PRODUCT MANAGER
  // =========================

  await assignPermissions(pmRole.id, [
    "PROJECT_READ",
    "PROJECT_CREATE",
    "PROJECT_UPDATE",
    "PROJECT_DELETE",

    "TASK_READ",
    "TASK_CREATE",
    "TASK_UPDATE",
    "TASK_DELETE",

    "TASK_UPDATE_STATUS",
    "TASK_ASSIGN",

    "TASK_DEPENDENCY_CREATE",
    "TASK_DEPENDENCY_DELETE",

    "TASK_ATTACHMENT_CREATE",
    "TASK_ATTACHMENT_DELETE",

    "TASK_COMMENT_CREATE",
  ]);

  // =========================
  // INTERNAL TEAM
  // =========================

  await assignPermissions(internalTeamRole.id, [
    "PROJECT_READ",

    "TASK_READ",
    "TASK_UPDATE",
    "TASK_UPDATE_STATUS",

    "TASK_ATTACHMENT_CREATE",
    "TASK_ATTACHMENT_DELETE",

    "TASK_COMMENT_CREATE",
  ]);

  // =========================
  // CLIENT GUEST
  // =========================

  await assignPermissions(clientRole.id, ["PROJECT_READ", "TASK_READ"]);

  // =========================
  // CLIENT
  // =========================

  const clientA = await prisma.client.upsert({
    where: {
      email: "client@acme.com",
    },
    update: {},
    create: {
      name: "ACME Corporation",
      email: "client@acme.com",
    },
  });

  // =========================
  // USERS
  // =========================

  const pm = await prisma.user.upsert({
    where: {
      email: "pm@example.com",
    },
    update: {},
    create: {
      email: "pm@example.com",
      name: "Product Manager",
      passwordHash,
      roleId: pmRole.id,
      departmentId: pmDepartment.id,
    },
  });

  const frontend = await prisma.user.upsert({
    where: {
      email: "frontend@example.com",
    },
    update: {},
    create: {
      email: "frontend@example.com",
      name: "Frontend Engineer",
      passwordHash,
      roleId: internalTeamRole.id,
      departmentId: frontendDepartment.id,
    },
  });

  const backend = await prisma.user.upsert({
    where: {
      email: "backend@example.com",
    },
    update: {},
    create: {
      email: "backend@example.com",
      name: "Backend Engineer",
      passwordHash,
      roleId: internalTeamRole.id,
      departmentId: backendDepartment.id,
    },
  });

  const designer = await prisma.user.upsert({
    where: {
      email: "designer@example.com",
    },
    update: {},
    create: {
      email: "designer@example.com",
      name: "UI/UX Designer",
      passwordHash,
      roleId: internalTeamRole.id,
      departmentId: uiuxDepartment.id,
    },
  });

  // =========================
  // CLIENT USER
  // =========================

  await prisma.user.upsert({
    where: {
      email: "guest@acme.com",
    },
    update: {},
    create: {
      email: "guest@acme.com",
      name: "ACME Guest",
      passwordHash,
      roleId: clientRole.id,
      clientId: clientA.id,
    },
  });

  // =========================
  // PROJECT
  // =========================

  const project = await prisma.project.create({
    data: {
      name: "ACME E-Commerce Platform",
      clientId: clientA.id,
    },
  });

  // =========================
  // PROJECT MEMBERS
  // =========================

  await prisma.projectMember.createMany({
    data: [
      {
        projectId: project.id,
        userId: pm.id,
      },
      {
        projectId: project.id,
        userId: frontend.id,
      },
      {
        projectId: project.id,
        userId: backend.id,
      },
      {
        projectId: project.id,
        userId: designer.id,
      },
    ],
    skipDuplicates: true,
  });

  // =========================
  // TASKS
  // =========================

  const uiTask = await prisma.task.create({
    data: {
      projectId: project.id,
      assigneeId: designer.id,
      title: "Create Login UI",
      description: "Design login page and responsive states.",
      status: TaskStatus.DONE,
      clientVisible: true,
    },
  });

  const frontendTask = await prisma.task.create({
    data: {
      projectId: project.id,
      assigneeId: frontend.id,
      title: "Implement Login Page",
      description: "Implement login page based on approved UI/UX design.",
      status: TaskStatus.TODO,
      clientVisible: true,
    },
  });

  const backendTask = await prisma.task.create({
    data: {
      projectId: project.id,
      assigneeId: backend.id,
      title: "Create Login API",
      description: "Create authentication endpoint for user login.",
      status: TaskStatus.IN_PROGRESS,
      clientVisible: false,
    },
  });

  const integrationTask = await prisma.task.create({
    data: {
      projectId: project.id,
      assigneeId: frontend.id,
      title: "Integrate Login",
      description: "Integrate frontend login with authentication API.",
      status: TaskStatus.TODO,
      clientVisible: true,
    },
  });

  // =========================
  // DEPENDENCIES
  // =========================

  await prisma.taskDependency.create({
    data: {
      taskId: frontendTask.id,
      dependsOnId: uiTask.id,
    },
  });

  await prisma.taskDependency.create({
    data: {
      taskId: integrationTask.id,
      dependsOnId: frontendTask.id,
    },
  });

  await prisma.taskDependency.create({
    data: {
      taskId: integrationTask.id,
      dependsOnId: backendTask.id,
    },
  });

  // =========================
  // COMMENT
  // =========================

  await prisma.taskComment.create({
    data: {
      taskId: frontendTask.id,
      userId: pm.id,
      content: "Please follow the approved UI design.",
      isInternal: true,
    },
  });

  // =========================
  // AUDIT LOG
  // =========================

  await prisma.taskAuditLog.create({
    data: {
      taskId: uiTask.id,
      userId: designer.id,
      changedColumn: "status",
      oldValue: "IN_PROGRESS",
      newValue: "DONE",
    },
  });

  console.log("✅ Seed completed!");
  console.log("");
  console.log("Test accounts:");
  console.log("PM       : pm@example.com");
  console.log("Frontend : frontend@example.com");
  console.log("Backend  : backend@example.com");
  console.log("Designer : designer@example.com");
  console.log("Client   : guest@acme.com");
  console.log("");
  console.log("Password: Password123!");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
