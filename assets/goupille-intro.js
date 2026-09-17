/* Message d'accueil de Goupille au chargement du portfolio. */
const goupilleWidget = document.querySelector("#goupille-widget");
const goupilleMessage = document.querySelector("#goupille-message");

if (goupilleWidget && goupilleMessage) {
  const introMessage = "Clique-moi dessus !";

  setTimeout(() => {
    if (goupilleWidget.classList.contains("is-tucked")) return;

    goupilleMessage.textContent = introMessage;
    goupilleWidget.classList.add("is-open");

    setTimeout(() => {
      // Ne ferme pas la bulle si l'utilisateur a déjà cliqué sur Goupille
      // et qu'un autre message a remplacé le texte d'introduction.
      if (goupilleMessage.textContent === introMessage) {
        goupilleWidget.classList.remove("is-open");
      }
    }, 5000);
  }, 700);
}
