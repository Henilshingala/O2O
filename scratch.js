const https = require("https");

const data = JSON.stringify({
  text: "Hello from test script",
  timestamp: new Date().toISOString(),
  type: "text"
});

const req = https.request(
  "https://o2o-rphb.onrender.com/api/data/chats/fake-id/messages",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
      // We don't have a token, so we expect a 401 Unauthorized
      // If we get 500, it means the middleware crashed before auth? No, auth middleware runs first.
    }
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => body += chunk);
    res.on("end", () => console.log("Status:", res.statusCode, "Body:", body));
  }
);

req.on("error", console.error);
req.write(data);
req.end();
