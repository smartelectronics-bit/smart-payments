require("dotenv").config();

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

function normalizePhone(phone) {
  let value = String(phone || "").replace(/\D/g, "");

  if (value.startsWith("0")) {
    value = "254" + value.slice(1);
  }

  if (value.startsWith("+254")) {
    value = value.slice(1);
  }

  return value;
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Smart Payments server is running"
  });
});

app.post("/api/stkpush", async (req, res) => {
  try {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({
        success: false,
        message: "Phone number and amount are required."
      });
    }

    const phoneNumber = normalizePhone(phone);
    const paymentAmount = Number(amount);

    if (!/^2547\d{8}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid Kenyan M-Pesa phone number."
      });
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount < 1) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid payment amount."
      });
    }

    const {
      MPESA_CONSUMER_KEY,
      MPESA_CONSUMER_SECRET,
      MPESA_SHORTCODE,
      MPESA_PASSKEY,
      MPESA_BASE_URL,
      MPESA_CALLBACK_URL,
      MPESA_ACCOUNT_REFERENCE
    } = process.env;

    if (
      !MPESA_CONSUMER_KEY ||
      !MPESA_CONSUMER_SECRET ||
      !MPESA_SHORTCODE ||
      !MPESA_PASSKEY ||
      !MPESA_CALLBACK_URL
    ) {
      return res.status(500).json({
        success: false,
        message: "Daraja configuration is incomplete. Check the .env file."
      });
    }

    const baseUrl =
      MPESA_BASE_URL || "https://sandbox.safaricom.co.ke";

    const auth = Buffer.from(
      MPESA_CONSUMER_KEY + ":" + MPESA_CONSUMER_SECRET
    ).toString("base64");

    const tokenResponse = await fetch(
      baseUrl + "/oauth/v1/generate?grant_type=client_credentials",
      {
        method: "GET",
        headers: {
          Authorization: "Basic " + auth
        }
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(502).json({
        success: false,
        message: "Could not connect to the M-Pesa service."
      });
    }

    const now = new Date();

    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const password = Buffer.from(
      MPESA_SHORTCODE + MPESA_PASSKEY + timestamp
    ).toString("base64");

    const stkPayload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(paymentAmount),
      PartyA: phoneNumber,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: MPESA_ACCOUNT_REFERENCE || "SmartPayments",
      TransactionDesc: "Smart Payments"
    };

    const stkResponse = await fetch(
      baseUrl + "/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + tokenData.access_token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(stkPayload)
      }
    );

    const stkData = await stkResponse.json();

    if (!stkResponse.ok) {
      return res.status(502).json({
        success: false,
        message: "M-Pesa STK Push request failed."
      });
    }

    res.json({
      success: true,
      message: "M-Pesa prompt sent. Check your phone and enter your PIN there.",
      data: stkData
    });

  } catch (error) {
    console.error("STK Push error:", error);

    res.status(500).json({
      success: false,
      message: "Something went wrong while starting the payment."
    });
  }
});

app.post("/api/mpesa/callback", (req, res) => {
  console.log("M-Pesa callback received:", JSON.stringify(req.body, null, 2));

  res.json({
    ResultCode: 0,
    ResultDesc: "Accepted"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Smart Payments server running on port " + PORT);
});
