"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchMidpoint } from "@/lib/api/clob";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { revalidatePath } from "next/cache";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function placeTrade(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const conditionId = formData.get("conditionId") as string;
  const tokenId = formData.get("tokenId") as string;
  const outcome = formData.get("outcome") as string;
  const side = formData.get("side") as string;
  const amount = parseFloat(formData.get("amount") as string);

  if (!conditionId || !tokenId || !outcome || !side || isNaN(amount) || amount <= 0) {
    return { error: "Invalid trade parameters" };
  }

  // Fetch current price from CLOB
  let price: number;
  try {
    const mid = await fetchMidpoint(tokenId);
    price = parseFloat(mid);
    if (isNaN(price) || price <= 0) {
      return { error: "Could not determine market price" };
    }
  } catch {
    return { error: "Failed to fetch market price" };
  }

  const shares = amount / price;
  const total = amount;

  // Check balance for buys
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return { error: "User not found" };
  }

  if (side === "BUY" && user.balance < total) {
    return { error: `Insufficient balance. You have $${user.balance.toFixed(2)}` };
  }

  const userId = session.user.id;

  // Execute the trade in a transaction
  await prisma.$transaction(async (tx: TransactionClient) => {
    // Record the trade
    await tx.trade.create({
      data: {
        userId: userId,
        conditionId,
        tokenId,
        outcome,
        side,
        price,
        shares,
        total,
      },
    });

    // Update balance
    if (side === "BUY") {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: total } },
      });

      // Upsert position
      const existing = await tx.position.findUnique({
        where: { userId_tokenId: { userId: userId, tokenId } },
      });

      if (existing) {
        const newShares = existing.shares + shares;
        const newAvgPrice =
          (existing.avgPrice * existing.shares + price * shares) / newShares;
        await tx.position.update({
          where: { id: existing.id },
          data: { shares: newShares, avgPrice: newAvgPrice },
        });
      } else {
        await tx.position.create({
          data: {
            userId: userId,
            conditionId,
            tokenId,
            outcome,
            shares,
            avgPrice: price,
          },
        });
      }
    } else {
      // SELL
      await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: total } },
      });

      const existing = await tx.position.findUnique({
        where: { userId_tokenId: { userId: userId, tokenId } },
      });

      if (existing) {
        const newShares = existing.shares - shares;
        if (newShares <= 0.001) {
          await tx.position.delete({ where: { id: existing.id } });
        } else {
          await tx.position.update({
            where: { id: existing.id },
            data: { shares: newShares },
          });
        }
      }
    }
  });

  revalidatePath("/portfolio");
  return { success: true };
}
