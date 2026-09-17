/* Message d'accueil de Goupille au chargement du portfolio. */
const goupilleWidget = document.querySelector("#goupille-widget");
const goupilleMessage = document.querySelector("#goupille-message");
const goupilleButton = document.querySelector("#goupille-button");

if (goupilleWidget && goupilleMessage && goupilleButton) {
  const introMessage = "Clique-moi dessus !";
  let introActive = true;

  setTimeout(() => {
    if (goupilleWidget.classList.contains("is-tucked")) return;
    goupilleMessage.textContent = introMessage;
    goupilleWidget.classList.add("is-open");
  }, 500);

  goupilleButton.addEventListener("click", () => {
    if (!introActive) return;
    introActive = false;
    // Le gestionnaire principal de Goupille remplace ensuite ce texte
    // par sa première phrase normale.
  }, { once: true });
}
