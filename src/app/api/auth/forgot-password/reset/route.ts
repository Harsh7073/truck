import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";

const resetSchema = z.object({
  identifier: z.string().min(3),
  otp: z.string().length(6),
  newPassword: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, otp, newPassword } = resetSchema.parse(body);

    const cleanPhone = identifier.replace(/\D/g, "");

    // Search user by email or by phone matching criteria
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { phone: identifier },
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
          ...(cleanPhone.length === 10 ? [{ phone: { endsWith: cleanPhone } }] : [])
        ]
      }
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "User not found or inactive" }, { status: 404 });
    }

    if (!user.otp || !user.otpExpiry) {
      return NextResponse.json({ error: "No OTP was requested for this user" }, { status: 400 });
    }

    // Verify OTP matches
    if (user.otp !== otp) {
      return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
    }

    // Verify OTP is not expired
    if (new Date() > new Date(user.otpExpiry)) {
      return NextResponse.json({ error: "OTP code has expired. Please request a new one" }, { status: 400 });
    }

    // Update password
    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpiry: null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        description: "Password reset successfully via OTP verification",
        module: "AUTH",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Your password has been reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    console.error("Forgot password reset error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to reset password: ${errorMsg}` }, { status: 500 });
  }
}
