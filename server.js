require("dotenv").config();

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Temporary transaction storage.
// We will replace this with a real database before production.
const payments = new Map();

app.use(express.json());
app.use(express.static(__dirname));

function normalizePhone(phone) {
  const value = String(phone || "").replace(/\s+/g, "");

  if (/^07\d{8}$/.test(value)) {
    return "254" + value.slice(1);
  }

  if (/^01\d{8}$/.test(value)) {
    return "254" + value.slice(1);
  }

  if (/^254[17]\d{8}$/.test(value)) {
    return value;
  }

  return null;
}

function generateReference() {
  return "SP-" + Date.now().toString().slice(-8);
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Smart Payments server is running"
  });
});

app.post("/api/stkpush", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const amount = Number(req.body.amount);

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid Kenyan M-Pesa phone number."
      });
    }

    if (!Number.isInteger(amount) || amount < 1) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a whole number greater than zero."
      });
    }

    const {
      MPESA_CONSUMER_KEY,
      MPESA_CONSUMER_SECRET,
      MPESA_PASSKEY,
      MPESA_SHORTCODE,
      MPESA_BASE_URL,
      MPESA_CALLBACK_URL,
      MPESA_ACCOUNT_REFERENCE
    } = process.env;

    if (
      !MPESA_CONSUMER_KEY ||
      !MPESA_CONSUMER_SECRET ||
      !MPESA_PASSKEY ||
      !MPESA_SHORTCODE ||
      !MPESA_BASE_URL ||
      !MPESA_CALLBACK_URL
    ) {
      return res.status(500).json({
        success: false,
        message: "M-Pesa server configuration is incomplete."
      });
    }

    // 1. Get OAuth access token
    const auth = Buffer.from(
      `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const tokenResponse = await fetch(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("OAuth error:", tokenData);

      return res.status(502).json({
        success: false,
        message: "Could not connect to M-Pesa."
      });
    }

    // 2. Create timestamp and password
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const reference =
      MPESA_ACCOUNT_REFERENCE || generateReference();

    // 3. Send STK Push
    const stkResponse = await fetch(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          BusinessShortCode: MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: amount,
          PartyA: phone,
          PartyB: MPESA_SHORTCODE,
          PhoneNumber: phone,
          CallBackURL: MPESA_CALLBACK_URL,
          AccountReference: reference,
          TransactionDesc: "Smart Payments"
        })
      }
    );

    const stkData = await stkResponse.json();

    console.log("STK response:", stkData);

    if (
      !stkResponse.ok ||
      String(stkData.ResponseCode) !== "0"
    ) {
      return res.status(502).json({
        success: false,
        message:
          stkData.ResponseDescription ||
          stkData.errorMessage ||
          "M-Pesa STK request failed."
      });
    }

    // 4. Save the transaction as PENDING
    if (stkData.CheckoutRequestID) {
      payments.set(stkData.CheckoutRequestID, {
        status: "PENDING",
        phone,
        amount,
        reference,
        merchantRequestId: stkData.MerchantRequestID,
        checkoutRequestId: stkData.CheckoutRequestID,
        createdAt: Date.now()
      });
    }

    return res.json({
      success: true,
      message: "Payment prompt sent to your phone.",
      reference,
      merchantRequestId: stkData.MerchantRequestID,
      checkoutRequestId: stkData.CheckoutRequestID
    });

  } catch (error) {
    console.error("STK error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to start payment."
    });
  }
});

// Check payment status
app.get("/api/payment/:checkoutRequestId", (req, res) => {
  const payment = payments.get(req.params.checkoutRequestId);

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: "Payment not found."
    });
  }

  res.json({
    success: true,
    payment
  });
});

// M-Pesa callback
app.post("/api/mpesa/callback", (req, res) => {
  try {
    console.log(
      "M-Pesa callback:",
      JSON.stringify(req.body, null, 2)
    );

    const callback = req.body?.Body?.stkCallback;

    if (!callback) {
      return res.json({
        ResultCode: 0,
        ResultDesc: "Accepted"
      });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = Number(callback.ResultCode);

    const payment = payments.get(checkoutRequestId);

    if (payment) {
      if (resultCode === 0) {
        const metadata =
          callback.CallbackMetadata?.Item || [];

        const getMetadata = (name) => {
          const item = metadata.find(
            (entry) => entry.Name === name
          );

          return item ? item.Value : null;
        };

        payment.status = "PAID";
        payment.resultCode = resultCode;
        payment.resultDescription =
          callback.ResultDesc || "Payment successful";

        payment.mpesaReceiptNumber =
          getMetadata("MpesaReceiptNumber");

        payment.paidAmount =
          getMetadata("Amount");

        payment.paidPhone =
          getMetadata("PhoneNumber");

        payment.transactionDate =
          getMetadata("TransactionDate");

        payment.completedAt = Date.now();
      } else {
        payment.status = "FAILED";
        payment.resultCode = resultCode;
        payment.resultDescription =
          callback.ResultDesc || "Payment failed";

        payment.completedAt = Date.now();
      }

      payments.set(checkoutRequestId, payment);
    }

    return res.json({
      ResultCode: 0,
      ResultDesc: "Accepted"
    });

  } catch (error) {
    console.error("Callback error:", error);

    return res.json({
      ResultCode: 0,
      ResultDesc: "Accepted"
    });
  }
});

// Remove old transactions from memory
setInterval(() => {
  const expiry = Date.now() - 30 * 60 * 1000;

  for (const [id, payment] of payments.entries()) {
    if (payment.createdAt < expiry) {
      payments.delete(id);
    }
  }
}, 5 * 60 * 1000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Smart Payments server running on port ${PORT}`);
});
