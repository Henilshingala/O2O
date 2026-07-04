const BASE_URL = "http://localhost:5000/api";

async function request(path, method = "GET", body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function runTests() {
  console.log("Starting E2E API Tests on PostgreSQL...");
  let sellerToken, buyerToken;
  let sellerId, buyerId;
  let channelId, productId, bidId, orderId, chatId;

  try {
    // 1. Signup / Login
    console.log("1. Testing Auth & OTP (Signup/Login)...");
    const seller = await request("/auth/signup", "POST", { username: "seller_" + Date.now(), fullName: "Seller One", password: "pwd", role: "seller", email: "seller_" + Date.now() + "@test.com", mobile: "111" + Date.now(), city: "NYC" });
    sellerToken = seller.token;
    sellerId = seller.user.id;
    
    const buyer = await request("/auth/signup", "POST", { username: "buyer_" + Date.now(), fullName: "Buyer One", password: "pwd", role: "buyer", email: "buyer_" + Date.now() + "@test.com", mobile: "222" + Date.now(), city: "LA" });
    buyerToken = buyer.token;
    buyerId = buyer.user.id;

    const otpRes = await request("/auth/send-otp", "POST", { email: buyer.user.email });
    await request("/auth/verify-otp", "POST", { email: buyer.user.email, otp: otpRes.otp });
    console.log("✔ Auth & OTP successful");

    // 2. Channels & Products
    console.log("2. Testing Channels & Products...");
    const channel = await request("/data/channels", "POST", { name: "Seller Channel", description: "Test", category: "electronics", visibility: "public" }, sellerToken);
    channelId = channel.id;

    const product = await request(`/data/channels/${channelId}/products`, "POST", { name: "iPhone", description: "New", price: 1000, details: [] }, sellerToken);
    productId = product.id;
    console.log("✔ Channels & Products created");

    // 3. Wishlist
    console.log("3. Testing Wishlist...");
    await request("/data/wishlist", "POST", { productId }, buyerToken);
    const wishlist = await request("/data/wishlist", "GET", null, buyerToken);
    if (wishlist.length === 0) throw new Error("Wishlist empty");
    console.log("✔ Wishlist tested");

    // 4. Bids
    console.log("4. Testing Bids & Offers...");
    const endTime = new Date(Date.now() + 86400000).toISOString();
    const bid = await request("/data/bids", "POST", { productName: "iPhone", quantity: 1, budget: 900, description: "Need fast", selectedSellers: [channelId], allSellers: false, endTime }, buyerToken);
    bidId = bid.id;
    
    // Seller makes offer
    await request(`/data/bids/${bidId}/offers`, "POST", { channelId, price: 950, deliveryTime: "Tomorrow", message: "Best price" }, sellerToken);
    
    // Buyer selects winner
    await request(`/data/bids/${bidId}/winner`, "POST", { winnerId: sellerId, winnerChannelId: channelId }, buyerToken);
    console.log("✔ Bids & Offers flow successful");

    // 5. Orders & Reviews
    console.log("5. Testing Orders & Reviews...");
    const order = await request("/data/orders", "POST", { bidId, sellerId, sellerChannelId: channelId, buyerId, offerPrice: 950, productName: "iPhone", quantity: 1, status: "pending" }, buyerToken);
    orderId = order.id;

    await request("/data/reviews", "POST", { orderId, sellerId, productName: "iPhone", rating: 5, text: "Great seller" }, buyerToken);
    console.log("✔ Orders & Reviews successful");

    // 6. Analytics
    console.log("6. Testing Analytics...");
    const stats = await request("/analytics", "POST", { channelIds: [channelId] }, sellerToken);
    if (stats.rating !== 5) throw new Error("Analytics rating mismatch: " + stats.rating);
    console.log("✔ Analytics successful");

    // 7. Chats
    console.log("7. Testing Chats...");
    const chat = await request("/data/chats", "POST", { myId: buyerId, otherId: sellerId }, buyerToken);
    chatId = chat.id;
    await request(`/data/chats/${chatId}/messages`, "POST", { text: "Hello" }, buyerToken);
    console.log("✔ Chats successful");

    console.log("===================================");
    console.log("ALL E2E TESTS PASSED AGAINST POSTGRESQL");
    console.log("===================================");

  } catch (err) {
    console.error("❌ Test Failed:", err.message || err);
  }
}

runTests();
