import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const DEFAULT_SETTINGS = {
  phoneDisplay: "",
  phoneIntl: "",
  whatsapp: "",
  email: "",
  addressFr: "",
  addressAr: "",
};

type SyncType = "products" | "projects" | "settings";

function isValidType(type: string | null): type is SyncType {
  return type === "products" || type === "projects" || type === "settings";
}

interface ProductVariantInput {
  id?: string;
  name: string;
  nameAr: string;
  nameEn: string;
  img: string;
}

interface ProductInput {
  id?: string | number;
  slug: string;
  category: string;
  name: string;
  nameAr: string;
  nameEn: string;
  desc?: string;
  descAr?: string;
  descEn?: string;
  img: string;
  isBestSeller?: boolean;
  variants?: ProductVariantInput[];
}

interface ProjectInput {
  id?: string | number;
  slug?: string;
  category: string;
  title: string;
  titleAr?: string;
  titleEn?: string;
  material: string;
  materialAr?: string;
  materialEn?: string;
  desc: string;
  descAr?: string;
  descEn?: string;
  img: string;
}

async function getProducts() {
  const products = await prisma.product.findMany({
    include: { variants: true },
    orderBy: { createdAt: "asc" },
  });
  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    category: p.category,
    name: p.name,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    desc: p.desc ?? undefined,
    descAr: p.descAr ?? undefined,
    descEn: p.descEn ?? undefined,
    img: p.img,
    isBestSeller: p.isBestSeller,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      nameAr: v.nameAr,
      nameEn: v.nameEn,
      img: v.img,
    })),
  }));
}

function generateSlug(title: string) {
  if (!title) return "";
  return title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getProjects() {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" } });
  return projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    category: p.category,
    title: p.title,
    titleAr: p.titleAr ?? undefined,
    titleEn: p.titleEn ?? undefined,
    material: p.material,
    materialAr: p.materialAr ?? undefined,
    materialEn: p.materialEn ?? undefined,
    desc: p.desc,
    descAr: p.descAr ?? undefined,
    descEn: p.descEn ?? undefined,
    img: p.img,
  }));
}

async function getSettings() {
  const settings = await prisma.siteSettings.findFirst();
  if (!settings) return DEFAULT_SETTINGS;
  return {
    phoneDisplay: settings.phoneDisplay,
    phoneIntl: settings.phoneIntl,
    whatsapp: settings.whatsapp,
    email: settings.email,
    addressFr: settings.addressFr,
    addressAr: settings.addressAr,
  };
}

async function replaceProducts(data: ProductInput[]) {
  await prisma.$transaction(async (tx) => {
    await tx.product.deleteMany();
    for (const p of data) {
      await tx.product.create({
        data: {
          slug: p.slug,
          category: p.category,
          name: p.name,
          nameAr: p.nameAr,
          nameEn: p.nameEn,
          desc: p.desc,
          descAr: p.descAr,
          descEn: p.descEn,
          img: p.img,
          isBestSeller: p.isBestSeller ?? false,
          variants: p.variants?.length
            ? {
                create: p.variants.map((v) => ({
                  name: v.name,
                  nameAr: v.nameAr,
                  nameEn: v.nameEn,
                  img: v.img,
                })),
              }
            : undefined,
        },
      });
    }
  });
  return getProducts();
}

async function replaceProjects(data: ProjectInput[]) {
  await prisma.$transaction(async (tx) => {
    await tx.project.deleteMany();
    const usedSlugs = new Set<string>();
    for (const p of data) {
      const base = (p.slug && p.slug.trim()) || generateSlug(p.title) || "projet";
      let slug = base;
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${base}-${suffix}`;
        suffix++;
      }
      usedSlugs.add(slug);
      await tx.project.create({
        data: {
          slug,
          category: p.category,
          title: p.title,
          titleAr: p.titleAr,
          titleEn: p.titleEn,
          material: p.material,
          materialAr: p.materialAr,
          materialEn: p.materialEn,
          desc: p.desc,
          descAr: p.descAr,
          descEn: p.descEn,
          img: p.img,
        },
      });
    }
  });
  return getProjects();
}

async function saveSettings(data: Record<string, string>) {
  const merged = { ...DEFAULT_SETTINGS, ...data };
  const existing = await prisma.siteSettings.findFirst();
  if (existing) {
    await prisma.siteSettings.update({ where: { id: existing.id }, data: merged });
  } else {
    await prisma.siteSettings.create({ data: merged });
  }
  return getSettings();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (!isValidType(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (type === "products") return NextResponse.json(await getProducts());
    if (type === "projects") return NextResponse.json(await getProjects());
    return NextResponse.json(await getSettings());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (!isValidType(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (type === "products") {
      const saved = await replaceProducts(data);
      return NextResponse.json({ success: true, data: saved });
    }
    if (type === "projects") {
      const saved = await replaceProjects(data);
      return NextResponse.json({ success: true, data: saved });
    }
    const saved = await saveSettings(data);
    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
