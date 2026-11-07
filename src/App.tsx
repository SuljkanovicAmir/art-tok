import "./App.css";
import { Routes, Route } from "react-router-dom";
import FeedPage from "./pages/FeedPage";
import ArtworkDetailPage from "./pages/ArtworkDetailPage";
import SearchPage from "./pages/SearchPage";
import LikedPage from "./pages/LikedPage";
import CategoriesPage from "./pages/CategoriesPage";
import TimelinePage from "./pages/TimelinePage";
import BottomNav from "./components/BottomNav";
import { usePageViewTracking } from "./hooks/usePageViewTracking";

function App() {
  usePageViewTracking();

  return (
    <>
      <Routes>
        <Route path="/" element={<FeedPage />} />
        <Route path="/artwork/:source/:id" element={<ArtworkDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/liked" element={<LikedPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/categories/:facet/:value" element={<SearchPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export default App;
