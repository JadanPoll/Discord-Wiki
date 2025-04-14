<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NFC Device</title>
  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
</head>
<body>
  <h1>NFC Communication</h1>

  <input type="text" id="titleInput" placeholder="Enter title" />
  <button onclick="addNfcCode()">Add NFC Code</button>

  <p><strong>Generated NFC Code:</strong> <span id="nfcCodeDisplay">None</span></p>

  <script>
    const socket = io("http://localhost:5000", {
      withCredentials: true
    });

    socket.on("connect", () => {
      console.log("Connected via Socket.IO, session established.");
    });

    socket.on("nfc_notification", (data) => {
      console.log("🔔 Notification received:", data);
      alert(`Another device accessed your NFC code "${data.code}" (title: ${data.title})`);
    });

    function addNfcCode() {
      const title = document.getElementById("titleInput").value;
      if (!title) {
        alert("Please enter a title first.");
        return;
      }

      fetch("http://localhost:5000/nfc-communication-add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ title })
      })
        .then(res => res.json())
        .then(data => {
          document.getElementById("nfcCodeDisplay").textContent = data.code;
          console.log("📟 NFC Code generated:", data.code);
        })
        .catch(err => {
          console.error("Failed to add NFC code:", err);
        });
    }
  </script>
</body>
</html>
