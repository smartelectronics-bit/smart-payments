const form = document.getElementById("paymentForm");
const phoneInput = document.getElementById("phone");
const amountInput = document.getElementById("amount");
const button = document.getElementById("payButton");
const message = document.getElementById("message");
const paymentReference = document.getElementById("paymentReference");
const paymentStatus = document.getElementById("paymentStatus");

let statusTimer = null;

function setMessage(text, type = "info") {
  message.textContent = text;

  if (type === "error") {
    message.style.color = "#b00020";
  } else if (type === "success") {
    message.style.color = "#087f23";
  } else {
    message.style.color = "";
  }
}

function setStatus(text) {
  paymentStatus.textContent = text;
}

function stopStatusPolling() {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
}

async function checkPaymentStatus(checkoutRequestId) {
  try {
    const response = await fetch(
      `/api/payment/${encodeURIComponent(checkoutRequestId)}`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return;
    }

    const payment = data.payment;

    if (payment.status === "PAID") {
      stopStatusPolling();

      setStatus("Payment successful ✅");

      setMessage(
        "Payment received successfully. Thank you!",
        "success"
      );

      button.disabled = false;
      button.textContent = "Pay with M-Pesa";

      if (payment.mpesaReceiptNumber) {
        setMessage(
          `Payment received successfully. M-Pesa receipt: ${payment.mpesaReceiptNumber}`,
          "success"
        );
      }

      return;
    }

    if (payment.status === "FAILED") {
      stopStatusPolling();

      setStatus("Payment failed ❌");

      setMessage(
        payment.resultDescription ||
          "The M-Pesa payment was not completed.",
        "error"
      );

      button.disabled = false;
      button.textContent = "Try Again";

      return;
    }

    setStatus("Waiting for payment ⏳");
  } catch (error) {
    console.error("Payment status error:", error);
  }
}

function startStatusPolling(checkoutRequestId) {
  stopStatusPolling();

  let attempts = 0;
  const maxAttempts = 60;

  setStatus("Waiting for payment ⏳");

  statusTimer = setInterval(async () => {
    attempts++;

    await checkPaymentStatus(checkoutRequestId);

    if (attempts >= maxAttempts) {
      stopStatusPolling();

      setStatus("Payment status timed out");

      setMessage(
        "We could not confirm the payment yet. Please check your M-Pesa messages before trying again.",
        "error"
      );

      button.disabled = false;
      button.textContent = "Pay with M-Pesa";
    }
  }, 2000);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  stopStatusPolling();

  const phoneDigits = phoneInput.value.replace(/\D/g, "");
  const amount = Number(amountInput.value);

  if (!/^7\d{8}$/.test(phoneDigits)) {
    setMessage(
      "Enter a valid M-Pesa number. Use a number such as 712345678.",
      "error"
    );
    return;
  }

  if (!Number.isInteger(amount) || amount < 1) {
    setMessage(
      "Enter a valid amount. The minimum payment is KES 1.",
      "error"
    );
    return;
  }

  const phone = "254" + phoneDigits;

  button.disabled = true;
  button.textContent = "Sending...";

  setMessage("Starting M-Pesa payment...");
  setStatus("Preparing payment ⏳");

  paymentReference.textContent = "Creating payment...";

  try {
    const response = await fetch("/api/stkpush", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        phone,
        amount
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Could not start the M-Pesa payment."
      );
    }

    paymentReference.textContent =
      data.reference || "SP-PENDING";

    setMessage(
      "M-Pesa prompt sent. Check your phone and enter your M-Pesa PIN."
    );

    setStatus("Waiting for payment ⏳");

    button.textContent = "Waiting...";

    if (data.checkoutRequestId) {
      startStatusPolling(data.checkoutRequestId);
    } else {
      throw new Error(
        "M-Pesa did not return a payment reference."
      );
    }

  } catch (error) {
    console.error(error);

    stopStatusPolling();

    setMessage(
      error.message || "Unable to start payment.",
      "error"
    );

    setStatus("Payment not started");

    button.disabled = false;
    button.textContent = "Try Again";
  }
});
