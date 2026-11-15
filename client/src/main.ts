import { loadAssetCatalog } from "./assets";
import { gameDirector } from "./game";
import { appBus, store } from "./store";
import { finishBoot, initUI, setBootProgress, showBootError } from "./ui";

interface BootProgressDetail {
  value: number;
  label: string;
}

function bootMount(): HTMLElement {
  const mount = document.getElementById("game-mount");
  if (!mount) throw new Error("Missing required element #game-mount");
  return mount;
}

async function boot(): Promise<void> {
  initUI();

  appBus.addEventListener("boot-progress", (event) => {
    const detail = (event as CustomEvent<BootProgressDetail>).detail;
    setBootProgress(detail.value, detail.label);
  });

  const ready = new Promise<void>((resolve) => {
    appBus.addEventListener("boot-ready", () => resolve(), { once: true });
  });

  setBootProgress(0.03, "OPENING ARES SURVEY DOSSIER");

  try {
    await loadAssetCatalog((value, label) => setBootProgress(value, label));
    setBootProgress(0.2, "CREW AND EQUIPMENT RECORDS LINKED");
    gameDirector.create(bootMount());

    // Scene changes are driven entirely by the authoritative room snapshot.
    store.subscribe((state) => {
      gameDirector.syncRoom(state.room);
    });

    await ready;
    setBootProgress(0.97, "SURFACE SYSTEMS NOMINAL");
    gameDirector.markReady();
    store.setAssetsReady(true);

    window.setTimeout(() => {
      finishBoot();
    }, 180);
  } catch (error) {
    console.error("[red-frontier] boot failed", error);
    showBootError(
      error instanceof Error
        ? `BOOT FAILURE · ${error.message}`
        : "BOOT FAILURE · Could not load original art assets.",
    );
  }
}

void boot();
