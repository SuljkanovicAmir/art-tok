import "./App.css";
import { useEffect } from "react";
import artImagesStore from "./stores/ArtImagesStore";
import { observer } from "mobx-react";

const App = observer(function App() {
  const { data, isLoading } = artImagesStore;
  useEffect(() => {
    artImagesStore.fetchArtImages();
  }, []);

  if (isLoading) return <div>Loading</div>;
  if (!data?.length) return <div>No artworks found</div>;

  return (
    <>
      <div className="list">
        {data?.map((image) => (
          <img className="images" src={image} />
        ))}
      </div>
    </>
  );
});

export default App;
