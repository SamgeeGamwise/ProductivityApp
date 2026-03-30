import { NextResponse } from "next/server";

export const dynamic = "force-static";

const FALLBACK_QUOTES = [
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "You are never too small to make a difference.", author: "Greta Thunberg" },
  { quote: "In every day, there are 1,440 minutes. That means we have 1,440 daily opportunities to make a positive impact.", author: "Les Brown" },
  { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { quote: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose.", author: "Dr. Seuss" },
  { quote: "Today you are you, that is truer than true. There is no one alive who is youer than you.", author: "Dr. Seuss" },
  { quote: "A person who never made a mistake never tried anything new.", author: "Albert Einstein" },
  { quote: "Kindness is a language which the deaf can hear and the blind can see.", author: "Mark Twain" },
  { quote: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.", author: "Dr. Seuss" },
  { quote: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { quote: "Try to be a rainbow in someone's cloud.", author: "Maya Angelou" },
  { quote: "Keep your face always toward the sunshine, and shadows will fall behind you.", author: "Walt Whitman" },
];

function getDailyFallback() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return FALLBACK_QUOTES[dayOfYear % FALLBACK_QUOTES.length];
}

export async function GET() {
  try {
    const response = await fetch("https://zenquotes.io/api/today", {
      next: { revalidate: 3600 },
    });

    if (!response.ok) throw new Error(`ZenQuotes responded ${response.status}`);

    const data = await response.json();
    const item = Array.isArray(data) ? data[0] : null;

    if (!item?.q || !item?.a) throw new Error("Unexpected response shape");

    return NextResponse.json({ quote: item.q, author: item.a });
  } catch (error) {
    console.error("Quote API error:", error);
    return NextResponse.json(getDailyFallback());
  }
}
