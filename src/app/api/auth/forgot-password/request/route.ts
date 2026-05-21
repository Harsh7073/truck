import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOTP, getOTPExpiry } from "@/lib/auth";
import { sendEmailOTP, sendSMSOTP } from "@/lib/communication";
import { z } from "zod";

const requestSchema = z.object({
  identifier: z.string().min(3),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier } = requestSchema.parse(body);

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
      return NextResponse.json({ error: "No active user found with this email or phone number" }, { status: 404 });
    }

    const otp = generateOTP();
    const expiry = getOTPExpiry();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otp,
        otpExpiry: expiry,
      },
    });

    // Send OTP via Email and/or SMS
    const sendPromises = [];
    let sentViaEmail = false;
    let sentViaSMS = false;

    if (user.email) {
      sendPromises.push(
        sendEmailOTP(user.email, otp)
          .then((res) => { sentViaEmail = res; })
          .catch((err) => console.error("Error sending OTP email:", err))
      );
    }

    if (user.phone) {
      sendPromises.push(
        sendSMSOTP(user.phone, otp)
          .then((res) => { sentViaSMS = res; })
          .catch((err) => console.error("Error sending OTP SMS:", err))
      );
    }

    await Promise.all(sendPromises);

    return NextResponse.json({
      success: true,
      message: "Verification OTP code sent successfully",
      email: user.email,
      phone: user.phone,
      sentViaEmail,
      sentViaSMS,
    });
  } catch (error) {
    console.error("Forgot password request error:", error);
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 });
  }
}
