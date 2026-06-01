const container = document.getElementById("users");

function createDeleteCard(user) {
  const div = document.createElement("div");
  div.classList.add("user-item");

  const imgSrc = user.passport
    ? `/uploads/${user.passport}`
    : "https://via.placeholder.com/50";

  const receiptSrc = user.paymentProof ? `/uploads/${user.paymentProof}` : null;

  div.innerHTML = `
    <input type="checkbox" value="${user._id}" class="user-select">

    <img src="${imgSrc}">

    <div>
      <p><strong>${user.name}</strong></p>
      <p>${user.email}</p>
      <p>${user.phone || "N/A"}</p>
      <p>${user.session}</p>
      <p>${user.roomNo || "N/A"}</p>

      ${
        receiptSrc
          ? `<a href="${receiptSrc}" target="_blank">View Receipt</a>`
          : `<p>No Receipt</p>`
      }
    </div>
  `;

  return div;
}

fetch("/users")
  .then((res) => res.json())
  .then((users) => {
    container.innerHTML = "";
    users.forEach((user) => {
      container.appendChild(createDeleteCard(user));
    });
  });

async function deleteSelected() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("You are not logged in");
    return;
  }

  const selected = document.querySelectorAll(".user-select:checked");

  const ids = Array.from(selected).map((cb) => cb.value);

  if (ids.length === 0) {
    alert("No users selected");
    return;
  }

  try {
    const res = await fetch("/users/delete-bulk", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Delete failed");
      return;
    }

    alert("Deleted successfully");
    location.reload();
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
}
