const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");

dotenv.config();
const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

// Optional: Redirect root to index.html
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});
// Generate Access Token
async function getAccessToken() {
  const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const auth = Buffer.from(`${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`).toString("base64");

  const response = await axios.get(url, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  return response.data.access_token;
}

// STK Push Function
async function lipaNaMpesa(phone, amount) {
  const access_token = await getAccessToken();
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  const password = Buffer.from(`${process.env.SHORTCODE}${process.env.PASSKEY}${timestamp}`).toString("base64");

  const payload = {
    BusinessShortCode: process.env.SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: process.env.SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: process.env.CALLBACK_URL,
    AccountReference: "BudgetPalApp",
    TransactionDesc: "Budget contribution",
  };

  const response = await axios.post("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", payload, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  return response.data;
}

// API Endpoint to Trigger STK Push
app.post("/api/pay", async (req, res) => {
  try {
    let { phone, amount } = req.body;

    // Convert "07xxxxxxxx" to "2547xxxxxxxx"
    if (phone.startsWith("07") && phone.length === 10) {
      phone = phone.replace(/^0/, "254");
    }

    const result = await lipaNaMpesa(phone, amount);
    res.status(200).json(result);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "STK Push failed" });
  }
});

// Callback URL Handler
app.post("/callback", (req, res) => {
  console.log("Callback received:", req.body);
  res.status(200).send("Callback received");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
