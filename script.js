const form = document.getElementById("paymentForm");
const phoneInput = document.getElementById("phone");
const amountInput = document.getElementById("amount");
const button = document.getElementById("payButton");
const message = document.getElementById("message");

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

                    form.addEventListener("submit", async (event) => {
                      event.preventDefault();

                        const phone = normalizePhone(phoneInput.value);
                          const amount = Number(amountInput.value);

                            if (!/^2547\d{8}$/.test(phone)) {
                                message.textContent = "Enter a valid Kenyan M-Pesa phone number.";
                                    message.style.color = "#b00020";
                                        return;
                                          }

                                            if (!Number.isFinite(amount) || amount < 1) {
                                                message.textContent = "Enter a valid payment amount.";
                                                    message.style.color = "#b00020";
                                                        return;
                                                          }

                                                            button.disabled = true;
                                                              message.textContent = "Starting M-Pesa payment...";
                                                                message.style.color = "#333";

                                                                  try {
                                                                      const response = await fetch("/api/stkpush", {
                                                                            method: "POST",
                                                                                  headers: {
                                                                                          "Content-Type": "application/json"
                                                                                                },
                                                                                                      body: JSON.stringify({ phone, amount })
                                                                                                          });

                                                                                                              const result = await response.json();

                                                                                                                  if (!response.ok || !result.success) {
                                                                                                                        throw new Error(result.message || "Payment request failed.");
                                                                                                                            }

                                                                                                                                message.textContent =
                                                                                                                                      result.message ||
                                                                                                                                            "M-Pesa prompt sent. Check your phone and enter your PIN there.";

                                                                                                                                                message.style.color = "#087f23";
                                                                                                                                                    form.reset();

                                                                                                                                                      } catch (error) {
                                                                                                                                                          message.textContent =
                                                                                                                                                                error.message || "Something went wrong. Please try again.";

                                                                                                                                                                    message.style.color = "#b00020";

                                                                                                                                                                      } finally {
                                                                                                                                                                          button.disabled = false;
                                                                                                                                                                            }
                                                                                                                                                                            });