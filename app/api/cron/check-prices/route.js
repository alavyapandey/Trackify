import { sendPriceDropAlert } from "@/lib/email";
import { scrapeProduct } from "@/lib/firecrawl";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Price check endpoint is working. Use POST to trigger.",
  });
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: products, error: productsError } = await supabase
      .from("trackify_products")
      .select("*");

    if (productsError) throw productsError;

    console.log(`Found ${products.length} products to check`);

    const results = {
      total: products.length,
      updated: 0,
      failed: 0,
      priceChanges: 0,
      alertsSent: 0,
    };

    for (const product of products) {
      try {
        const productData = await scrapeProduct(product.url);

        if (!productData.currentPrice) {
          console.warn(
            `No price returned for product ${product.id} (${product.url})`,
          );
          console.warn(
            "scrapeProduct returned:",
            JSON.stringify(productData).slice(0, 300),
          );
          results.failed++;
          continue;
        }
        const rawPrice = String(productData.currentPrice).replace(
          /[^0-9.]/g,
          "",
        );
        const newPrice = parseFloat(rawPrice);

        if (Number.isNaN(newPrice) || newPrice <= 0) {
          console.warn(
            `Unparseable price "${productData.currentPrice}" for product ${product.id}`,
          );
          results.failed++;
          continue;
        }

        const oldPrice = parseFloat(product.current_price);

        await supabase
          .from("trackify_products")
          .update({
            current_price: newPrice,
            currency: productData.currencyCode || product.currency,
            name: productData.productName || product.name,
            image_url: productData.productImageUrl || product.image_url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", product.id);

        if (oldPrice !== newPrice) {
          await supabase.from("price_history").insert({
            product_id: product.id,
            price: newPrice,
            currency: productData.currencyCode || product.currency,
          });

          results.priceChanges++;

          if (newPrice < oldPrice) {
            //  Alert
            const {
              data: { user },
            } = await supabase.auth.admin.getUserById(product.user_id);

            if (user?.email) {
              // Send Email
              const emailResult = await sendPriceDropAlert(
                user.email,
                product,
                oldPrice,
                newPrice,
              );

              if (emailResult.success) {
                results.alertsSent++;
              }
            }
          }
        }
        results.updated++;
      } catch (error) {
        console.log(`Error processing product ${product.id}:`, error);
        results.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Price check completed",
      results,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
