import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LoaderCircle } from "lucide-react";
import App from "./App";
import { initialiseLocalFiles } from "./lib/local-files";
import { Logo } from "./components/UI";
import "./styles.css";

function Bootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initialiseLocalFiles()
      .catch((error) => console.warn("Local uploads unavailable", error))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <main className="library-boot">
        <Logo full />
        <LoaderCircle size={24} className="spin" />
        <p>Opening your creative toolbox…</p>
      </main>
    );
  }

  return <App />;
}

createRoot(document.getElementById("root")).render(<Bootstrap />);
