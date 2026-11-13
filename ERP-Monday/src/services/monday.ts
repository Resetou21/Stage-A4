import mondaySdk from "monday-sdk-js";

// Filtrer l'avertissement de dépréciation interne console.warn de monday-sdk-js
if (typeof window !== "undefined") {
  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (typeof args[0] === "string" && args[0].includes("monday.api() is deprecated")) {
      return;
    }
    origWarn.apply(console, args);
  };
}

const monday = mondaySdk();
export default monday;


