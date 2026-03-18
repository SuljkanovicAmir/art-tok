import "./App.css";
import { Routes, Route } from "react-router-dom";
import FeedPage from "./pages/FeedPage";
import ArtworkDetailPage from "./pages/ArtworkDetailPage";
import SearchPage from "./pages/SearchPage";
import LikedPage from "./pages/LikedPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<FeedPage />} />
      <Route path="/artwork/:id" element={<ArtworkDetailPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/liked" element={<LikedPage />} />
    </Routes>
  );
}

export default App;
