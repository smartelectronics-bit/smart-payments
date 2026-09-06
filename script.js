const form = document.getElementById("paymentForm");
const amountInput = document.getElementById("amount");
const button = document.getElementById("payButton");
const message = document.getElementById("message");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = Number(amountInput.value);

  if (!Number.isInteger(amount) || amount < 1) {
    message.innerHTML =
      "<strong>Enter a valid amount.</strong><br>Please enter a whole number of at least KES 1.";
    message.style.color = "#b00020";
    return;
  }

  button.disabled = true;
  button.textContent = "Instructions Ready";

  message.style.color = "#087f23";

  message.innerHTML =
    "<strong>Payment ready: KES " + amount + "</strong><br><br>" +
    "<div style='text-align:left;line-height:1.8'>" +
    "1. Open the M-Pesa app.<br>" +
    "2. Tap <strong>Pay</strong> or <strong>Transact</strong>.<br>" +
    "3. Select <strong>Pochi la Biashara</strong>.<br>" +
    "4. Enter <strong>0799942997</strong>.<br>" +
    "5. Enter <strong>KES " + amount + "</strong>.<br>" +
    "6. Confirm the payment.<br>" +
    "7. Enter your M-Pesa PIN <strong>only inside M-Pesa</strong>." +
    "</div><br>" +
    "<button type='button' id='copyNumber'>Copy M-Pesa Number</button>";

  document.getElementById("copyNumber").onclick = async function () {
    try {
      await navigator.clipboard.writeText("0799942997");
      this.textContent = "Number Copied ✓";
    } catch (_) {
      this.textContent = "0799942997";
    }
  };

  setTimeout(() => {
    button.disabled = false;
    button.textContent = "Show Payment Instructions";
  }, 3000);
});
