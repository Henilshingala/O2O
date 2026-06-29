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

async function runExtendedTests() {
  console.log("Starting Extended E2E API Tests on PostgreSQL...");
  let adminToken;

  try {
    // 1. Admin Signup
    const admin = await request("/auth/signup", "POST", { username: "admin_" + Date.now(), fullName: "Admin One", password: "pwd", role: "admin", email: "admin_" + Date.now() + "@test.com", mobile: "999" + Date.now(), city: "NYC" });
    adminToken = admin.token;
    console.log("✔ Admin logged in");

    // 2. Profile
    await request("/extended/userProfiles", "POST", { userId: admin.user.id, bio: "I am an admin", website: "https://admin.com" }, adminToken);
    let profiles = await request("/extended/userProfiles", "GET", null, adminToken);
    if (!profiles.find(p => p.userId === admin.user.id)) throw new Error("Profile not created");
    
    // 3. Delete Profile
    await request("/extended/userProfiles/delete", "POST", { userId: admin.user.id }, adminToken);
    profiles = await request("/extended/userProfiles", "GET", null, adminToken);
    if (profiles.find(p => p.userId === admin.user.id)) throw new Error("Profile not deleted");
    console.log("✔ Profile CRUD successful");

    // 4. Categories
    const cat = await request("/extended/productCategories", "POST", { name: "Electronics_" + Date.now(), description: "Gadgets" }, adminToken);
    const catId = cat.id;
    let cats = await request("/extended/productCategories", "GET", null, adminToken);
    if (!cats.find(c => c.id === catId)) throw new Error("Category not created");
    
    // Delete Category
    await request("/extended/productCategories/delete", "POST", { id: catId }, adminToken);
    cats = await request("/extended/productCategories", "GET", null, adminToken);
    if (cats.find(c => c.id === catId)) throw new Error("Category not deleted");
    console.log("✔ Categories CRUD successful");

    // 5. Cart
    const cart = await request("/extended/cart", "POST", { userId: admin.user.id, status: "active" }, adminToken);
    let carts = await request("/extended/cart", "GET", null, adminToken);
    if (!carts.find(c => c.id === cart.id)) throw new Error("Cart not created");
    console.log("✔ Cart CRUD successful");

    // 6. Reports
    const report = await request("/extended/reports", "POST", { reporterId: admin.user.id, targetType: "user", targetId: "some_user_id", reason: "spam" }, adminToken);
    let reports = await request("/extended/reports", "GET", null, adminToken);
    if (!reports.find(r => r.id === report.id)) throw new Error("Report not created");
    console.log("✔ Reports CRUD successful");

    console.log("===================================");
    console.log("ALL EXTENDED E2E TESTS PASSED AGAINST POSTGRESQL");
    console.log("===================================");

  } catch (err) {
    console.error("❌ Test Failed:", err.message || err);
  }
}

runExtendedTests();
