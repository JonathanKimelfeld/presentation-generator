import { Routes, Route } from "react-router-dom";
import NewPresentation from "./routes/NewPresentation";
import OutlineView from "./routes/OutlineView";
import EditorView from "./routes/EditorView";
import PresentView from "./routes/PresentView";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<NewPresentation />} />
      <Route path="/outline/:id" element={<OutlineView />} />
      <Route path="/editor/:id" element={<EditorView />} />
      <Route path="/present/:id" element={<PresentView />} />
    </Routes>
  );
}
