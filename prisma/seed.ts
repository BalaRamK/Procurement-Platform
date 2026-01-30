import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("Database already has users. Skipping seed (run with reset to replace).");
    return;
  }

  const superAdmin = await prisma.user.create({
    data: {
      email: "admin@qnulabs.com",
      name: "Super Admin",
      role: "SUPER_ADMIN",
      status: true,
    },
  });

  const requester = await prisma.user.create({
    data: {
      email: "requester@qnulabs.com",
      name: "Jane Requester",
      role: "REQUESTER",
      status: true,
    },
  });

  const fhInnovation = await prisma.user.create({
    data: {
      email: "fh-innovation@qnulabs.com",
      name: "FH Innovation",
      role: "FUNCTIONAL_HEAD",
      team: "INNOVATION",
      status: true,
    },
  });

  const fhEngineering = await prisma.user.create({
    data: {
      email: "fh-engineering@qnulabs.com",
      name: "FH Engineering",
      role: "FUNCTIONAL_HEAD",
      team: "ENGINEERING",
      status: true,
    },
  });

  const l1Sales = await prisma.user.create({
    data: {
      email: "l1-sales@qnulabs.com",
      name: "L1 Sales (Prem)",
      role: "L1_APPROVER",
      team: "SALES",
      status: true,
    },
  });

  const l1Innovation = await prisma.user.create({
    data: {
      email: "l1-innovation@qnulabs.com",
      name: "L1 Innovation (Dilip)",
      role: "L1_APPROVER",
      team: "INNOVATION",
      status: true,
    },
  });

  const l1Engineering = await prisma.user.create({
    data: {
      email: "l1-engineering@qnulabs.com",
      name: "L1 Engineering (Dilip)",
      role: "L1_APPROVER",
      team: "ENGINEERING",
      status: true,
    },
  });

  const cfo = await prisma.user.create({
    data: {
      email: "cfo@qnulabs.com",
      name: "CFO",
      role: "CFO",
      status: true,
    },
  });

  const cdo = await prisma.user.create({
    data: {
      email: "cdo@qnulabs.com",
      name: "CDO",
      role: "CDO",
      status: true,
    },
  });

  const production = await prisma.user.create({
    data: {
      email: "production@qnulabs.com",
      name: "Production Team",
      role: "PRODUCTION",
      status: true,
    },
  });

  await prisma.ticket.createMany({
    data: [
      {
        title: "Laptop - Dev team Q1",
        description: "5 units for new joiners.",
        requesterName: "Jane Requester",
        department: "Engineering",
        componentDescription: "Dell XPS 15",
        itemName: "Laptop Dell XPS 15",
        rate: 1299.99,
        unit: "pcs",
        quantity: 5,
        estimatedCost: 6499.95,
        costCurrency: "USD",
        teamName: "ENGINEERING",
        priority: "HIGH",
        status: "PENDING_FH_APPROVAL",
        requesterId: requester.id,
      },
      {
        title: "Office chairs - Floor 2",
        description: "Ergonomic chairs for meeting room.",
        requesterName: "Jane Requester",
        department: "Facilities",
        itemName: "Ergonomic Office Chair",
        rate: 349.5,
        unit: "pcs",
        quantity: 10,
        estimatedCost: 3495,
        costCurrency: "USD",
        teamName: "ENGINEERING",
        priority: "MEDIUM",
        status: "DRAFT",
        requesterId: requester.id,
      },
      {
        title: "Server rack components",
        description: "Rack rails and cable management.",
        requesterName: "Jane Requester",
        department: "IT",
        componentDescription: "Server Rack Kit",
        itemName: "Server Rack Kit",
        rate: 899,
        unit: "set",
        quantity: 2,
        estimatedCost: 1798,
        costCurrency: "USD",
        teamName: "INNOVATION",
        priority: "HIGH",
        status: "ASSIGNED_TO_PRODUCTION",
        requesterId: requester.id,
      },
      {
        title: "Cloud subscription - Annual",
        description: "AWS and Zoho annual renewal.",
        requesterName: "Jane Requester",
        department: "IT",
        estimatedCost: 12000,
        costCurrency: "USD",
        quantity: 1,
        teamName: "SALES",
        priority: "MEDIUM",
        status: "PENDING_CFO_APPROVAL",
        requesterId: requester.id,
      },
      {
        title: "Training materials",
        description: "Printed manuals for onboarding.",
        requesterName: "Jane Requester",
        department: "HR",
        itemName: "Training Pack",
        rate: 45,
        unit: "pcs",
        quantity: 50,
        estimatedCost: 2250,
        costCurrency: "USD",
        teamName: "ENGINEERING",
        priority: "LOW",
        status: "REJECTED",
        rejectionRemarks: "Budget not approved for this quarter.",
        requesterId: requester.id,
      },
    ],
  });

  console.log("Seed completed: 10 users (incl. FH/L1 per team), 5 sample tickets.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
