import { Routes, Route } from "react-router-dom";
import NewPresentation from "./routes/NewPresentation";
import OutlineView from "./routes/OutlineView";
import EditorView from "./routes/EditorView";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<NewPresentation />} />
      <Route path="/outline/:id" element={<OutlineView />} />
      <Route path="/editor/:id" element={<EditorView />} />
    </Routes>
  );
}
