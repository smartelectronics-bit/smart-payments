const form = document.getElementById("paymentForm");
const amountInput = document.getElementById("amount");
const button = document.getElementById("payButton");
const message = document.getElementById("message");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(amountInput.value);
  if (!Number.isFinite(amount) || amount < 1) {
    message.textContent = "Enter a valid payment amount.";
    message.style.color = "#b00020";
    return;
  }
  message.style.color = "#087f23";
  message.innerHTML = "<strong>Payment ready: KES " + Math.round(amount) + "</strong><br><br>Open M-Pesa → Pay/Transact → Pochi la Biashara → enter <strong>0799942997</strong> → enter the amount → confirm → enter your PIN inside M-Pesa only.";
});
