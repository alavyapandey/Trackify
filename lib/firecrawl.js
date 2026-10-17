import { Firecrawl } from "firecrawl";

const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

export async function scrapeProduct(url) {
  try {
    const result = await firecrawl.scrape(url, {
      formats: [
        {
          type: "json",
          schema: {
            type: "object",
            required: ["productName", "currentPrice"],
            properties: {
              productName: {
                type: "string",
              },
              currentPrice: {
                type: "number",
              },
              currencyCode: {
                type: "string",
              },
              productImageUrl: {
                type: "string",
              },
            },
          },
          prompt:
            " Extract the product name as 'productName', current price as a number as 'currentPrice', currency code (USD, EUR, etc) as 'currencyCode', and product image URL as 'productImageUrl' if available",
            
        },
      ],
    });

    const extractData = result.json;

    if (!extractData || !extractData.productName) {
      throw new Error("No data extracted from URL");
    }

    return extractData;
  } catch (error) {
    console.log("Firecrawl scrap error:", error);
    throw new Error(`Failed to scrape product: ${error.message}`);
  }
}
