import "./App.css";
import { Routes, Route } from "react-router-dom";
import FeedPage from "./pages/FeedPage";
import ArtworkDetailPage from "./pages/ArtworkDetailPage";
import SearchPage from "./pages/SearchPage";
import LikedPage from "./pages/LikedPage";
import CategoriesPage from "./pages/CategoriesPage";
import BottomNav from "./components/BottomNav";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<FeedPage />} />
        <Route path="/artwork/:source/:id" element={<ArtworkDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/liked" element={<LikedPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/categories/:facet/:value" element={<SearchPage />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export default App;
