const params = new URLSearchParams(window.location.search);
const errorMsg = document.getElementById("errorMsg");

if (params.get("error") === "1" && errorMsg) {
    errorMsg.style.display = "block";
}
