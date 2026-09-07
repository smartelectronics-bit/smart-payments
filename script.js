const form = document.getElementById("paymentForm");
const phoneInput = document.getElementById("phone");
const amountInput = document.getElementById("amount");
const button = document.getElementById("payButton");
const message = document.getElementById("message");
const paymentReference = document.getElementById("paymentReference");
const paymentStatus = document.getElementById("paymentStatus");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const phoneDigits = phoneInput.value.replace(/\D/g, "");
  const amount = Number(amountInput.value);

  if (!/^7\d{8}$/.test(phoneDigits)) {
    message.style.color = "#b00020";
    message.innerHTML =
      "<strong>Enter a valid M-Pesa number.</strong><br>" +
      "Use a number such as 712345678.";
    return;
  }

  if (!Number.isInteger(amount) || amount < 1) {
    message.style.color = "#b00020";
    message.innerHTML =
      "<strong>Enter a valid amount.</strong><br>" +
      "The minimum payment is KES 1.";
    return;
  }

  const phone = "254" + phoneDigits;

  const reference =
    "SP-" + Date.now().toString().slice(-8);

  paymentReference.textContent = reference;
  paymentStatus.textContent = "Sending M-Pesa payment prompt...";

  button.disabled = true;
  button.textContent = "Sending Prompt...";

  message.style.color = "#087f23";
  message.innerHTML = "Connecting securely to M-Pesa...";

  try {
    const response = await fetch("/api/stkpush", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        phone: phone,
        amount: amount
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Unable to start the M-Pesa payment."
      );
    }

    paymentStatus.textContent =
      "M-Pesa prompt sent — complete the payment on your phone.";

    message.style.color = "#087f23";

    message.innerHTML =
      "<strong>Payment prompt sent ✓</strong><br><br>" +
      "A KES " + amount + " M-Pesa payment prompt has been sent to " +
      "<strong>+254" + phoneDigits + "</strong>.<br><br>" +
      "Check your phone and complete the payment in the official M-Pesa prompt.<br><br>" +
      "<small>Reference: <strong>" + reference + "</strong></small><br><br>" +
      "<strong>🔒 Never enter your M-Pesa PIN on this website.</strong>";

    button.textContent = "Prompt Sent ✓";

  } catch (error) {

    paymentStatus.textContent = "Payment could not be started.";

    message.style.color = "#b00020";

    message.innerHTML =
      "<strong>Payment could not be started.</strong><br>" +
      (error.message || "Please try again.");

    button.disabled = false;
    button.textContent = "Pay with M-Pesa";
  }
});
