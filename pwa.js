(function () {
  "use strict";

  const installButton = document.querySelector("#install-app-button");
  const installHelpDialog = document.querySelector("#install-help-dialog");
  const installHelpDescription = document.querySelector(
    "#install-help-description",
  );
  const installStatus = document.querySelector("#install-app-status");
  const installButtonLabel = installButton?.querySelector("span:last-child");
  let installPrompt = null;
  let manualHelpAvailable = false;

  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  const isAppleMobile =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari =
    /Safari/.test(navigator.userAgent) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|Android/.test(navigator.userAgent);
  const isEmbeddedAppleWebView =
    isAppleMobile && !/Safari/.test(navigator.userAgent);
  const supportsManualInstall =
    (isAppleMobile && !isEmbeddedAppleWebView) || isSafari;

  function isInstalled() {
    return standaloneQuery.matches || navigator.standalone === true;
  }

  function updateInstallButton() {
    if (!installButton) return;
    const manualMode =
      !installPrompt && (supportsManualInstall || manualHelpAvailable);
    installButton.hidden =
      isInstalled() || (!installPrompt && !manualMode);
    if (installButtonLabel) {
      installButtonLabel.textContent = manualMode
        ? "Como instalar"
        : "Instalar Cloak";
    }
    if (manualMode) {
      installButton.setAttribute("aria-haspopup", "dialog");
      installButton.setAttribute("aria-controls", "install-help-dialog");
    } else {
      installButton.removeAttribute("aria-haspopup");
      installButton.removeAttribute("aria-controls");
    }
  }

  function showManualInstallHelp() {
    if (!installHelpDialog || !installHelpDescription) return;

    if (isAppleMobile) {
      installHelpDescription.textContent =
        "Toque em Compartilhar e escolha Adicionar à Tela de Início.";
    } else if (isSafari) {
      installHelpDescription.textContent =
        "No Safari, abra o menu Arquivo e escolha Adicionar ao Dock.";
    } else {
      installHelpDescription.textContent =
        "Abra o menu do navegador e escolha Instalar Cloak ou Instalar aplicativo.";
    }

    if (typeof installHelpDialog.showModal === "function") {
      installHelpDialog.showModal();
    } else {
      window.alert(installHelpDescription.textContent);
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    updateInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    manualHelpAvailable = false;
    if (installStatus) installStatus.textContent = "Cloak instalado.";
    updateInstallButton();
  });

  if (typeof standaloneQuery.addEventListener === "function") {
    standaloneQuery.addEventListener("change", updateInstallButton);
  }

  installButton?.addEventListener("click", async () => {
    if (!installPrompt) {
      showManualInstallHelp();
      return;
    }

    const prompt = installPrompt;
    installPrompt = null;
    installButton.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome !== "accepted") {
        manualHelpAvailable = true;
        if (installStatus) {
          installStatus.textContent =
            "Instalação cancelada. Use Como instalar para ver a alternativa pelo menu do navegador.";
        }
      }
    } catch (error) {
      manualHelpAvailable = true;
      if (installStatus) {
        installStatus.textContent =
          "A instalação automática não abriu. Consulte Como instalar.";
      }
      console.warn("Não foi possível abrir a instalação do Cloak.", error);
    } finally {
      installButton.disabled = false;
      updateInstallButton();
    }
  });

  installHelpDialog?.addEventListener("click", (event) => {
    if (
      event.target === installHelpDialog &&
      typeof installHelpDialog.close === "function"
    ) {
      installHelpDialog.close();
    }
  });

  installHelpDialog?.addEventListener("close", () => installButton?.focus());

  updateInstallButton();

  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js", {
          scope: "./",
          updateViaCache: "none",
        })
        .catch((error) => {
          console.warn("O modo offline do Cloak não pôde ser ativado.", error);
        });
    });
  }
})();
