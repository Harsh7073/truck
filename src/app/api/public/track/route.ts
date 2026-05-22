import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lrNumber = searchParams.get("lrNumber");

    if (!lrNumber) {
      return NextResponse.json({ error: "LR Number is required" }, { status: 400 });
    }

    const bilty = await prisma.bilty.findUnique({
      where: { lrNumber },
      include: {
        company: {
          select: {
            name: true,
          },
        },
        vehicle: {
          select: {
            vehicleNumber: true,
            type: {
              select: {
                name: true,
              },
            },
          },
        },
        driver: {
          select: {
            name: true,
            phone: true,
          },
        },
        consignor: {
          select: {
            name: true,
          },
        },
        consignee: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!bilty) {
      return NextResponse.json({ error: "LR Number not found" }, { status: 404 });
    }

    // Return sanitized data (no private pricing details)
    return NextResponse.json({
      id: bilty.id,
      lrNumber: bilty.lrNumber,
      lrDate: bilty.lrDate,
      fromCity: bilty.fromCity,
      toCity: bilty.toCity,
      via: bilty.via,
      status: bilty.status,
      deliveredAt: bilty.deliveredAt,
      goodsDescription: bilty.goodsDescription,
      quantity: bilty.quantity,
      unit: bilty.unit,
      weight: bilty.weight,
      weightUnit: bilty.weightUnit,
      companyName: bilty.company.name,
      vehicleNumber: bilty.vehicle.vehicleNumber,
      vehicleType: bilty.vehicle.type.name,
      driverName: bilty.driver?.name || null,
      consignorName: bilty.consignor.name,
      consigneeName: bilty.consignee.name,
    });
  } catch (error) {
    console.error("Public tracking error:", error);
    return NextResponse.json({ error: "Failed to fetch tracking details" }, { status: 500 });
  }
}
